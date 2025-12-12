from typing import Dict, Any, List
import math
import random

# Skill definitions for visual feedback
SKILL_MOVES = {
    "OSHI": [
        {"id": "oshidashi", "name": "OSHIDASHI!", "jp": "押し出し", "stat": "strength"},
        {"id": "tsukidashi", "name": "THRUST!", "jp": "突き出し", "stat": "strength"},
    ],
    "YORI": [
        {"id": "yorikiri", "name": "YORIKIRI!", "jp": "寄り切り", "stat": "strength"},
        {"id": "yoritaoshi", "name": "FORCE DOWN!", "jp": "寄り倒し", "stat": "technique"},
    ],
    "NAGE": [
        {"id": "uwatenage", "name": "THROW!", "jp": "上手投げ", "stat": "technique"},
        {"id": "kotenage", "name": "ARM LOCK!", "jp": "小手投げ", "stat": "technique"},
    ],
    "KAKE": [
        {"id": "sotogake", "name": "LEG TRIP!", "jp": "外掛け", "stat": "speed"},
        {"id": "ketaguri", "name": "ANKLE SWEEP!", "jp": "蹴手繰り", "stat": "speed"},
    ],
    "HINERI": [
        {"id": "makiotoshi", "name": "TWIST DOWN!", "jp": "巻き落とし", "stat": "technique"},
    ],
    "GENERIC": [
        {"id": "kiai", "name": "KIAI!", "jp": "気合", "stat": "strength"},
        {"id": "push", "name": "PUSH!", "jp": "押し", "stat": "strength"},
        {"id": "resist", "name": "RESIST!", "jp": "堪え", "stat": "mass"},
    ]
}

class SumoEngine:
    """
    Pure Python Game Engine.
    No Flask, No Hardware, No IO. Just Physics.
    """
    # --- Physics Constants (TUNED FOR 20-30s MATCHES) ---
    RING_RADIUS = 14.0
    WRESTLER_RADIUS = 2.0
    FRICTION = 0.94  # Higher = more sliding, slower deceleration
    PUSH_FORCE_BASE = 0.025  # Very gradual natural push during collision
    COLLISION_PUSHBACK = 0.5  # How much wrestlers bounce off each other
    MIN_COLLISION_DIST = 4.5  # Slightly larger collision zone
    
    # Skill trigger settings
    SKILL_COOLDOWN = 1.2  # Seconds between skill triggers (more frequent)
    SKILL_TRIGGER_CHANCE = 0.20  # Higher chance for more action
    
    def __init__(self):
        self.WIDTH = 64
        self.HEIGHT = 32
        self.CENTER_X = self.WIDTH / 2
        self.CENTER_Y = self.HEIGHT / 2
        
        # State
        self.paused = False
        self.game_over = False
        self.winner_id = None
        self.winner_name = None
        self.timestamp = 0
        self.collision_this_frame = False
        
        # Skill event system
        self.pending_events: List[Dict[str, Any]] = []
        self.last_skill_time = 0
        
        # Wrestler 1 (Left)
        self.p1 = {
            "id": "p1",
            "x": self.CENTER_X - 10,
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "state": "IDLE",
            "strength": 1.0,
            "technique": 1.0,
            "speed": 1.0,
            "mass": 1.0
        }
        
        # Wrestler 2 (Right)
        self.p2 = {
            "id": "p2",
            "x": self.CENTER_X + 10,
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "state": "IDLE",
            "strength": 1.0,
            "technique": 1.0,
            "speed": 1.0,
            "mass": 1.0
        }
        
    def set_wrestlers(self, p1_data: Dict, p2_data: Dict):
        """Initialize wrestlers from DB data"""
        safe_keys = ['id', 'name', 'custom_name', 'color', 'stable', 'avatar_seed']
        for key in safe_keys:
            if key in p1_data:
                self.p1[key] = p1_data[key]
            if key in p2_data:
                self.p2[key] = p2_data[key]
        
        # Stats that affect physics
        self.p1['strength'] = float(p1_data.get('strength', 1.0))
        self.p1['technique'] = float(p1_data.get('technique', 1.0))
        self.p1['speed'] = float(p1_data.get('speed', 1.0))
        self.p1['mass'] = float(p1_data.get('weight', 150)) / 150.0
        
        self.p2['strength'] = float(p2_data.get('strength', 1.0))
        self.p2['technique'] = float(p2_data.get('technique', 1.0))
        self.p2['speed'] = float(p2_data.get('speed', 1.0))
        self.p2['mass'] = float(p2_data.get('weight', 150)) / 150.0

    def handle_input(self, player_id: str, action: str):
        """Handle control inputs"""
        target = None
        opponent = None
        if player_id == self.p1['id']: 
            target = self.p1
            opponent = self.p2
        if player_id == self.p2['id']: 
            target = self.p2
            opponent = self.p1
        
        if target and action in ("PUSH", "KIAI"):
            dx = opponent['x'] - target['x']
            dy = opponent['y'] - target['y']
            dist = math.sqrt(dx*dx + dy*dy) or 1.0
            
            # Reduced force for longer matches - player input matters but isn't overwhelming
            force = 0.8 * target.get('strength', 1.0)
            target['vx'] += (dx / dist) * force
            target['vy'] += (dy / dist) * force * 0.2  # Less vertical movement
            
    def _trigger_skill_event(self, wrestler: Dict, opponent: Dict, dominance: float):
        """Trigger a skill popup based on wrestler stats and situation"""
        if self.timestamp - self.last_skill_time < self.SKILL_COOLDOWN:
            return
            
        # Determine best stat for this wrestler
        stats = {
            "strength": wrestler.get('strength', 1.0),
            "technique": wrestler.get('technique', 1.0),
            "speed": wrestler.get('speed', 1.0),
        }
        best_stat = max(stats, key=stats.get)
        
        # Pick a skill category based on dominance and stats
        if dominance > 0.2:  # Wrestler is winning
            if best_stat == "strength":
                category = random.choice(["OSHI", "YORI", "GENERIC"])
            elif best_stat == "technique":
                category = random.choice(["NAGE", "HINERI", "YORI"])
            else:
                category = random.choice(["KAKE", "GENERIC"])
        else:
            category = "GENERIC"
        
        skill = random.choice(SKILL_MOVES.get(category, SKILL_MOVES["GENERIC"]))
        
        # Create event
        wrestler_name = wrestler.get('custom_name') or wrestler.get('name', 'Unknown')
        self.pending_events.append({
            "type": "skill",
            "wrestler_id": wrestler['id'],
            "wrestler_name": wrestler_name,
            "skill_name": skill["name"],
            "skill_jp": skill["jp"],
            "timestamp": self.timestamp
        })
        self.last_skill_time = self.timestamp
            
    def tick(self, dt: float) -> Dict[str, Any]:
        """Advance the simulation by dt seconds."""
        if self.game_over:
            return self.get_state()

        self.timestamp += dt
        self.collision_this_frame = False
        self.pending_events = []  # Clear events each frame
        
        # 1. Apply Physics
        for p in [self.p1, self.p2]:
            p['vx'] *= self.FRICTION
            p['vy'] *= self.FRICTION
            p['x'] += p['vx']
            p['y'] += p['vy']
            
        # 2. Collision Detection & Resolution
        dx = self.p2['x'] - self.p1['x']
        dy = self.p2['y'] - self.p1['y']
        dist = math.sqrt(dx*dx + dy*dy)
        
        if dist < self.MIN_COLLISION_DIST and dist > 0:
            self.collision_this_frame = True
            
            # Normalize collision vector
            nx = dx / dist
            ny = dy / dist
            
            # Push wrestlers apart (prevents overlap)
            overlap = self.MIN_COLLISION_DIST - dist
            push_dist = overlap / 2.0
            
            self.p1['x'] -= nx * push_dist
            self.p1['y'] -= ny * push_dist
            self.p2['x'] += nx * push_dist
            self.p2['y'] += ny * push_dist
            
            # Apply collision "bounce" - wrestlers push back against each other
            # This creates the feeling of resistance and struggle
            relative_vx = self.p1['vx'] - self.p2['vx']
            self.p1['vx'] -= relative_vx * self.COLLISION_PUSHBACK * 0.5
            self.p2['vx'] += relative_vx * self.COLLISION_PUSHBACK * 0.5
            
            # Force differential (who's winning the push based on stats)
            f1 = (self.p1.get('strength', 1.0) * self.p1.get('technique', 1.0)) / self.p2.get('mass', 1.0)
            f2 = (self.p2.get('strength', 1.0) * self.p2.get('technique', 1.0)) / self.p1.get('mass', 1.0)
            force_diff = (f1 - f2) * self.PUSH_FORCE_BASE
            
            # Apply gradual push (this is the slow grinding motion)
            self.p1['vx'] += force_diff
            self.p2['vx'] += force_diff
            
            # Jitter for visual tension
            jitter = random.uniform(-0.15, 0.15)
            self.p1['y'] += jitter
            self.p2['y'] += jitter
            
            # Skill trigger chance
            if random.random() < self.SKILL_TRIGGER_CHANCE:
                # Determine who's dominating
                p1_distance = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2)
                p2_distance = math.sqrt((self.p2['x'] - self.CENTER_X)**2 + (self.p2['y'] - self.CENTER_Y)**2)
                
                if p2_distance > p1_distance:
                    # P1 is winning (pushing P2 toward edge)
                    dominance = (p2_distance - p1_distance) / self.RING_RADIUS
                    self._trigger_skill_event(self.p1, self.p2, dominance)
                else:
                    dominance = (p1_distance - p2_distance) / self.RING_RADIUS
                    self._trigger_skill_event(self.p2, self.p1, dominance)
            
        # 3. Win Condition (Ring Out)
        dist_p1 = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2)
        dist_p2 = math.sqrt((self.p2['x'] - self.CENTER_X)**2 + (self.p2['y'] - self.CENTER_Y)**2)
        
        if dist_p1 > self.RING_RADIUS:
            self.game_over = True
            self.winner_id = self.p2['id']
            self.winner_name = self.p2.get('custom_name') or self.p2.get('name', 'P2')
        elif dist_p2 > self.RING_RADIUS:
            self.game_over = True
            self.winner_id = self.p1['id']
            self.winner_name = self.p1.get('custom_name') or self.p1.get('name', 'P1')

        return self.get_state()

    def get_state(self) -> Dict[str, Any]:
        return {
            "t": self.timestamp,
            "game_over": self.game_over,
            "winner": self.winner_id,
            "winner_name": self.winner_name,
            "collision": self.collision_this_frame,
            "events": self.pending_events,
            "p1": self.p1,
            "p2": self.p2
        }
