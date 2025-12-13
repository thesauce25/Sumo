import asyncio
import time
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import firestore as firestore_module

# Import our new Engine and Services
from app.core.engine import SumoEngine
from app.services.firebase import get_db

app = FastAPI(title="Sumo Serverless API")

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
            
            # Tick Physics
            state = engine.tick(1/60.0)
            
            # Update activity timestamp
            self.match_timestamps[match_id] = time.time()
            
            # Broadcast State
            await self.broadcast(match_id, state)
            
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
            db.collection('matches').document(match_id).set({
                "winner_id": final_state['winner'],
                "timestamp": firestore_module.SERVER_TIMESTAMP,
                "log": "Game completed successfully"
            })
        except Exception as e:
            # In simulation mode without creds, this is expected. Don't spam trace.
            if "DefaultCredentialsError" in str(e):
                 print(f"[MatchManager] Skipping Firestore save (No Creds)")
            else:
                 import traceback
                 traceback.print_exc()
                 print(f"[MatchManager] Failed to save match result: {e}")
        
        # Cleanup - always runs even if Firestore save fails
        if match_id in self.matches:
            print(f"[MatchManager] cleanup: Removing match {match_id} from memory")
            del self.matches[match_id]
        if match_id in self.match_timestamps:
            del self.match_timestamps[match_id]
        print(f"[MatchManager] Match {match_id} cleaned up successfully")

manager = MatchManager()

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
        import random
        names_first = ["Chiyo", "Haku", "Taka", "Waka", "Tochi", "Koto"]
        names_last = ["hu", "ho", "soryu", "yama", "umi", "nishiki"]
        
        name = w.get("name") or (random.choice(names_first) + random.choice(names_last))
        data = {
            "name": name,
            "stable": w.get("stable", "Tatsunami"),
            "height": w.get("height", 185),
            "weight": w.get("weight", 150),
            "strength": w.get("strength", 1.0),
            "technique": w.get("technique", 1.0),
            "speed": w.get("speed", 1.0),
            "color": w.get("color", "255,0,0"),
            "wins": 0,
            "losses": 0,
            "rank_index": 0
        }
        
        update_time, doc_ref = db.collection('wrestlers').add(data)
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
async def get_history(wrestler_id: str = None):
    """Get match history, optionally filtered by wrestler ID."""
    db = get_db()
    # Note: In a full implementation, you'd query a 'matches' collection
    # For now, return empty array as placeholder
    return []

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
                {"id": "str_2", "name": "Mountain Push", "jp": "山押し", "desc": "+15% push force", "tier": 2, "cost": 2, "effect": {"strength": 0.15}}
            ]
        },
        "technique": {
            "name": "Technique", 
            "jp": "技",
            "description": "Grappling skill",
            "color": "50,150,220",
            "skills": [
                {"id": "tech_1", "name": "Quick Hands", "jp": "速手", "desc": "+10% grab speed", "tier": 1, "cost": 1, "effect": {"technique": 0.1}},
                {"id": "tech_2", "name": "Belt Master", "jp": "帯師", "desc": "+15% grab success", "tier": 2, "cost": 2, "effect": {"technique": 0.15}}
            ]
        },
        "speed": {
            "name": "Speed",
            "jp": "速",
            "description": "Movement and reaction",
            "color": "50,220,100",
            "skills": [
                {"id": "spd_1", "name": "Quick Step", "jp": "速歩", "desc": "+10% movement", "tier": 1, "cost": 1, "effect": {"speed": 0.1}},
                {"id": "spd_2", "name": "Lightning Dash", "jp": "雷走", "desc": "+15% movement", "tier": 2, "cost": 2, "effect": {"speed": 0.15}}
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
    return {
        "skill_points": data.get("skill_points", 0),
        "unlocked_skills": data.get("unlocked_skills", []),
        "total_bonuses": data.get("total_bonuses", {})
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
    
    # Simple cost of 1 for now
    cost = 1
    if skill_points < cost:
        raise HTTPException(status_code=400, detail="Not enough skill points")
    
    unlocked = data.get("unlocked_skills", [])
    if skill_id in [s.get("skill_id") if isinstance(s, dict) else s for s in unlocked]:
        raise HTTPException(status_code=400, detail="Skill already unlocked")
    
    unlocked.append({"skill_id": skill_id, "unlocked_at": str(time.time())})
    doc_ref.update({
        "skill_points": skill_points - cost,
        "unlocked_skills": unlocked
    })
    
    return {"success": True, "skill_id": skill_id, "cost": cost}

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
        "status": "simulation_started",
        "match_id": match_id,
        "mode": "auto_bot_battle",
        "watch_url": f"/watch"
    }

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
