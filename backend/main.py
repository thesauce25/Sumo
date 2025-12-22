import asyncio
import time
import random
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import firestore as firestore_module

# Import our new Engine and Services
from app.core.engine import SumoEngine
from app.services.firebase import get_db

app = FastAPI(title="Sumo Serverless API")

# --- Progression Constants ---
XP_BASE_WIN = 50
XP_BASE_LOSS = 10
SP_WIN = 2
SP_LOSS = 1

WRESTLER_RANKS = [
    {"name": "Jonokuchi", "jp": "序ノ口", "xp_required": 0},
    {"name": "Jonidan", "jp": "序二段", "xp_required": 200},
    {"name": "Sandanme", "jp": "三段目", "xp_required": 600},
    {"name": "Makushita", "jp": "幕下", "xp_required": 1200},
    {"name": "Juryo", "jp": "十両", "xp_required": 2000},
    {"name": "Maegashira", "jp": "前頭", "xp_required": 3000},
    {"name": "Komusubi", "jp": "小結", "xp_required": 4500},
    {"name": "Sekiwake", "jp": "関脇", "xp_required": 6500},
    {"name": "Ozeki", "jp": "大関", "xp_required": 9000},
    {"name": "Yokozuna", "jp": "横綱", "xp_required": 12000},
]

# CORS - Allow All for Development (Restrict in Prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Constants ---
MATCH_STALE_TIMEOUT_SECONDS = 300  # 5 minutes - matches older than this without activity are dead

# --- In-Memory State Manager ---
class MatchManager:
    def __init__(self):
        # Maps match_id -> active SumoEngine
        self.matches: Dict[str, SumoEngine] = {}
        # Maps match_id -> List of WebSockets
        self.connections: Dict[str, List[WebSocket]] = {}
        # Maps match_id -> last activity timestamp
        self.match_timestamps: Dict[str, float] = {}

    def is_match_stale(self, match_id: str) -> bool:
        """Check if a match is stale (no activity for too long)"""
        if match_id not in self.match_timestamps:
            return True
        age = time.time() - self.match_timestamps[match_id]
        return age > MATCH_STALE_TIMEOUT_SECONDS

    def cleanup_stale_matches(self):
        """Remove any stale matches"""
        stale_ids = [mid for mid in self.matches if self.is_match_stale(mid)]
        for match_id in stale_ids:
            print(f"[MatchManager] Cleaning up stale match: {match_id}")
            if match_id in self.matches:
                del self.matches[match_id]
            if match_id in self.connections:
                del self.connections[match_id]
            if match_id in self.match_timestamps:
                del self.match_timestamps[match_id]

    def clear_all_matches(self):
        """Clear all existing matches (MVP: only one match at a time)"""
        for match_id in list(self.matches.keys()):
            if match_id in self.matches:
                del self.matches[match_id]
            if match_id in self.connections:
                del self.connections[match_id]
            if match_id in self.match_timestamps:
                del self.match_timestamps[match_id]
        print(f"[MatchManager] Cleared all matches. Starting fresh.")

    async def create_match(self, match_id: str, p1_id: str, p2_id: str, simulation_mode: bool = False):
        # MVP: Clear any existing matches before starting new one
        self.clear_all_matches()
        
        try:
            # 1. Fetch REAL Data from Firestore
            db = get_db()
            p1_ref = db.collection('wrestlers').document(p1_id).get()
            p2_ref = db.collection('wrestlers').document(p2_id).get()
    
            if not p1_ref.exists or not p2_ref.exists:
                if simulation_mode:
                     raise Exception("Wrestlers not found, falling back to mock")
                else:
                    raise HTTPException(status_code=404, detail="One or more wrestlers not found in DB")
    
            p1_data = p1_ref.to_dict()
            p2_data = p2_ref.to_dict()
            
        except Exception as e:
            if simulation_mode:
                print(f"[MatchManager] DB Error in Sim Mode, using MOCK data: {e}")
                p1_data = {"id": p1_id, "name": "SimBot 1", "strength": 1.2, "technique": 0.8, "speed": 1.0, "weight": 160, "color": "255,0,0"}
                p2_data = {"id": p2_id, "name": "SimBot 2", "strength": 0.9, "technique": 1.1, "speed": 1.1, "weight": 140, "color": "0,0,255"}
            else:
                raise e

        # Inject ID for engine reference
        p1_data['id'] = p1_id
        p2_data['id'] = p2_id

        engine = SumoEngine(simulation_mode=simulation_mode)
        engine.set_wrestlers(p1_data, p2_data)
        
        # PROTOTYPE MODE: Auto-start the fight immediately only if NOT sim mode (sim handles its own tachiai)
        # But actually, sim handles inputs, so force_start is still okay if we want to skip tachiai entirely.
        # However, plan said "Bots auto-resolve Tachiai". Let's let them doing it organically via input injection.
        if not simulation_mode:
            engine.force_start()
        
        self.matches[match_id] = engine
        self.connections[match_id] = []
        self.match_timestamps[match_id] = time.time()  # Track creation time
        
        print(f"[MatchManager] Match {match_id} CREATED. P1={p1_id}, P2={p2_id}, Sim={simulation_mode}")
        
        # Start the Game Loop for this match
        asyncio.create_task(self.game_loop(match_id))
        return match_id

    async def connect(self, websocket: WebSocket, match_id: str):
        await websocket.accept()
        if match_id not in self.connections:
            self.connections[match_id] = []
        self.connections[match_id].append(websocket)
        
        # Send immediate state snapshot so client doesn't wait for next tick
        if match_id in self.matches:
            try:
                state = self.matches[match_id].get_state()
                await websocket.send_json(state)
            except:
                pass

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.connections:
            self.connections[match_id].remove(websocket)

    async def broadcast(self, match_id: str, message: dict):
        if match_id in self.connections:
            # Copy list to avoid modification during iteration issues
            current_conns = list(self.connections[match_id])
            for connection in current_conns:
                try:
                    await connection.send_json(message)
                except:
                    # Broken pipe or closed connection
                    pass

    async def game_loop(self, match_id: str):
        """Standard 60 FPS Loop"""
        engine = self.matches[match_id]
        while not engine.game_over:
            start_time = asyncio.get_event_loop().time()
            
            try:
                # Tick Physics
                state = engine.tick(1/60.0)
                
                # Update activity timestamp
                self.match_timestamps[match_id] = time.time()
                
                # Broadcast State
                await self.broadcast(match_id, state)
            except Exception as e:
                print(f"[MatchManager] Error in game tick: {e}")
                import traceback
                traceback.print_exc()
                # Optionally end match on critical error? 
                # For now, just continue and hope it recovers or next tick works
            
            # Sleep to maintain frame rate
            elapsed = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0, (1/60.0) - elapsed)
            await asyncio.sleep(sleep_time)
            
        # Broadcast Final State
        final_state = engine.get_state()
        await self.broadcast(match_id, final_state)
        
        # Save Match Result to Firestore (wrapped in try/except for robustness)
        try:
            db = get_db()
            
            # Get actual wrestler IDs
            p1_id = str(engine.p1.get('id'))
            p2_id = str(engine.p2.get('id'))
            winner_id = final_state.get('winner')
            loser_id = p2_id if winner_id == p1_id else p1_id
            
            # Update wrestler stats (wins/losses/XP/SP)
            await update_wrestler_stats(winner_id, loser_id)
            
            db.collection('matches').document(match_id).set({
                **engine.get_match_summary(),  # Full event log
                "winner_id": winner_id,
                "loser_id": loser_id,
                "p1_id": p1_id,
                "p2_id": p2_id,
                "timestamp": firestore_module.SERVER_TIMESTAMP,
            })
            print(f"[MatchManager] Match {match_id} saved with {len(engine.match_log)} events. Winner: {winner_id}")
        except Exception as e:
            # In simulation mode without creds, this is expected. Don't spam trace.
            if "DefaultCredentialsError" in str(e):
                 print(f"[MatchManager] Skipping Firestore save (No Creds)")
            else:
                 import traceback
                 traceback.print_exc()
                 print(f"[MatchManager] Failed to save match result: {e}")
        
        # Short grace period for clients to receive Game Over before cleanup
        print(f"[MatchManager] Match {match_id} ended. Waiting 15s grace period...")
        await asyncio.sleep(15.0)
        
        # Cleanup - always runs even if Firestore save fails
        if match_id in self.matches:
            print(f"[MatchManager] cleanup: Removing match {match_id} from memory")
            del self.matches[match_id]
        if match_id in self.match_timestamps:
            del self.match_timestamps[match_id]
        print(f"[MatchManager] Match {match_id} cleaned up successfully")

        if match_id in self.match_timestamps:
            del self.match_timestamps[match_id]
        print(f"[MatchManager] Match {match_id} cleaned up successfully")

manager = MatchManager()

class LobbyManager:
    """Simple in-memory lobby for 2-player setup"""
    def __init__(self):
        self.reset()
        
    def reset(self):
        self.p1 = None  # {id, name, ready}
        self.p2 = None
        self.locked = False
        
    def get_status(self):
        return {
            "p1": self.p1,
            "p2": self.p2,
            "ready_to_start": (self.p1 is not None and self.p2 is not None),
            "locked": self.locked
        }

    def join(self, side: str, wrestler_id: str, wrestler_name: str):
        if self.locked:
            return False
            
        data = {"id": wrestler_id, "name": wrestler_name}
        if side == "p1":
            self.p1 = data
        elif side == "p2":
            self.p2 = data
        return True

lobby_manager = LobbyManager()


# --- Wrestler Stats Update Function ---
async def update_wrestler_stats(winner_id: str, loser_id: str):
    """Update wrestler records after a match ends."""
    try:
        db = get_db()
        
        # Update winner
        winner_ref = db.collection('wrestlers').document(winner_id)
        winner_doc = winner_ref.get()
        if winner_doc.exists:
            w_data = winner_doc.to_dict()
            new_wins = w_data.get("wins", 0) + 1
            new_xp = w_data.get("xp", 0) + XP_BASE_WIN
            new_sp = w_data.get("skill_points", 0) + SP_WIN
            new_streak = w_data.get("win_streak", 0) + 1
            new_matches = w_data.get("matches", 0) + 1
            
            # Calculate new rank
            new_rank_index = 0
            for i, rank in enumerate(WRESTLER_RANKS):
                if new_xp >= rank["xp_required"]:
                    new_rank_index = i
            
            winner_ref.update({
                "wins": new_wins,
                "matches": new_matches,
                "xp": new_xp,
                "skill_points": new_sp,
                "win_streak": new_streak,
                "rank_index": new_rank_index,
                "rank_name": WRESTLER_RANKS[new_rank_index]["name"],
                "rank_jp": WRESTLER_RANKS[new_rank_index]["jp"]
            })
            print(f"[Stats] Winner {winner_id}: +{XP_BASE_WIN}XP, +{SP_WIN}SP, Streak:{new_streak}, Rank:{WRESTLER_RANKS[new_rank_index]['name']}")
        
        # Update loser
        loser_ref = db.collection('wrestlers').document(loser_id)
        loser_doc = loser_ref.get()
        if loser_doc.exists:
            l_data = loser_doc.to_dict()
            new_losses = l_data.get("losses", 0) + 1
            new_xp = l_data.get("xp", 0) + XP_BASE_LOSS
            new_sp = l_data.get("skill_points", 0) + SP_LOSS
            new_matches = l_data.get("matches", 0) + 1
            
            # Calculate new rank  
            new_rank_index = 0
            for i, rank in enumerate(WRESTLER_RANKS):
                if new_xp >= rank["xp_required"]:
                    new_rank_index = i
            
            loser_ref.update({
                "losses": new_losses,
                "matches": new_matches,
                "xp": new_xp,
                "skill_points": new_sp,
                "win_streak": 0,  # Reset streak on loss
                "rank_index": new_rank_index,
                "rank_name": WRESTLER_RANKS[new_rank_index]["name"],
                "rank_jp": WRESTLER_RANKS[new_rank_index]["jp"]
            })
            print(f"[Stats] Loser {loser_id}: +{XP_BASE_LOSS}XP, +{SP_LOSS}SP")
            
    except Exception as e:
        print(f"[Stats] Error updating wrestler stats: {e}")
        # Don't fail the match if stats update fails
        import traceback
        traceback.print_exc()


# --- API Models ---
class CreateMatchRequest(BaseModel):
    p1_id: str # Now expecting Firestore specific String IDs
    p2_id: str

class ActionRequest(BaseModel):
    player_id: str
    action: str 

# --- REST Endpoints ---

# --- REST Endpoints ---

@app.get("/")
async def root():
    return {"status": "online", "service": "Sumo Cloud Backend", "region": "global"}

@app.get("/api/status")
async def get_status():
    """Returns the current game status for the controller to poll."""
    # Auto-cleanup stale matches first
    manager.cleanup_stale_matches()
    
    if manager.matches:
        # Check if any match is still running (not game_over)
        for match_id, engine in manager.matches.items():
            if not engine.game_over:
                return {"status": "FIGHTING", "match_id": match_id}
        return {"status": "IDLE"}
    return {"status": "IDLE"}

# --- Wrestler CRUD (Restored & Adapted for Firestore) ---

@app.get("/api/wrestlers")
async def get_wrestlers():
    db = get_db()
    docs = db.collection('wrestlers').stream()
    # Convert to list
    wrestlers = []
    for doc in docs:
        d = doc.to_dict()
        d['id'] = doc.id # Ensure ID is present
        wrestlers.append(d)
    return wrestlers

@app.get("/api/wrestlers/{w_id}")
async def get_wrestler(w_id: str):
    db = get_db()
    doc = db.collection('wrestlers').document(w_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Wrestler not found")
    data = doc.to_dict()
    data['id'] = doc.id
    return data

@app.get("/api/matches/active")
async def get_active_match():
    """Returns the first active match ID for TV spectators to auto-connect."""
    # Auto-cleanup stale matches first
    manager.cleanup_stale_matches()
    
    if manager.matches:
        # Return first active match that isn't stale
        for match_id in manager.matches.keys():
            if not manager.is_match_stale(match_id):
                return {"match_id": match_id, "status": "active"}
    return {"match_id": None, "status": "idle"}

@app.post("/api/matches/clear")
async def clear_all_matches():
    """Admin endpoint to force clear all matches. Useful for resetting stuck state."""
    count = len(manager.matches)
    manager.clear_all_matches()
    return {"success": True, "cleared": count, "message": "All matches cleared"}

@app.post("/api/wrestlers")
async def create_wrestler(w: dict):
    try:
        # Minimal implementation to accept data or generate random
        # In a real app, use Pydantic model for validation
        db = get_db()
        
        # If seeding from migration script, use provided ID if present
        if 'id' in w:
            doc_ref = db.collection('wrestlers').document(str(w['id']))
            w_copy = w.copy()
            del w_copy['id'] 
            doc_ref.set(w_copy)
            return {"id": doc_ref.id, **w_copy}
        
        # Else auto-generate
        names_first = ["Chiyo", "Haku", "Taka", "Waka", "Tochi", "Koto", "Asa", "Haru", "Aki", "Fuyu"]
        names_last = ["hu", "ho", "soryu", "yama", "umi", "nishiki", "fuji", "gawa", "maru", "tenro"]
        
        name = w.get("name") or (random.choice(names_first) + random.choice(names_last))
        avatar_seed = int(time.time() * 1000) % 1000000
        
        # Complete wrestler initialization with all progression fields
        data = {
            "name": name,
            "custom_name": w.get("custom_name"),
            "stable": w.get("stable", "Tatsunami"),
            "height": w.get("height", round(175 + random.random() * 20)),
            "weight": w.get("weight", round(120 + random.random() * 60)),
            "strength": w.get("strength", round(0.8 + random.random() * 0.4, 2)),
            "technique": w.get("technique", round(0.8 + random.random() * 0.4, 2)),
            "speed": w.get("speed", round(0.8 + random.random() * 0.4, 2)),
            "color": w.get("color", "255,0,0"),
            # Core stats
            "wins": 0,
            "losses": 0,
            "matches": 0,
            # Progression
            "xp": 0,
            "skill_points": 3,  # Start with some SP for tutorial
            "rank_index": 0,
            "rank_name": "Jonokuchi",
            "rank_jp": "序ノ口",
            "win_streak": 0,
            # Skills
            "unlocked_skills": [],
            "total_bonuses": {},
            "fighting_style": None,
            # Profile
            "avatar_seed": avatar_seed,
            "bio": f"{w.get('custom_name') or name} is a rising star in sumo wrestling.",
            "is_active": True
        }
        
        update_time, doc_ref = db.collection('wrestlers').add(data)
        print(f"[Create] New wrestler '{data['name']}' created with ID {doc_ref.id}, SP={data['skill_points']}")
        return {"id": doc_ref.id, **data}
    except Exception as e:
        print(f"Error creating wrestler: {e}")
        # Return error details for debugging (disable in strict prod)
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@app.delete("/api/wrestlers/{w_id}")
async def delete_wrestler(w_id: str):
    """Delete a wrestler by ID."""
    db = get_db()
    doc = db.collection('wrestlers').document(w_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Wrestler not found")
    db.collection('wrestlers').document(w_id).delete()
    return {"success": True, "id": w_id}

@app.get("/api/history")
async def get_history(wrestler_id: str = None, limit: int = 10):
    """Get match history, optionally filtered by wrestler ID."""
    db = get_db()
    query = db.collection('matches').order_by('timestamp', direction=firestore_module.Query.DESCENDING).limit(limit)
    
    matches = []
    for doc in query.stream():
        data = doc.to_dict()
        data['id'] = doc.id
        # Skip demo matches
        if doc.id.startswith('demo-') or doc.id.startswith('sim-'):
            continue
        # Filter by wrestler if specified
        if wrestler_id:
            if str(data.get('p1_id')) != str(wrestler_id) and str(data.get('p2_id')) != str(wrestler_id):
                continue
        matches.append(data)
    return matches

@app.get("/api/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed match data including event log."""
    db = get_db()
    doc = db.collection('matches').document(match_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Match not found")
    data = doc.to_dict()
    data['id'] = doc.id
    return data

@app.get("/api/skills")
async def get_skills():
    """Get the skill tree definition."""
    # Return a basic skill tree structure
    return {
        "strength": {
            "name": "Strength",
            "jp": "力",
            "description": "Raw pushing power",
            "color": "220,50,50",
            "skills": [
                {"id": "str_1", "name": "Iron Grip", "jp": "鉄握", "desc": "+10% push force", "tier": 1, "cost": 1, "effect": {"strength": 0.1}},
                {"id": "str_2", "name": "Mountain Push", "jp": "山押し", "desc": "+15% push force", "tier": 2, "cost": 2, "effect": {"strength": 0.15}},
                {"id": "str_3", "name": "Yokozuna Force", "jp": "横綱力", "desc": "+20% push force", "tier": 3, "cost": 3, "effect": {"strength": 0.2}}
            ]
        },
        "technique": {
            "name": "Technique", 
            "jp": "技",
            "description": "Grappling skill",
            "color": "50,150,220",
            "skills": [
                {"id": "tech_1", "name": "Quick Hands", "jp": "速手", "desc": "+10% grab speed", "tier": 1, "cost": 1, "effect": {"technique": 0.1}},
                {"id": "tech_2", "name": "Belt Master", "jp": "帯師", "desc": "+15% grab success", "tier": 2, "cost": 2, "effect": {"technique": 0.15}},
                {"id": "tech_3", "name": "Kimarite Master", "jp": "決まり手", "desc": "+20% success", "tier": 3, "cost": 3, "effect": {"technique": 0.2}}
            ]
        },
        "speed": {
            "name": "Speed",
            "jp": "速",
            "description": "Movement and reaction",
            "color": "50,220,100",
            "skills": [
                {"id": "spd_1", "name": "Quick Step", "jp": "速歩", "desc": "+10% movement", "tier": 1, "cost": 1, "effect": {"speed": 0.1}},
                {"id": "spd_2", "name": "Lightning Dash", "jp": "雷走", "desc": "+15% movement", "tier": 2, "cost": 2, "effect": {"speed": 0.15}},
                {"id": "spd_3", "name": "God Speed", "jp": "神速", "desc": "+20% movement", "tier": 3, "cost": 3, "effect": {"speed": 0.2}}
            ]
        }
    }

@app.get("/api/wrestlers/{w_id}/skills")
async def get_wrestler_skills(w_id: str):
    """Get a wrestler's unlocked skills."""
    db = get_db()
    doc = db.collection('wrestlers').document(w_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Wrestler not found")
    data = doc.to_dict()
    
    # Transform skill data to match frontend expectations
    # Backend stores: {"skill_id": "str_1", "unlocked_at": "..."}
    # Frontend expects: {"id": "str_1", ...}
    raw_skills = data.get("unlocked_skills", [])
    transformed_skills = []
    for s in raw_skills:
        if isinstance(s, dict):
            skill_id = s.get("skill_id") or s.get("id")
            unlocked_at = s.get("unlocked_at", "")
        else:
            skill_id = s
            unlocked_at = ""
        transformed_skills.append({
            "id": skill_id,
            "skill_id": skill_id,  # Keep for backward compat
            "unlocked_at": unlocked_at
        })
    
    return {
        "skill_points": data.get("skill_points", 0),
        "unlocked_skills": transformed_skills,
        "total_bonuses": data.get("total_bonuses", {})
    }


def get_skill_tree_sync():
    """Synchronous version of skill tree for internal use."""
    return {
        "strength": {
            "name": "Strength", "jp": "力", "description": "Raw pushing power", "color": "220,50,50",
            "skills": [
                {"id": "str_1", "name": "Iron Grip", "jp": "鉄握", "desc": "+10% push force", "tier": 1, "cost": 1, "effect": {"strength": 0.1}},
                {"id": "str_2", "name": "Mountain Push", "jp": "山押し", "desc": "+15% push force", "tier": 2, "cost": 2, "effect": {"strength": 0.15}},
                {"id": "str_3", "name": "Yokozuna Force", "jp": "横綱力", "desc": "+20% push force", "tier": 3, "cost": 3, "effect": {"strength": 0.2}}
            ]
        },
        "technique": {
            "name": "Technique", "jp": "技", "description": "Grappling skill", "color": "50,150,220",
            "skills": [
                {"id": "tech_1", "name": "Quick Hands", "jp": "速手", "desc": "+10% grab speed", "tier": 1, "cost": 1, "effect": {"technique": 0.1}},
                {"id": "tech_2", "name": "Belt Master", "jp": "帯師", "desc": "+15% grab success", "tier": 2, "cost": 2, "effect": {"technique": 0.15}},
                {"id": "tech_3", "name": "Kimarite Master", "jp": "決まり手", "desc": "+20% success", "tier": 3, "cost": 3, "effect": {"technique": 0.2}}
            ]
        },
        "speed": {
            "name": "Speed", "jp": "速", "description": "Movement and reaction", "color": "50,220,100",
            "skills": [
                {"id": "spd_1", "name": "Quick Step", "jp": "速歩", "desc": "+10% movement", "tier": 1, "cost": 1, "effect": {"speed": 0.1}},
                {"id": "spd_2", "name": "Lightning Dash", "jp": "雷走", "desc": "+15% movement", "tier": 2, "cost": 2, "effect": {"speed": 0.15}},
                {"id": "spd_3", "name": "God Speed", "jp": "神速", "desc": "+20% movement", "tier": 3, "cost": 3, "effect": {"speed": 0.2}}
            ]
        }
    }


@app.post("/api/wrestlers/{w_id}/skills/{skill_id}")
async def unlock_skill(w_id: str, skill_id: str):
    """Unlock a skill for a wrestler."""
    db = get_db()
    doc_ref = db.collection('wrestlers').document(w_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Wrestler not found")
    
    data = doc.to_dict()
    skill_points = data.get("skill_points", 0)
    
    # Get actual skill cost from skill tree
    skill_tree = get_skill_tree_sync()
    cost = 1  # Default
    for branch in skill_tree.values():
        for skill in branch.get("skills", []):
            if skill.get("id") == skill_id:
                cost = skill.get("cost", 1)
                break
    
    if skill_points < cost:
        raise HTTPException(status_code=400, detail=f"Not enough skill points. Need {cost}, have {skill_points}")
    
    unlocked = data.get("unlocked_skills", [])
    existing_ids = [s.get("skill_id") if isinstance(s, dict) else s for s in unlocked]
    if skill_id in existing_ids:
        raise HTTPException(status_code=400, detail="Skill already unlocked")
    
    unlocked.append({"skill_id": skill_id, "unlocked_at": str(time.time())})
    new_sp = skill_points - cost
    
    doc_ref.update({
        "skill_points": new_sp,
        "unlocked_skills": unlocked
    })
    
    print(f"[Skill] Wrestler {w_id} unlocked '{skill_id}' for {cost} SP. Remaining: {new_sp}")
    return {"success": True, "skill_id": skill_id, "cost": cost, "remaining_sp": new_sp}

@app.post("/api/fight/action")
async def fight_action(req: dict):
    """Handle in-fight actions like KIAI."""
    wrestler_id = req.get("wrestler_id")
    action = req.get("action")
    
    # Debug: Log incoming action request
    print(f"[FightAction] Received: wrestler_id='{wrestler_id}', action='{action}'")
    
    # Find the active match with this wrestler
    for match_id, engine in manager.matches.items():
        p1_id = str(engine.p1.get('id'))
        p2_id = str(engine.p2.get('id'))
        
        # Debug: Log ID comparison
        print(f"[FightAction] Match {match_id}: p1_id='{p1_id}', p2_id='{p2_id}', checking '{wrestler_id}'")
        
        if p1_id == str(wrestler_id) or p2_id == str(wrestler_id):
            engine.handle_input(str(wrestler_id), action.upper() if action else "PUSH")
            return {"success": True, "match_id": match_id, "action": action}
    
    print(f"[FightAction] WARN: No match found for wrestler_id='{wrestler_id}'")
    return {"success": False, "error": "No active match for this wrestler"}

@app.post("/api/match")
async def start_match(req: CreateMatchRequest):
    """
    Initializes a match on the cloud server.
    Validates wrestlers against Firestore.
    """
    # Create a simpler ID or use UUID
    match_id = f"m-{int(time.time())}"
    
    try:
        await manager.create_match(match_id, req.p1_id, req.p2_id)
    except Exception as e:
         # Propagate the 404 or other errors
         raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "match_id": match_id,
        "ws_url": f"/ws/{match_id}", # Client app prepends domain
        "watch_url": f"https://your-app-domain.com/watch/{match_id}"
    }

@app.post("/api/match/simulate")
async def start_simulation():
    """
    Starts an automated match between two random wrestlers (or mocked ones).
    Useful for testing physics without manual input.
    """
    # Auto-select two arbitrary IDs for now, or fetch from DB
    p1_id = "test_bot_1"
    p2_id = "test_bot_2"
    
    # In simulation mode, we don't strictly need real DB wrestlers if we have the fallback.
    # So let's skip the DB query here to avoid the Auth error before even calling create_match.
    
    match_id = f"sim-{int(time.time())}"
    
    try:
        await manager.create_match(match_id, p1_id, p2_id, simulation_mode=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "status": "success",
        "match_id": match_id,
        "watch_url": f"/watch"
    }

# --- Lobby Endpoints (Remote 2P) ---

@app.get("/api/lobby/status")
async def get_lobby_status():
    return lobby_manager.get_status()

class JoinLobbyRequest(BaseModel):
    side: str # "p1" or "p2"
    wrestler_id: str
    wrestler_name: str

@app.post("/api/lobby/join")
async def join_lobby(req: JoinLobbyRequest):
    if req.side not in ["p1", "p2"]:
        raise HTTPException(status_code=400, detail="Invalid side")
        
    success = lobby_manager.join(req.side, req.wrestler_id, req.wrestler_name)
    if not success:
        raise HTTPException(status_code=400, detail="Lobby is locked or unavailable")
    return {"success": True, "status": lobby_manager.get_status()}

@app.post("/api/lobby/reset")
async def reset_lobby():
    lobby_manager.reset()
    return {"success": True}

@app.post("/api/lobby/start")
async def start_lobby_match():
    status = lobby_manager.get_status()
    if not status["ready_to_start"]:
        raise HTTPException(status_code=400, detail="Not all players ready")
        
    # Start match!
    p1_id = status["p1"]["id"]
    p2_id = status["p2"]["id"]
    
    # Create simple match ID
    match_id = f"m-{int(time.time())}"
    await manager.create_match(match_id, p1_id, p2_id)
    
    # Lock lobby so others don't overwrite
    lobby_manager.locked = True
    
    return {"success": True, "match_id": match_id}

# --- Demo Simulation for Watch Page ---
# Persistent demo engine for background simulation on watch page
_demo_engine = None
_demo_last_tick = 0.0

def _get_demo_engine():
    """Get or create the demo simulation engine."""
    global _demo_engine, _demo_last_tick
    
    # Create new engine if none exists or game is over
    if _demo_engine is None or _demo_engine.game_over:
        _demo_engine = SumoEngine(simulation_mode=True)
        # Set up demo wrestlers with fun names
        _demo_engine.set_wrestlers(
            {"id": "demo_p1", "name": "DEMO EAST", "custom_name": "Demo Bot", "strength": 1.1, "technique": 0.9, "speed": 1.0, "weight": 160, "color": "120,180,255", "avatar_seed": 12345},
            {"id": "demo_p2", "name": "DEMO WEST", "custom_name": "Bot Demo", "strength": 0.9, "technique": 1.1, "speed": 1.0, "weight": 150, "color": "255,150,100", "avatar_seed": 54321}
        )
        _demo_engine.force_start()
        _demo_last_tick = time.time()
    
    return _demo_engine

@app.get("/api/demo/state")
async def get_demo_state():
    """
    Returns simulated match state for the watch page demo mode.
    The watch page can poll this to show a background demo fight while waiting for a real match.
    """
    global _demo_last_tick
    
    engine = _get_demo_engine()
    
    # Calculate delta time since last tick
    now = time.time()
    dt = min(now - _demo_last_tick, 0.1)  # Cap at 100ms to avoid huge jumps
    _demo_last_tick = now
    
    # Tick the simulation
    if not engine.game_over:
        engine.tick(dt)
    
    # Get state and add demo flag
    state = engine.get_state()
    state['is_demo'] = True
    state['demo_label'] = 'DEMO MATCH'
    
    return state

@app.post("/api/match/{match_id}/action")
async def send_action(match_id: str, req: ActionRequest):
    """HTTP endpoint for inputs (Optional, WS preferred for latency)"""
    if match_id in manager.matches:
        engine = manager.matches[match_id]
        engine.handle_input(req.player_id, req.action)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Match not found")

# --- WebSocket Endpoint ---

@app.websocket("/ws/{match_id}")
async def websocket_endpoint(websocket: WebSocket, match_id: str):
    """
    Single stream for both Controller (Inputs) and Spectator (View)
    """
    await manager.connect(websocket, match_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle incoming inputs via WS (lower latency than HTTP)
            if "action" in data:
                if match_id in manager.matches:
                    manager.matches[match_id].handle_input(data.get("id"), data.get("action"))
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
