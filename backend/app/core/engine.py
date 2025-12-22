from typing import Dict, Any, List, Optional
import math
import random
import time

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

# Game states
STATE_WAITING = "WAITING"      # Both wrestlers ready, waiting for tachiai
STATE_P1_READY = "P1_READY"    # P1 pressed, waiting for P2
STATE_P2_READY = "P2_READY"    # P2 pressed, waiting for P1
STATE_COUNTDOWN = "COUNTDOWN"  # 3-2-1-GO countdown before fight
STATE_FIGHTING = "FIGHTING"    # Tachiai successful, fight in progress
STATE_RING_OUT = "RING_OUT"    # One wrestler crossed edge, physics continuing for effect
STATE_MATTA = "MATTA"          # False start, resetting
STATE_GAME_OVER = "GAME_OVER"

class SumoEngine:
    """
    Pure Python Game Engine with authentic sumo mechanics.
    Features: Tachiai sync, edge resistance, extended matches.
    Target match duration: 10-15 seconds
    """
    # --- Physics Constants ---
    RING_RADIUS = 14.0
    WRESTLER_RADIUS = 2.0
    FRICTION = 0.88  # Lower friction = faster movement (was 0.92)
    MIN_COLLISION_DIST = 4.0  # Tighter collision for closer battles
    
    # Push force tuning - increased for faster matches
    PUSH_FORCE_PER_INPUT = 0.75  # Strong hits for quick matches (was 0.55)
    EDGE_RESISTANCE_MULT = 0.6   # Low resistance near edge (was 0.8)
    
    # Tachiai settings
    TACHIAI_SYNC_WINDOW_MS = 150  # 150ms window for simultaneous press
    MATTA_RESET_TIME = 1.5        # Seconds to show matta before reset
    MAX_MATTA_PER_PLAYER = 2      # Auto-loss after this many false starts
    
    # Input Throttling
    INPUT_COOLDOWN = 0.08         # 80ms min interval between processed moves
    
    # Skill trigger settings
    SKILL_COOLDOWN = 1.0
    SKILL_TRIGGER_CHANCE = 0.25
    
    # Clinch Physics
    CLINCH_MAX_DIST = 8.0     # Distance to start pulling together
    CLINCH_FORCE = 0.02       # Almost zero stickiness
    
    # Stamina System (tuned for 10-15s matches)
    STAMINA_MAX = 100.0
    STAMINA_COST_PUSH = 12.0   # Slightly lower cost (was 15.0)
    STAMINA_REGEN_RATE = 20.0  # Faster regen (was 15.0)
    FATIGUE_PENALTY = 0.6      # Less penalty when tired (was 0.5)
    FATIGUE_THRESHOLD = 10.0   # Consider fatigued below this
    
    # Directional Push / Counter System
    COUNTER_BONUS = 1.5        # 50% bonus when counter-hitting
    CLASH_STAMINA_MULT = 2.0   # Double stamina drain on clash
    PREDICTABILITY_PENALTY = 0.8  # 20% penalty for predictable inputs
    PREDICTABILITY_STREAK = 3  # Inputs in a row before penalty kicks in
    
    # Bot / Simulation Settings
    BOT_ACTION_INTERVAL_MIN = 0.06  # Faster mashing (was 0.08)
    BOT_ACTION_INTERVAL_MAX = 0.15  # Faster mashing (was 0.20)
    BOT_TACHIAI_DELAY = 0.05       # Delay after effective "GO" signal
    
    # Countdown Settings
    COUNTDOWN_DURATION = 3.0  # 3 second countdown (3...2...1...GO!)
    
    def __init__(self, simulation_mode=False):
        self.WIDTH = 64
        self.HEIGHT = 32
        self.CENTER_X = self.WIDTH / 2
        self.CENTER_Y = self.HEIGHT / 2
        
        # Game state
        self.state = STATE_WAITING
        self.game_over = False
        self.winner_id = None
        self.winner_name = None
        self.timestamp = 0
        self.collision_this_frame = False
        
        # Tachiai tracking
        self.p1_press_time: Optional[float] = None
        self.p2_press_time: Optional[float] = None
        self.p1_matta_count = 0
        self.p2_matta_count = 0
        self.matta_start_time: Optional[float] = None
        self.matta_player: Optional[str] = None
        
        # Skill event system
        self.pending_events: List[Dict[str, Any]] = []
        self.last_skill_time = 0
        
        self.simulation_mode = simulation_mode
        self.bot_p1_next_action = 0
        self.bot_p2_next_action = 0
        
        # Push tracking for extended matches
        self.p1_push_count = 0
        self.p2_push_count = 0
        
        # Directional Push Tracking (for counter detection)
        self.p1_last_action: Optional[str] = None  # 'LEFT' or 'RIGHT'
        self.p2_last_action: Optional[str] = None
        self.p1_action_streak: int = 0  # Same direction streak count
        self.p2_action_streak: int = 0
        self.p1_last_action_time: float = 0.0
        self.p2_last_action_time: float = 0.0
        
        # Countdown tracking
        self.countdown_remaining: float = 0.0
        self.countdown_start_time: Optional[float] = None
        
        # Match Event Log (for replay/debugging)
        self.match_log: List[Dict[str, Any]] = []
        self.match_start_time: Optional[float] = None
        self.match_id: str = f"m-{int(time.time())}"
        self.ring_out_cooldown = 0
        
        # Wrestler 1 (West/Left - shown at top of controller)
        self.p1 = {
            "id": "p1",
            "x": self.CENTER_X - 8,  # Start on LEFT (West)
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "strength": 1.0,
            "technique": 1.0,
            "speed": 1.0,
            "mass": 1.0,
            "stamina": 100.0,
            "last_push_time": 0.0
        }
        
        # Wrestler 2 (East/Right - shown at bottom of controller)
        self.p2 = {
            "id": "p2",
            "x": self.CENTER_X + 8,  # Start on RIGHT (East)
            "y": self.CENTER_Y,
            "vx": 0.0,
            "vy": 0.0,
            "strength": 1.0,
            "technique": 1.0,
            "speed": 1.0,
            "mass": 1.0,
            "stamina": 100.0,
            "last_push_time": 0.0
        }
        
        # In simulation mode, give significant asymmetry so matches don't stalemate
        if simulation_mode:
            self.p1['strength'] = 1.25  # P1 advantage to ensure quick resolution
            self.p2['strength'] = 0.75
        
        self._save_start_positions()
        
    def _save_start_positions(self):
        """Save starting positions for matta reset"""
        self.p1_start_x = self.p1['x']
        self.p1_start_y = self.p1['y']
        self.p2_start_x = self.p2['x']
        self.p2_start_y = self.p2['y']
        
    def force_start(self, skip_countdown: bool = False):
        """Force start the match - for prototype/single-device testing.
        Args:
            skip_countdown: If True, skip 3-2-1 countdown and start immediately (for simulations)
        """
        if skip_countdown or self.simulation_mode:
            # Skip countdown for simulations
            self.state = STATE_FIGHTING
            self._apply_tachiai_charge()
            self.pending_events.append({
                "type": "tachiai",
                "message": "TACHIAI!",
                "timestamp": self.timestamp
            })
        else:
            # Start 3-2-1 countdown
            self.state = STATE_COUNTDOWN
            self.countdown_remaining = self.COUNTDOWN_DURATION
            self.countdown_start_time = self.timestamp
            self.pending_events.append({
                "type": "countdown_start",
                "message": "GET READY!",
                "duration": self.COUNTDOWN_DURATION,
                "timestamp": self.timestamp
            })
        
    def _reset_positions(self):
        """Reset wrestlers to starting positions after matta"""
        self.p1['x'] = self.p1_start_x
        self.p1['y'] = self.p1_start_y
        self.p1['vx'] = 0
        self.p1['vy'] = 0
        self.p2['x'] = self.p2_start_x
        self.p2['y'] = self.p2_start_y
        self.p2['vx'] = 0
        self.p2['vy'] = 0
        
    def set_wrestlers(self, p1_data: Dict, p2_data: Dict):
        """Initialize wrestlers from DB data"""
        safe_keys = ['id', 'name', 'custom_name', 'color', 'stable', 'avatar_seed']
        for key in safe_keys:
            if key in p1_data:
                self.p1[key] = p1_data[key]
            if key in p2_data:
                self.p2[key] = p2_data[key]
        
        self.p1['strength'] = float(p1_data.get('strength', 1.0))
        self.p1['technique'] = float(p1_data.get('technique', 1.0))
        self.p1['speed'] = float(p1_data.get('speed', 1.0))
        self.p1['mass'] = float(p1_data.get('weight', 150)) / 150.0
        self.p1['unlocked_skills'] = p1_data.get('unlocked_skills', [])
        
        self.p2['strength'] = float(p2_data.get('strength', 1.0))
        self.p2['technique'] = float(p2_data.get('technique', 1.0))
        self.p2['speed'] = float(p2_data.get('speed', 1.0))
        self.p2['mass'] = float(p2_data.get('weight', 150)) / 150.0
        self.p2['unlocked_skills'] = p2_data.get('unlocked_skills', [])

    def _log_event(self, event_type: str, data: Dict[str, Any] = None):
        """Log a match event for replay/debugging"""
        event = {
            "t": round(self.timestamp, 3),
            "type": event_type
        }
        if data:
            event.update(data)
        self.match_log.append(event)
        
    def get_match_summary(self) -> Dict[str, Any]:
        """Get complete match data for persistence"""
        return {
            "match_id": self.match_id,
            "p1": {
                "id": self.p1.get('id'),
                "name": self.p1.get('custom_name') or self.p1.get('name'),
                "color": self.p1.get('color')
            },
            "p2": {
                "id": self.p2.get('id'),
                "name": self.p2.get('custom_name') or self.p2.get('name'),
                "color": self.p2.get('color')
            },
            "winner_id": self.winner_id if self.game_over else None,
            "winner_name": self.winner_name if self.game_over else None,
            "duration_seconds": round(self.timestamp - (self.match_start_time or 0), 2),
            "p1_push_count": self.p1_push_count,
            "p2_push_count": self.p2_push_count,
            "events": self.match_log
        }

    def _get_edge_resistance(self, wrestler: Dict) -> float:
        """Calculate resistance multiplier based on distance from center"""
        dist_from_center = math.sqrt(
            (wrestler['x'] - self.CENTER_X)**2 + 
            (wrestler['y'] - self.CENTER_Y)**2
        )
        # Resistance increases as wrestler approaches edge
        edge_factor = dist_from_center / self.RING_RADIUS
        return 1.0 + (edge_factor * self.EDGE_RESISTANCE_MULT)
    
    @staticmethod
    def _normalize_id(id_value) -> str:
        """Normalize wrestler ID to string for consistent comparison."""
        if id_value is None:
            return ""
        return str(id_value).strip()
    
    def handle_input(self, player_id: str, action: str):
        """Handle control inputs with Tachiai state machine"""
        current_time = time.time() * 1000  # ms
        
        # Normalize IDs for robust comparison
        normalized_player_id = self._normalize_id(player_id)
        normalized_p1_id = self._normalize_id(self.p1.get('id'))
        normalized_p2_id = self._normalize_id(self.p2.get('id'))
        
        normalized_p2_id = self._normalize_id(self.p2.get('id'))
        
        # During COUNTDOWN - Ignore all inputs (prevents buffering/lag)
        if self.state == STATE_COUNTDOWN:
            return

        # During WAITING state - track press times for tachiai
        if self.state == STATE_WAITING:
            if player_id == "p1" and action in ("PUSH", "KIAI"):
                self.p1_press_time = current_time
                if self.p2_press_time and (current_time - self.p2_press_time) < self.TACHIAI_SYNC_WINDOW_MS:
                    # Successful tachiai!
                    self.state = STATE_FIGHTING
                    self._apply_tachiai_charge()
                    self.pending_events.append({
                        "type": "tachiai",
                        "message": "TACHIAI!",
                        "timestamp": self.timestamp
                    })
                else:
                    self.state = STATE_P1_READY
                    
            elif player_id == "p2" and action in ("PUSH", "KIAI"):
                self.p2_press_time = current_time
                if self.p1_press_time and (current_time - self.p1_press_time) < self.TACHIAI_SYNC_WINDOW_MS:
                    # Successful tachiai!
                    self.state = STATE_FIGHTING
                    self._apply_tachiai_charge()
                    self.pending_events.append({
                        "type": "tachiai",
                        "message": "TACHIAI!",
                        "timestamp": self.timestamp
                    })
                else:
                    self.state = STATE_P2_READY
                    
        # P1 is ready, waiting for P2
        elif self.state == STATE_P1_READY:
            if player_id == "p2" and action in ("PUSH", "KIAI"):
                current_time = time.time() * 1000
                if self.p1_press_time and (current_time - self.p1_press_time) < self.TACHIAI_SYNC_WINDOW_MS:
                    self.state = STATE_FIGHTING
                    self._apply_tachiai_charge()
                    self.pending_events.append({
                        "type": "tachiai",
                        "message": "TACHIAI!",
                        "timestamp": self.timestamp
                    })
                else:
                    # P1 pressed too early - MATTA!
                    self._trigger_matta("p1")
                    
        # P2 is ready, waiting for P1
        elif self.state == STATE_P2_READY:
            if player_id == "p1" and action in ("PUSH", "KIAI"):
                current_time = time.time() * 1000
                if self.p2_press_time and (current_time - self.p2_press_time) < self.TACHIAI_SYNC_WINDOW_MS:
                    self.state = STATE_FIGHTING
                    self._apply_tachiai_charge()
                    self.pending_events.append({
                        "type": "tachiai",
                        "message": "TACHIAI!",
                        "timestamp": self.timestamp
                    })
                else:
                    # P2 pressed too early - MATTA!
                    self._trigger_matta("p2")
                    
        # During fight - normal push mechanics
        elif self.state == STATE_FIGHTING:
            # Identify the wrestler who pressed the button and their opponent
            pushing_wrestler = None
            opponent_wrestler = None
            pusher_name = None
            opponent_name = None
            is_p1 = False
            
            if normalized_player_id == normalized_p1_id:
                pushing_wrestler = self.p1  # This wrestler is doing the pushing
                opponent_wrestler = self.p2  # This wrestler gets pushed
                pusher_name = self.p1.get('custom_name') or self.p1.get('name', 'P1')
                opponent_name = self.p2.get('custom_name') or self.p2.get('name', 'P2')
                self.p1_push_count += 1
                is_p1 = True
            elif normalized_player_id == normalized_p2_id:
                pushing_wrestler = self.p2  # This wrestler is doing the pushing
                opponent_wrestler = self.p1  # This wrestler gets pushed
                pusher_name = self.p2.get('custom_name') or self.p2.get('name', 'P2')
                opponent_name = self.p1.get('custom_name') or self.p1.get('name', 'P1')
                self.p2_push_count += 1
                is_p1 = False
            else:
                # Debug: ID mismatch - log for troubleshooting
                print(f"[Engine] WARN: Unknown player_id '{normalized_player_id}' - p1='{normalized_p1_id}', p2='{normalized_p2_id}'")
            
            # Accepted actions: PUSH, KIAI, PUSH_LEFT, PUSH_RIGHT
            valid_actions = ("PUSH", "KIAI", "PUSH_LEFT", "PUSH_RIGHT")
            
            if pushing_wrestler and opponent_wrestler and action in valid_actions:
                # --- Rate Limit Check ---
                last_push = pushing_wrestler.get('last_push_time', 0.0)
                if (self.timestamp - last_push) < self.INPUT_COOLDOWN:
                    # Input ignored (cooldown)
                    return
                
                # Extract direction from action (LEFT, RIGHT, or random for PUSH/KIAI)
                # Extract direction from action (LEFT, RIGHT, or random for PUSH/KIAI)
                if action == "PUSH_LEFT":
                    direction = "LEFT"
                elif action == "PUSH_RIGHT":
                    direction = "RIGHT"
                else:
                    # Legacy PUSH/KIAI: pick random direction for backward compatibility
                    direction = random.choice(["LEFT", "RIGHT"])
                
                # Track this action for counter detection
                if is_p1:
                    # Check for predictability streak
                    if self.p1_last_action == direction:
                        self.p1_action_streak += 1
                    else:
                        self.p1_action_streak = 1
                    self.p1_last_action = direction
                    self.p1_last_action_time = self.timestamp
                else:
                    if self.p2_last_action == direction:
                        self.p2_action_streak += 1
                    else:
                        self.p2_action_streak = 1
                    self.p2_last_action = direction
                    self.p2_last_action_time = self.timestamp
                
                # Apply push with direction context
                self._log_event("push", {
                    "player": "p1" if is_p1 else "p2",
                    "direction": direction,
                    "stamina": pushing_wrestler.get('stamina', 100)
                })
                self._apply_push(pushing_wrestler, opponent_wrestler, direction, is_p1)
                
    def _trigger_matta(self, offending_player: str):
        """Trigger false start"""
        self.state = STATE_MATTA
        self.matta_start_time = self.timestamp
        self.matta_player = offending_player
        
        if offending_player == "p1":
            self.p1_matta_count += 1
            if self.p1_matta_count > self.MAX_MATTA_PER_PLAYER:
                self.game_over = True
                self.winner_id = "p2"
                self.winner_name = self.p2.get('custom_name') or self.p2.get('name', 'P2')
                self.state = STATE_GAME_OVER
        else:
            self.p2_matta_count += 1
            if self.p2_matta_count > self.MAX_MATTA_PER_PLAYER:
                self.game_over = True
                self.winner_id = "p1"
                self.winner_name = self.p1.get('custom_name') or self.p1.get('name', 'P1')
                self.state = STATE_GAME_OVER
                
        self.pending_events.append({
            "type": "matta",
            "message": "待った!",
            "offender": offending_player,
            "timestamp": self.timestamp
        })
        
    def _apply_tachiai_charge(self):
        """Both wrestlers charge toward each other at tachiai"""
        # Slower charge so players can see the approach
        charge_speed = 0.8  # Increased from 0.4 to ensure contact
        # P1 is on Left (West), moves Right (+x)
        self.p1['vx'] = charge_speed
        # P2 is on Right (East), moves Left (-x)
        self.p2['vx'] = -charge_speed
        
    def _apply_push(self, pushing_wrestler: Dict, opponent_wrestler: Dict, direction: str = "LEFT", is_p1: bool = True):
        """
        Apply push force with directional counter-detection.
        - Counter-hit: Opposing directions = +50% force (amplified by technique)
        - Clash: Same directions = double stamina cost
        - Predictability: 3+ same inputs = -20% force
        - Skill Procs: Chance to trigger special effects based on unlocked skills
        """
        # --- Stamina Check ---
        current_stamina = pushing_wrestler.get('stamina', 100.0)
        fatigue_mult = 1.0
        stamina_cost = self.STAMINA_COST_PUSH
        
        # --- Skill Proc Check (Pre-calculation) ---
        proc_bonus_force = 1.0
        proc_stamina_damage = 0.0
        proc_event = None
        
        # Check for skills
        unlocked = pushing_wrestler.get('unlocked_skills', [])
        # Iterate and roll for procs
        # Logic: 15% base chance per relevant skill
        for skill_entry in unlocked:
            # Handle both list of strings and list of dicts
            skill_id = skill_entry.get('skill_id') if isinstance(skill_entry, dict) else skill_entry
            
            # Simple RNG for proc
            if random.random() < 0.15: 
                if "str" in skill_id:
                    # STRENGTH SKILL: CRIT PUSH
                    # Tier 1: 1.5x, Tier 2: 2.0x
                    multiplier = 2.0 if "2" in skill_id else 1.5
                    if multiplier > proc_bonus_force: # Keep best
                        proc_bonus_force = multiplier
                        proc_event = {"name": "POWER PUSH", "type": "crit"}
                        
                elif "tech" in skill_id:
                    # TECHNIQUE SKILL: STAMINA DRAIN
                    # Tier 1: 10 dmg, Tier 2: 20 dmg
                    dmg = 20.0 if "2" in skill_id else 10.0
                    proc_stamina_damage += dmg
                    if not proc_event: 
                        proc_event = {"name": "DRAIN", "type": "debuff"}
                        
                elif "spd" in skill_id:
                     # SPEED SKILL: DOUBLE HIT (Force multiplier)
                     # Conceptually a double hit, effectively just more force but labeled differently
                     multiplier = 1.8 if "2" in skill_id else 1.4
                     if multiplier > proc_bonus_force:
                         proc_bonus_force = multiplier
                         proc_event = {"name": "DOUBLE STRIKE", "type": "speed"}

        # Emit Proc Event if happened
        if proc_event:
            pusher_name = pushing_wrestler.get('custom_name') or pushing_wrestler.get('name', 'Pusher')
            self.pending_events.append({
                "type": "skill_proc",
                "wrestler_id": pushing_wrestler['id'],
                "wrestler_name": pusher_name,
                "proc_name": proc_event["name"],
                "proc_type": proc_event["type"],
                "timestamp": self.timestamp
            })
        
        # --- Counter Detection ---
        counter_mult = 1.0
        is_counter = False
        is_clash = False
        
        # Get opponent's last action (within a reasonable time window - 0.5s)
        action_window = 0.5
        if is_p1:
            opponent_last_action = self.p2_last_action
            opponent_last_time = self.p2_last_action_time
            my_streak = self.p1_action_streak
        else:
            opponent_last_action = self.p1_last_action
            opponent_last_time = self.p1_last_action_time
            my_streak = self.p2_action_streak
        
        # Check if opponent acted recently enough for counter/clash detection
        if opponent_last_action and (self.timestamp - opponent_last_time) < action_window:
            if direction != opponent_last_action:
                # COUNTER HIT! (opposite directions)
                is_counter = True
                # Technique amplifies counter bonus: base 1.5x, up to ~2.0x with max technique
                technique = pushing_wrestler.get('technique', 1.0)
                technique_bonus = 1.0 + (technique - 1.0) * 0.3  # 1.0 -> 1.0, 1.5 -> 1.15
                counter_mult = self.COUNTER_BONUS * technique_bonus
            else:
                # CLASH! (same direction) - double stamina cost
                is_clash = True
                stamina_cost *= self.CLASH_STAMINA_MULT
        
        # --- Predictability Penalty ---
        predictability_mult = 1.0
        if my_streak >= self.PREDICTABILITY_STREAK:
            predictability_mult = self.PREDICTABILITY_PENALTY
        
        # --- Apply Stamina Cost ---
        if current_stamina >= stamina_cost:
            pushing_wrestler['stamina'] = current_stamina - stamina_cost
        else:
            # Fatigued push (weak)
            fatigue_mult = self.FATIGUE_PENALTY
            pushing_wrestler['stamina'] = 0
            
        pushing_wrestler['last_push_time'] = self.timestamp

        # --- Direction Vector ---
        dx = opponent_wrestler['x'] - pushing_wrestler['x']
        dy = opponent_wrestler['y'] - pushing_wrestler['y']
        dist = math.sqrt(dx*dx + dy*dy) or 1.0
        
        nx = dx / dist
        ny = dy / dist
        
        # --- Calculate Force ---
        edge_resistance = self._get_edge_resistance(opponent_wrestler)
        base_force = self.PUSH_FORCE_PER_INPUT * pushing_wrestler.get('strength', 1.0)
        
        # FINAL FORCE: Base * Fatigue * Counter * Predictability * SkillProc / EdgeResistance
        effective_force = (base_force * fatigue_mult * counter_mult * predictability_mult * proc_bonus_force) / edge_resistance
        
        # Apply Skill Stamina Damage to Opponent
        if proc_stamina_damage > 0:
            opp_stamina = opponent_wrestler.get('stamina', 100.0)
            opponent_wrestler['stamina'] = max(0, opp_stamina - proc_stamina_damage)
        
        # CHAOS VARIANCE (reduced on counter for more consistent counter hits)
        if is_counter:
            variance_mult = random.uniform(0.9, 1.3)  # Tighter variance on counters
        else:
            variance_mult = random.uniform(0.7, 2.0)
        effective_force *= variance_mult
        
        # --- Emit Events ---
        pusher_name = pushing_wrestler.get('custom_name') or pushing_wrestler.get('name', 'Unknown')
        
        if is_counter:
            self.pending_events.append({
                "type": "counter",
                "wrestler_id": pushing_wrestler['id'],
                "wrestler_name": pusher_name,
                "direction": direction,
                "multiplier": counter_mult,
                "timestamp": self.timestamp
            })
            self._log_event("counter", {
                "player": "p1" if is_p1 else "p2",
                "multiplier": round(counter_mult, 2)
            })
        elif is_clash:
            self.pending_events.append({
                "type": "clash",
                "wrestler_id": pushing_wrestler['id'],
                "wrestler_name": pusher_name,
                "timestamp": self.timestamp
            })
            self._log_event("clash", {
                "player": "p1" if is_p1 else "p2"
            })

        HIT_RANGE = 6.0
        
        if dist > HIT_RANGE:
            # WHIFF / LUNGE - Too far to hit, so move closer
            pushing_wrestler['vx'] += nx * effective_force * 1.5
            pushing_wrestler['vy'] += ny * effective_force * 0.5
        else:
            # HIT - Push opponent AWAY
            opponent_wrestler['vx'] += nx * effective_force
            opponent_wrestler['vy'] += ny * effective_force * 0.3
            
            # FATIGUE SLIP (Risk of pushing while tired)
            if fatigue_mult < 1.0 and random.random() < 0.15:
                pushing_wrestler['vx'] -= nx * effective_force * 0.5
        
    def _trigger_skill_event(self, wrestler: Dict, opponent: Dict, dominance: float):
        """Trigger a skill popup based on wrestler stats"""
        if self.timestamp - self.last_skill_time < self.SKILL_COOLDOWN:
            return
            
        stats = {
            "strength": wrestler.get('strength', 1.0),
            "technique": wrestler.get('technique', 1.0),
            "speed": wrestler.get('speed', 1.0),
        }
        best_stat = max(stats, key=stats.get)
        
        if dominance > 0.2:
            if best_stat == "strength":
                category = random.choice(["OSHI", "YORI", "GENERIC"])
            elif best_stat == "technique":
                category = random.choice(["NAGE", "HINERI", "YORI"])
            else:
                category = random.choice(["KAKE", "GENERIC"])
        else:
            category = "GENERIC"
        
        skill = random.choice(SKILL_MOVES.get(category, SKILL_MOVES["GENERIC"]))
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
        if self.state == STATE_GAME_OVER:
            return self.get_state()

        self.timestamp += dt
        
        # BOT INPUT INJECTION
        if self.simulation_mode:
            self._bot_tick(self.timestamp)

        self.collision_this_frame = False
        self.pending_events = []
        
        # Handle MATTA reset timing
        if self.state == STATE_MATTA:
            if self.matta_start_time and (self.timestamp - self.matta_start_time) > self.MATTA_RESET_TIME:
                self._reset_positions()
                self.p1_press_time = None
                self.p2_press_time = None
                self.matta_start_time = None
                self.matta_player = None
                self.state = STATE_WAITING
            return self.get_state()
        
        # Handle COUNTDOWN state (3...2...1...GO!)
        if self.state == STATE_COUNTDOWN:
            self.countdown_remaining -= dt
            
            # Emit countdown events at each second
            if self.countdown_remaining <= 0:
                # Countdown finished - START FIGHTING!
                self.state = STATE_FIGHTING
                self.countdown_remaining = 0
                self._apply_tachiai_charge()
                self.pending_events.append({
                    "type": "tachiai",
                    "message": "TACHIAI!",
                    "timestamp": self.timestamp
                })
            return self.get_state()
            
        # Handle WAITING/READY timeout (auto-matta if one player waits too long)
        if self.state in (STATE_P1_READY, STATE_P2_READY):
            # Check if sync window expired
            current_time = time.time() * 1000
            if self.state == STATE_P1_READY and self.p1_press_time:
                if (current_time - self.p1_press_time) > self.TACHIAI_SYNC_WINDOW_MS:
                    self._trigger_matta("p1")
            elif self.state == STATE_P2_READY and self.p2_press_time:
                if (current_time - self.p2_press_time) > self.TACHIAI_SYNC_WINDOW_MS:
                    self._trigger_matta("p2")
            return self.get_state()
        
        # Handle RING_OUT physics cooldown
        if self.state == STATE_RING_OUT:
            self.ring_out_cooldown -= 1
            
            # Continue applying inertia (no friction/inputs) so they fly off
            for p in [self.p1, self.p2]:
                p['x'] += p['vx']
                p['y'] += p['vy']
                
            if self.ring_out_cooldown <= 0:
                self.game_over = True
                self.state = STATE_GAME_OVER
                
            return self.get_state()

        # Only apply physics during FIGHTING
        if self.state != STATE_FIGHTING:
            return self.get_state()
        
        # 1. Apply Physics
        for p in [self.p1, self.p2]:
            # Physics
            # Physics using drag
            p['vx'] *= self.FRICTION
            p['vy'] *= self.FRICTION
            
            # Velocity Cap (Prevent tunneling)
            MAX_SPEED = 1.5
            p['vx'] = max(-MAX_SPEED, min(MAX_SPEED, p['vx']))
            p['vy'] = max(-MAX_SPEED, min(MAX_SPEED, p['vy']))
            
            p['x'] += p['vx']
            p['y'] += p['vy']
            
            # Stamina Regen
            if self.simulation_mode:
                p['stamina'] = self.STAMINA_MAX
            elif (self.timestamp - p.get('last_push_time', 0)) > 0.5: # Wait 0.5s after push to START regen
                p['stamina'] = min(self.STAMINA_MAX, p.get('stamina', 0) + (self.STAMINA_REGEN_RATE * dt))
            
        # 2. Collision Detection & Resolution
        dx = self.p2['x'] - self.p1['x']
        dy = self.p2['y'] - self.p1['y']
        dist = math.sqrt(dx*dx + dy*dy)
        
        if dist < self.MIN_COLLISION_DIST and dist > 0:
            self.collision_this_frame = True
            
            nx = dx / dist
            ny = dy / dist
            
            # Push apart
            overlap = self.MIN_COLLISION_DIST - dist
            push_dist = overlap / 2.0
            
            self.p1['x'] -= nx * push_dist
            self.p1['y'] -= ny * push_dist
            self.p2['x'] += nx * push_dist
            self.p2['y'] += ny * push_dist
            
            # No passive grinding force - matches decided purely by button presses
            # This ensures fair gameplay regardless of wrestler stats during idle collision
            # Stats only matter when players actively PUSH
            
            # Stop velocity perpendicular to collision normal (prevent sliding through)
            # Simple bounce/stop
            # self.p1['vx'] *= 0.5
            # self.p1['vy'] *= 0.5
            # self.p2['vx'] *= 0.5
            # self.p2['vy'] *= 0.5
            
            # Visual jitter only
            jitter = random.uniform(-0.1, 0.1)
            self.p1['y'] += jitter
            self.p2['y'] += jitter
            
            # Skill trigger
            if random.random() < self.SKILL_TRIGGER_CHANCE:
                p1_dist = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2)
                p2_dist = math.sqrt((self.p2['x'] - self.CENTER_X)**2 + (self.p2['y'] - self.CENTER_Y)**2)
                
                if p2_dist > p1_dist:
                    dominance = (p2_dist - p1_dist) / self.RING_RADIUS
                    self._trigger_skill_event(self.p1, self.p2, dominance)
                else:
                    dominance = (p1_dist - p2_dist) / self.RING_RADIUS
                    self._trigger_skill_event(self.p2, self.p1, dominance)
                    self._trigger_skill_event(self.p2, self.p1, dominance)
            
        # 3. Clinch (Attractive Force)
        # If wrestlers are close but not colliding, pull them together
        elif dist < self.CLINCH_MAX_DIST and dist > self.MIN_COLLISION_DIST:
            # Calculate pull direction (towards each other)
            nx = dx / dist
            ny = dy / dist
            
            # Apply gentle attractive force
            pull_force = self.CLINCH_FORCE
            
            self.p1['x'] += nx * pull_force
            self.p1['y'] += ny * pull_force
            self.p2['x'] -= nx * pull_force
            self.p2['y'] -= ny * pull_force
        dist_p1 = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2)
        dist_p2 = math.sqrt((self.p2['x'] - self.CENTER_X)**2 + (self.p2['y'] - self.CENTER_Y)**2)
        
        if dist_p1 > self.RING_RADIUS:
            print(f"[Engine] RING OUT: P1 out! Dist={dist_p1:.2f} > {self.RING_RADIUS}")
            self.state = STATE_RING_OUT
            self.ring_out_cooldown = 60 # 1 second of post-match physics
            # Use actual wrestler ID (not literal "p2") so frontend can match color correctly
            self.winner_id = self.p2.get('id', 'p2')
            self.winner_name = self.p2.get('custom_name') or self.p2.get('name', 'P2')
        elif dist_p2 > self.RING_RADIUS:
            print(f"[Engine] RING OUT: P2 out! Dist={dist_p2:.2f} > {self.RING_RADIUS}")
            self.state = STATE_RING_OUT
            self.ring_out_cooldown = 60
            # Use actual wrestler ID (not literal "p1") so frontend can match color correctly
            self.winner_id = self.p1.get('id', 'p1')
            self.winner_name = self.p1.get('custom_name') or self.p1.get('name', 'P1')

        return self.get_state()

    def _bot_tick(self, current_timestamp: float):
        """
        Simulate human inputs for both players.
        Logic varies by state to ensure smooth testing flows.
        """
        # 1. TACHIAI AUTO-SYNC
        # If waiting, make them press at roughly the same time to start fight immediately
        if self.state == STATE_WAITING:
            # P1 initiates with random chance per tick
            if self.p1_press_time is None:
                if random.random() < 0.05: # Random chance per tick to start
                    print(f"[Engine] BOT: P1 initiates TACHIAI")
                    self.handle_input("p1", "PUSH")
        
        # CRUCIAL FIX: This must be a SEPARATE if, not nested elif inside WAITING
        elif self.state == STATE_P1_READY:
            # P2 reacts instantly to complete sync
            print(f"[Engine] BOT: P2 reacts TACHIAI")
            self.handle_input("p2", "PUSH")
        
        # 2. FIGHTING SPAM
        # During the fight, mash buttons 
        if self.state == STATE_FIGHTING:
            # Get actual wrestler IDs (may be "demo_p1" etc, not just "p1")
            p1_id = self.p1.get('id', 'p1')
            p2_id = self.p2.get('id', 'p2')
            
             # P1 Bot
            if current_timestamp >= self.bot_p1_next_action:
                # Bot Stamina Logic: STOP if too tired (lowered from 30 to reduce stalemates)
                if self.p1.get('stamina', 100) > 5:
                    self.handle_input(p1_id, "PUSH")
                else:
                    # Resting...
                    pass

                # Schedule next press
                interval = random.uniform(self.BOT_ACTION_INTERVAL_MIN, self.BOT_ACTION_INTERVAL_MAX)
                self.bot_p1_next_action = current_timestamp + interval

             # P2 Bot
            if current_timestamp >= self.bot_p2_next_action:
                # Bot Stamina Logic: P2 rests earlier (20 vs 5) to create asymmetry and prevent stalemates
                 if self.p2.get('stamina', 100) > 20:
                    self.handle_input(p2_id, "PUSH")
                 else:
                    # Resting
                    pass
                    
                # Schedule next press
                 interval = random.uniform(self.BOT_ACTION_INTERVAL_MIN, self.BOT_ACTION_INTERVAL_MAX)
                 self.bot_p2_next_action = current_timestamp + interval

    def get_state(self) -> Dict[str, Any]:
        # Calculate edge danger for UI
        p1_edge = math.sqrt((self.p1['x'] - self.CENTER_X)**2 + (self.p1['y'] - self.CENTER_Y)**2) / self.RING_RADIUS
        p2_edge = math.sqrt((self.p2['x'] - self.CENTER_X)**2 + (self.p2['y'] - self.CENTER_Y)**2) / self.RING_RADIUS
        
        return {
            "t": self.timestamp,
            "state": self.state,
            "game_over": self.game_over,
            "winner": self.winner_id,
            "winner_name": self.winner_name,
            "collision": self.collision_this_frame,
            "events": self.pending_events,
            "p1_edge_danger": min(1.0, p1_edge),  # 0-1 scale
            "p2_edge_danger": min(1.0, p2_edge),
            "p1_matta": self.p1_matta_count,
            "p2_matta": self.p2_matta_count,
            "matta_player": self.matta_player,
            "countdown_remaining": round(self.countdown_remaining, 1),  # For UI display
            "p1": self.p1,
            "p2": self.p2
        }
