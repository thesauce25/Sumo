from typing import Dict, Any, Tuple, Optional
import math
import time

class SumoEngine:
    """
    Pure Python Game Engine.
    No Flask, No Hardware, No IO. Just Physics.
    """
    def __init__(self):
        # Constants
        self.WIDTH = 64
        self.HEIGHT = 32
        self.CENTER_X = self.WIDTH / 2
        self.CENTER_Y = self.HEIGHT / 2
        
        # State
        self.paused = False
        self.game_over = False
        self.winner_id = None
        self.timestamp = 0
        
        # Wrestler 1 (Left)
        self.p1 = {
            "id": "p1",
            "x": self.CENTER_X - 10,
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "state": "IDLE"
        }
        
        # Wrestler 2 (Right)
        self.p2 = {
            "id": "p2",
            "x": self.CENTER_X + 10,
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "state": "IDLE"
        }
        
    def set_wrestlers(self, p1_data: Dict, p2_data: Dict):
        """Initialize wrestlers from DB data without overwriting physics state"""
        # Only copy non-physics attributes from DB
        safe_keys = ['id', 'name', 'custom_name', 'color', 'strength', 'technique', 'speed', 'stable']
        for key in safe_keys:
            if key in p1_data:
                self.p1[key] = p1_data[key]
            if key in p2_data:
                self.p2[key] = p2_data[key]

    def handle_input(self, player_id: str, action: str):
        """Handle control inputs (processed on next tick)"""
        target = None
        if player_id == self.p1['id']: target = self.p1
        if player_id == self.p2['id']: target = self.p2
        
        if target and action == "PUSH":
            # Simple physics impulse
            target['vx'] += 1.5 if target == self.p1 else -1.5
            
    def tick(self, dt: float) -> Dict[str, Any]:
        """
        Advance the simulation by dt seconds.
        Returns the snapshot state.
        """
        if self.game_over:
            return self.get_state()

        self.timestamp += dt
        
        # 1. Apply Physics (Simplified for skeleton)
        for p in [self.p1, self.p2]:
            # Apply Friction
            p['vx'] *= 0.9
            p['vy'] *= 0.9
            
            # Update Position
            p['x'] += p['vx']
            p['y'] += p['vy']
            
        # 2. Collision Detection
        dist = math.sqrt((self.p1['x'] - self.p2['x'])**2 + (self.p1['y'] - self.p2['y'])**2)
        if dist < 4.0: # Collision logic
            pass # TODO: Implement full sumo physics
            
        # 3. Win Condition (Ring Out)
        # Ring radius approx 14px
        dist_from_center_p1 = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2)
        if dist_from_center_p1 > 14:
            self.game_over = True
            self.winner_id = self.p2['id']

        return self.get_state()

    def get_state(self) -> Dict[str, Any]:
        return {
            "t": self.timestamp,
            "game_over": self.game_over,
            "winner": self.winner_id,
            "p1": self.p1,
            "p2": self.p2
        }
