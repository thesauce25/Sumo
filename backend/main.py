import asyncio
import time
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# --- In-Memory State Manager ---
class MatchManager:
    def __init__(self):
        # Maps match_id -> active SumoEngine
        self.matches: Dict[str, SumoEngine] = {}
        # Maps match_id -> List of WebSockets
        self.connections: Dict[str, List[WebSocket]] = {}

    async def create_match(self, match_id: str, p1_id: str, p2_id: str):
        # 1. Fetch REAL Data from Firestore
        db = get_db()
        p1_ref = db.collection('wrestlers').document(p1_id).get()
        p2_ref = db.collection('wrestlers').document(p2_id).get()

        if not p1_ref.exists or not p2_ref.exists:
            raise HTTPException(status_code=404, detail="One or more wrestlers not found in DB")

        p1_data = p1_ref.to_dict()
        p2_data = p2_ref.to_dict()
        
        # Inject ID for engine reference
        p1_data['id'] = p1_id
        p2_data['id'] = p2_id

        engine = SumoEngine()
        engine.set_wrestlers(p1_data, p2_data)
        self.matches[match_id] = engine
        self.connections[match_id] = []
        
        # Start the Game Loop for this match
        asyncio.create_task(self.game_loop(match_id))
        return match_id

    async def connect(self, websocket: WebSocket, match_id: str):
        await websocket.accept()
        if match_id not in self.connections:
            self.connections[match_id] = []
        self.connections[match_id].append(websocket)

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
            
            # Broadcast State
            await self.broadcast(match_id, state)
            
            # Sleep to maintain frame rate
            elapsed = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0, (1/60.0) - elapsed)
            await asyncio.sleep(sleep_time)
            
        # Broadcast Final State
        final_state = engine.get_state()
        await self.broadcast(match_id, final_state)
        
        # OPTIONAL: Save Match Result to Firestore
        db = get_db()
        db.collection('matches').document(match_id).set({
            "winner_id": final_state['winner'],
            "timestamp": firestore.SERVER_TIMESTAMP,
            "log": "Game completed successfully"
        })
        
        # Cleanup
        del self.matches[match_id]

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
    if manager.matches:
        # Return first active match
        match_id = next(iter(manager.matches.keys()))
        return {"match_id": match_id, "status": "active"}
    return {"match_id": None, "status": "idle"}

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
