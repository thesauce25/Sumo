#!/usr/bin/env python3
import time
import random
import math
import sys
import os
import threading
import json
import logging
import sqlite3
from typing import Tuple, Dict, List, Optional, Any, Union

# Flask imports
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    print("Flask or Flask-CORS not found. Please install: pip install flask flask-cors")
    sys.exit(1)

# Hardware imports
try:
    from rgbmatrix import RGBMatrix, RGBMatrixOptions, graphics
    print("Hardware library found: rpi-rgb-led-matrix")
    IS_EMULATOR = False
except ImportError:
    print("Hardware library NOT found. Falling back to RGBMatrixEmulator...")
    try:
        from RGBMatrixEmulator import RGBMatrix, RGBMatrixOptions, graphics
        IS_EMULATOR = True
    except ImportError:
        print("Error: Neither rpi-rgb-led-matrix nor RGBMatrixEmulator is installed.")
        print("Please install the emulator: pip install rgbmatrixemulator")
        sys.exit(1)

# Local imports
import constants as C
import fonts

# --- Database Setup ---

def init_db() -> None:
    conn = sqlite3.connect(C.DB_FILE)
    c = conn.cursor()
    # Wrestlers
    c.execute('''CREATE TABLE IF NOT EXISTS wrestlers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        custom_name TEXT,
        stable TEXT,
        height REAL,
        weight REAL,
        strength REAL,
        technique REAL,
        speed REAL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        matches INTEGER DEFAULT 0,
        color TEXT,
        is_active INTEGER DEFAULT 1,
        bio TEXT,
        avatar_seed INTEGER DEFAULT 0
    )''')
    
    # Migrations
    def run_migration(column: str, definition: str) -> None:
        try:
            c.execute(f'SELECT {column} FROM wrestlers LIMIT 1')
        except sqlite3.OperationalError:
            print(f"Migrating DB: Adding {column} column...")
            c.execute(f'ALTER TABLE wrestlers ADD COLUMN {column} {definition}')

    run_migration('custom_name', 'TEXT')
    run_migration('is_active', 'INTEGER DEFAULT 1')
    run_migration('bio', 'TEXT')
    run_migration('avatar_seed', 'INTEGER DEFAULT 0')
    run_migration('skill_points', 'INTEGER DEFAULT 0')
    run_migration('xp', 'INTEGER DEFAULT 0')
    run_migration('rank_index', 'INTEGER DEFAULT 0')
    run_migration('win_streak', 'INTEGER DEFAULT 0')
    run_migration('fighting_style', 'TEXT')

    # Milestones (Achievements)
    c.execute('''CREATE TABLE IF NOT EXISTS wrestler_milestones (
        wrestler_id INTEGER,
        milestone_id TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (wrestler_id, milestone_id),
        FOREIGN KEY (wrestler_id) REFERENCES wrestlers(id)
    )''')

    # Match History
    c.execute('''CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        p1_id INTEGER,
        p2_id INTEGER,
        winner_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Skills Table
    c.execute('''CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        branch TEXT,
        name TEXT,
        jp_name TEXT,
        description TEXT,
        tier INTEGER,
        cost INTEGER,
        effect_json TEXT
    )''')
    
    # Wrestler Skills (Junction Table)
    c.execute('''CREATE TABLE IF NOT EXISTS wrestler_skills (
        wrestler_id INTEGER,
        skill_id TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (wrestler_id, skill_id),
        FOREIGN KEY (wrestler_id) REFERENCES wrestlers(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )''')
    
    # Populate skills from constants (idempotent)
    for branch_key, branch_data in C.SKILL_BRANCHES.items():
        for skill in branch_data['skills']:
            c.execute('''INSERT OR REPLACE INTO skills 
                      (id, branch, name, jp_name, description, tier, cost, effect_json)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                      (skill['id'], branch_key, skill['name'], skill['jp'], 
                       skill['desc'], skill['tier'], skill['cost'], json.dumps(skill['effect'])))
    
    conn.commit()
    conn.close()

# Initialize on start
init_db()

# --- Flask Setup (API Server) ---
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)

# Shared State (Game Loop <-> Web Server)
GAME_STATE: Dict[str, Any] = {
    "p1_data": None,
    "p2_data": None,
    "reset_requested": False
}

def generate_random_wrestler() -> Tuple[str, str, float, float, float, float, float, str]:
    name = random.choice(C.NAMES_FIRST) + random.choice(C.NAMES_LAST)
    stable = random.choice(C.STABLES)
    # Physical
    height = round(random.uniform(170, 200), 1) # cm
    weight = round(random.uniform(120, 180), 1) # kg
    # Stats (0.5 to 1.5 multiplier baseline)
    strength = round(random.uniform(0.8, 1.4), 2)
    technique = round(random.uniform(0.8, 1.4), 2)
    speed = round(random.uniform(0.8, 1.4), 2)
    
    # Random Color
    r = random.randint(50, 255)
    g = random.randint(50, 100)
    b = random.randint(50, 255)
    color = f"{r},{g},{b}"
    
    return (name, stable, height, weight, strength, technique, speed, color)

def generate_madlib_bio(name: str, stable: str) -> str:
    adj = random.choice(C.BIO_ADJECTIVES)
    noun = random.choice(C.BIO_NOUNS)
    verb = random.choice(C.BIO_VERBS)
    
    templates = [
        f"{name} is a {adj} {noun} from the {stable} stable, famous for {verb} opponents.",
        f"Hailing from {stable}, {name} is a {adj} force of nature known for {verb} rivals.",
        f"The {adj} {noun} of {stable}, {name} specializes in {verb} anyone who stands in the way."
    ]
    return random.choice(templates)

@app.route('/api/wrestlers', methods=['GET'])
def get_wrestlers():
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE is_active = 1 ORDER BY wins DESC')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/wrestlers', methods=['POST'])
def create_wrestler():
    req_data = request.json or {}
    data = generate_random_wrestler() # Tuple: name, stable, h, w, str, tec, spd, color
    
    # Overrides
    custom_name = req_data.get('custom_name')
    if req_data.get('color'):
        # Just assume valid R,G,B format from frontend for simplicity, or could add regex validation here
        data = (data[0], data[1], data[2], data[3], data[4], data[5], data[6], req_data.get('color'))
    
    # Generate Bio and Seed
    display_name = custom_name if custom_name else data[0]
    bio = generate_madlib_bio(display_name, data[1])
    avatar_seed = random.randint(0, 999999)

    conn = sqlite3.connect(C.DB_FILE)
    c = conn.cursor()
    c.execute('''INSERT INTO wrestlers 
              (name, custom_name, stable, height, weight, strength, technique, speed, color, bio, avatar_seed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
              (data[0], custom_name, data[1], data[2], data[3], data[4], data[5], data[6], data[7], bio, avatar_seed))
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "name": data[0], "custom_name": custom_name, "stable": data[1], "bio": bio})

@app.route('/api/wrestlers/<int:w_id>', methods=['GET'])
def get_wrestler_detail(w_id: int):
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE id = ?', (w_id,))
    row = c.fetchone()
    if row:
        w_data = dict(row)
        
        # Fetch Milestones
        c.execute('SELECT milestone_id FROM wrestler_milestones WHERE wrestler_id = ?', (w_id,))
        ms_rows = c.fetchall()
        w_data['milestones'] = [r['milestone_id'] for r in ms_rows]
        
        # Add Rank Data
        w_data['rank_name'] = C.WRESTLER_RANKS[w_data['rank_index']]['name']
        w_data['rank_jp'] = C.WRESTLER_RANKS[w_data['rank_index']]['jp']
        
        conn.close()
        return jsonify(w_data)
    conn.close()
    return jsonify({"error": "Not found"}), 404

@app.route('/api/wrestlers/<int:w_id>', methods=['DELETE'])
def delete_wrestler(w_id: int):
    conn = sqlite3.connect(C.DB_FILE)
    c = conn.cursor()
    c.execute('UPDATE wrestlers SET is_active = 0 WHERE id = ?', (w_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/fight', methods=['POST'])
def api_fight():
    data = request.json
    p1_id = data.get('p1_id')
    p2_id = data.get('p2_id')
    
    if not p1_id or not p2_id:
        return jsonify({"error": "Missing wrestler IDs"}), 400

    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE id IN (?, ?)', (p1_id, p2_id))
    rows = c.fetchall()
    conn.close()
    
    if len(rows) != 2:
         return jsonify({"error": "Wrestlers not found"}), 404

    # Map Correct IDs to P1 and P2
    w1 = dict(next(r for r in rows if r['id'] == int(p1_id)))
    w2 = dict(next(r for r in rows if r['id'] == int(p2_id)))

    GAME_STATE['p1_data'] = w1
    GAME_STATE['p2_data'] = w2
    GAME_STATE['reset_requested'] = True
    
    print(f"Match Requested: {w1['name']} vs {w2['name']}")
    return jsonify({"success": True})

@app.route('/api/fight/action', methods=['POST'])
def api_fight_action():
    data = request.json
    w_id = data.get('wrestler_id')
    action = data.get('action') # 'kiai'
    
    # Simple lookup in current game instance
    if 'current_game' in globals():
        game = globals()['current_game']
        if game.state not in [C.STATE_STRUGGLE, C.STATE_CLINCH, C.STATE_TACHIAI]:
             return jsonify({"error": "Cannot use action now"}), 400
             
        # Find which wrestler matches ID
        target = None
        if game.p1.data and game.p1.data['id'] == w_id: target = game.p1
        elif game.p2.data and game.p2.data['id'] == w_id: target = game.p2
        
        if target:
            target.apply_boost()
            game.apply_screen_shake(10, 2)
            print(f"KIAI used by {target.name}!")
            return jsonify({"success": True})
            
    return jsonify({"error": "Game not active or wrestler not found"}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    wrestler_id = request.args.get('wrestler_id')
    
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    query = '''
        SELECT m.id, m.timestamp, 
               w1.name as p1_name, w1.custom_name as p1_custom,
               w2.name as p2_name, w2.custom_name as p2_custom,
               wWin.name as winner_name, wWin.custom_name as winner_custom
        FROM matches m
        JOIN wrestlers w1 ON m.p1_id = w1.id
        JOIN wrestlers w2 ON m.p2_id = w2.id
        JOIN wrestlers wWin ON m.winner_id = wWin.id
    '''
    
    params = []
    if wrestler_id:
        query += ' WHERE (m.p1_id = ? OR m.p2_id = ?)'
        params = [wrestler_id, wrestler_id]
        
    query += ' ORDER BY m.timestamp DESC LIMIT 50'
    
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

# --- Skill Tree API ---

def get_skill_bonuses(wrestler_id: int) -> Dict[str, float]:
    """Calculate total stat bonuses from unlocked skills for a wrestler."""
    conn = sqlite3.connect(C.DB_FILE)
    c = conn.cursor()
    c.execute('''SELECT s.effect_json FROM wrestler_skills ws
                 JOIN skills s ON ws.skill_id = s.id
                 WHERE ws.wrestler_id = ?''', (wrestler_id,))
    rows = c.fetchall()
    
    bonuses = {"strength": 0.0, "technique": 0.0, "speed": 0.0}
    for row in rows:
        effect = json.loads(row[0])
        for stat, value in effect.items():
            if stat in bonuses:
                bonuses[stat] += value
                
    # Add Fighting Style Bonus
    c.execute('SELECT fighting_style FROM wrestlers WHERE id = ?', (wrestler_id,))
    row = c.fetchone()
    conn.close()

    if row and row[0]: # Use index 0 or row['fighting_style'] if row_factory set. Default cursor is tuple? 
        # Wait, default cursor returns tuples unless row_factory set. 
        # In this function I didn't set row_factory! 
        # So row is tuple. row[0] is correct. 
        style_key = row[0]
        if style_key in C.FIGHTING_STYLES:
            style_bonus = C.FIGHTING_STYLES[style_key]['bonus']
            for stat, value in style_bonus.items():
                if stat in bonuses:
                    bonuses[stat] += value
                elif stat == 'all': # Handle "Grand Champion" all stats
                    bonuses['strength'] += value
                    bonuses['technique'] += value
                    bonuses['speed'] += value
                    
    return bonuses

@app.route('/api/skills', methods=['GET'])
def get_skills():
    """Get all available skills organized by branch."""
    result = {}
    for branch_key, branch_data in C.SKILL_BRANCHES.items():
        result[branch_key] = {
            "name": branch_data['name'],
            "jp": branch_data['jp'],
            "description": branch_data['description'],
            "color": branch_data['color'],
            "skills": branch_data['skills']
        }
    return jsonify(result)

@app.route('/api/wrestlers/<int:w_id>/skills', methods=['GET'])
def get_wrestler_skills(w_id: int):
    """Get a wrestler's unlocked skills and skill points."""
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('SELECT skill_points FROM wrestlers WHERE id = ?', (w_id,))
    wrestler = c.fetchone()
    if not wrestler:
        conn.close()
        return jsonify({"error": "Wrestler not found"}), 404
    
    c.execute('''SELECT s.*, ws.unlocked_at 
                 FROM wrestler_skills ws
                 JOIN skills s ON ws.skill_id = s.id
                 WHERE ws.wrestler_id = ?''', (w_id,))
    skills = c.fetchall()
    conn.close()
    
    bonuses = get_skill_bonuses(w_id)
    return jsonify({
        "skill_points": wrestler['skill_points'],
        "unlocked_skills": [dict(s) for s in skills],
        "total_bonuses": bonuses
    })

@app.route('/api/wrestlers/<int:w_id>/skills/<skill_id>', methods=['POST'])
def unlock_skill(w_id: int, skill_id: str):
    """Unlock a skill for a wrestler (costs skill points)."""
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('SELECT skill_points FROM wrestlers WHERE id = ?', (w_id,))
    wrestler = c.fetchone()
    if not wrestler:
        conn.close()
        return jsonify({"error": "Wrestler not found"}), 404
    
    c.execute('SELECT * FROM skills WHERE id = ?', (skill_id,))
    skill = c.fetchone()
    if not skill:
        conn.close()
        return jsonify({"error": "Skill not found"}), 404
    
    c.execute('SELECT 1 FROM wrestler_skills WHERE wrestler_id = ? AND skill_id = ?', (w_id, skill_id))
    if c.fetchone():
        conn.close()
        return jsonify({"error": "Skill already unlocked"}), 400
    
    if skill['tier'] > 1:
        c.execute('''SELECT 1 FROM wrestler_skills ws
                     JOIN skills s ON ws.skill_id = s.id
                     WHERE ws.wrestler_id = ? AND s.branch = ? AND s.tier = ?''',
                  (w_id, skill['branch'], skill['tier'] - 1))
        if not c.fetchone():
            conn.close()
            return jsonify({"error": f"Must unlock tier {skill['tier'] - 1} skill first"}), 400
    
    cost = skill['cost']
    if wrestler['skill_points'] < cost:
        conn.close()
        return jsonify({"error": f"Need {cost} SP, have {wrestler['skill_points']}"}), 400
    
    c.execute('UPDATE wrestlers SET skill_points = skill_points - ? WHERE id = ?', (cost, w_id))
    c.execute('INSERT INTO wrestler_skills (wrestler_id, skill_id) VALUES (?, ?)', (w_id, skill_id))
    conn.commit()
    conn.close()
    
    print(f"Skill unlocked: {skill['name']} for wrestler {w_id} (-{cost}SP)")
    
    # Update Fighting Style
    update_fighting_style(w_id)
    
    # Check Skill Milestones
    check_milestones(w_id)
    
    return jsonify({"success": True, "skill_id": skill_id, "cost": cost})

def update_fighting_style(w_id: int) -> None:
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get skill counts
    c.execute('''SELECT s.branch, COUNT(*) as count 
                 FROM wrestler_skills ws 
                 JOIN skills s ON ws.skill_id = s.id 
                 WHERE ws.wrestler_id = ? 
                 GROUP BY s.branch''', (w_id,))
    counts = {row['branch']: row['count'] for row in c.fetchall()}
    
    # Check Styles
    new_style = None
    # Check generic specific styles first using lambda condition
    for key, data in C.FIGHTING_STYLES.items():
        if data.get('condition') and data['condition'](counts):
             new_style = key
             # Keep checking to find best fit? For now last match wins or prioritize?
             # Let's prioritize Grand Champion if met
             if key == 'grand_champion': break
             
    if new_style:
        c.execute('UPDATE wrestlers SET fighting_style = ? WHERE id = ?', (new_style, w_id))
        conn.commit()
        print(f"  Fighting Style Updated: {C.FIGHTING_STYLES[new_style]['name']}")
        
    conn.close()

def check_milestones(w_id: int) -> None:
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get Wrestler State
    c.execute('SELECT * FROM wrestlers WHERE id = ?', (w_id,))
    w = c.fetchone()
    if not w: 
        conn.close()
        return
        
    # Get Unlocked Skills Count
    c.execute('SELECT COUNT(*) as count FROM wrestler_skills WHERE wrestler_id = ?', (w_id,))
    skill_count = c.fetchone()['count']
    
    rank_name = C.WRESTLER_RANKS[w['rank_index']]['name']
    
    # Check each milestone
    unlocked_any = False
    for m in C.MILESTONES:
        condition_met = False
        
        # Hardcoded checks based on ID for safety/simplicity
        if m['id'] == 'first_blood' and w['wins'] >= 1: condition_met = True
        elif m['id'] == 'win_streak_3' and w['win_streak'] >= 3: condition_met = True
        elif m['id'] == 'win_streak_10' and w['win_streak'] >= 10: condition_met = True
        elif m['id'] == 'rank_juryo' and w['rank_index'] >= 4: condition_met = True # Juryo index
        elif m['id'] == 'rank_yokozuna' and w['rank_index'] >= 9: condition_met = True # Yokozuna index
        elif m['id'] == 'skill_master' and skill_count >= 10: condition_met = True
        
        if condition_met:
            # Check if already unlocked
            c.execute('SELECT 1 FROM wrestler_milestones WHERE wrestler_id = ? AND milestone_id = ?', (w_id, m['id']))
            if not c.fetchone():
                # Unlock!
                c.execute('INSERT INTO wrestler_milestones (wrestler_id, milestone_id) VALUES (?, ?)', (w_id, m['id']))
                c.execute('UPDATE wrestlers SET skill_points = skill_points + ? WHERE id = ?', (m['reward_sp'], w_id))
                print(f"  MILESTONE UNLOCKED: {m['name']} (+{m['reward_sp']} SP)")
                unlocked_any = True
                
    if unlocked_any:
        conn.commit()
    conn.close()

def get_rank_info(xp: int) -> Tuple[int, Dict[str, Any]]:
    """Returns (rank_index, rank_data) based on XP."""
    for i, rank in enumerate(reversed(C.WRESTLER_RANKS)):
        # Check from highest to lowest
        if xp >= rank['xp_required']:
            return (len(C.WRESTLER_RANKS) - 1 - i, rank)
    return (0, C.WRESTLER_RANKS[0])

def record_win(winner_data: Dict[str, Any], loser_data: Dict[str, Any]) -> None:
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 1. Fetch fresh data for calculations
    c.execute('SELECT id, xp, rank_index, win_streak FROM wrestlers WHERE id IN (?, ?)', 
              (winner_data['id'], loser_data['id']))
    stats = {row['id']: dict(row) for row in c.fetchall()}
    
    w_stats = stats[winner_data['id']]
    l_stats = stats[loser_data['id']]
    
    # 2. Calculate Rewards (XP)
    # Base XP
    w_xp_gain = C.XP_BASE_WIN
    l_xp_gain = C.XP_BASE_LOSS
    
    # Rank Difference Bonus (Underdog XP)
    rank_diff = l_stats['rank_index'] - w_stats['rank_index']
    if rank_diff > 0:
        w_xp_gain += rank_diff * C.XP_RANK_DIFF_BONUS
        print(f"  Underdog Bonus! +{rank_diff * C.XP_RANK_DIFF_BONUS} XP")

    # 3. Calculate Rewards (SP)
    # Get Rank Multipliers
    w_rank_data = C.WRESTLER_RANKS[w_stats['rank_index']]
    l_rank_data = C.WRESTLER_RANKS[l_stats['rank_index']]
    
    # Streak Bonus (Every 3 wins)
    streak_bonus = 0
    new_streak = w_stats['win_streak'] + 1
    if new_streak % 3 == 0:
        streak_bonus = C.SP_STREAK_BONUS
    
    # Underdog SP Bonus
    underdog_sp = C.SP_UNDERDOG_BONUS if rank_diff > 0 else 0
    
    # Final Calculation with Diminishing Returns
    w_sp_raw = C.SP_BASE_WIN + streak_bonus + underdog_sp
    w_sp_gain = math.floor(w_sp_raw * w_rank_data['sp_multiplier'])
    
    l_sp_gain = math.floor(C.SP_BASE_LOSS * l_rank_data['sp_multiplier'])
    # Minimum 1 SP if base was > 0
    if w_sp_gain < 1 and w_sp_raw > 0: w_sp_gain = 1
    if l_sp_gain < 1: l_sp_gain = 1
    
    # 4. Check Rank Ups
    w_new_xp = w_stats['xp'] + w_xp_gain
    l_new_xp = l_stats['xp'] + l_xp_gain
    
    w_new_rank_idx, _ = get_rank_info(w_new_xp)
    l_new_rank_idx, _ = get_rank_info(l_new_xp)
    
    if w_new_rank_idx > w_stats['rank_index']:
        print(f"  RANK UP! {winner_data['name']} is now {C.WRESTLER_RANKS[w_new_rank_idx]['name']}!")
        
    # 5. Update Database
    # Winner
    c.execute('''UPDATE wrestlers SET 
              matches = matches + 1, 
              wins = wins + 1, 
              win_streak = ?, 
              xp = ?, 
              rank_index = ?, 
              skill_points = skill_points + ? 
              WHERE id = ?''', 
              (new_streak, w_new_xp, w_new_rank_idx, w_sp_gain, winner_data['id']))
              
    # Loser
    c.execute('''UPDATE wrestlers SET 
              matches = matches + 1, 
              losses = losses + 1, 
              win_streak = 0, 
              xp = ?, 
              rank_index = ?, 
              skill_points = skill_points + ? 
              WHERE id = ?''', 
              (l_new_xp, l_new_rank_idx, l_sp_gain, loser_data['id']))
              
    # Record Match
    c.execute('INSERT INTO matches (p1_id, p2_id, winner_id) VALUES (?, ?, ?)', 
              (winner_data['id'], loser_data['id'], winner_data['id']))
              
    conn.commit()
    conn.close()
    
    # Check Milestones AFTER update/commit so stats are fresh
    check_milestones(winner_data['id'])
    
    print(f"Match recorded: {winner_data['name']} def. {loser_data['name']}")
    print(f"  Winner: +{w_xp_gain} XP, +{w_sp_gain} SP (Streak: {new_streak})")
    print(f"  Loser: +{l_xp_gain} XP, +{l_sp_gain} SP")

@app.route('/api/status', methods=['GET'])
def get_status():
    status = "WAITING"
    state = GAME_STATE.get('current_state', C.STATE_WAITING)
    if state != C.STATE_WAITING:
        status = "FIGHTING"
    return jsonify({"status": status, "state_id": state})

def run_flask():
    app.run(host=C.FLASK_HOST, port=C.FLASK_PORT)

# --- Game Classes ---

def draw_text_small(canvas: Any, x: float, y: float, text: str, color: Tuple[int, int, int]) -> None:
    """Draws text using the internal 3x5 font map from fonts.py."""
    cursor_x = int(x)
    cursor_y = int(y)
    
    for char in text.upper():
        if char in fonts.FONT_3x5:
            rows = fonts.FONT_3x5[char]
            for r, row_bits in enumerate(rows):
                # 3 bits wide
                for bit in range(3):
                    if (row_bits >> (2 - bit)) & 1:
                        canvas.SetPixel(cursor_x + bit, cursor_y + r, *color)
        
        cursor_x += 4 # 3px char + 1px gap

class Wrestler:
    def __init__(self, x: float, y: float, color: Tuple[int, int, int], name_or_data: Union[str, Dict[str, Any]]):
        self.start_x = x
        self.start_y = y
        self.x = float(x)
        self.y = float(y)
        self.vx = 0.0
        self.vy = 0.0
        self.is_out = False
        self.boost_timer = 0
        
        self.data: Optional[Dict[str, Any]] = None
        
        if isinstance(name_or_data, dict):
            self.data = name_or_data
            self.name = self.data.get('custom_name') if self.data.get('custom_name') else self.data['name']
            
            try:
                c_str = self.data.get('color', '255,255,255')
                self.color = tuple(map(int, c_str.split(',')))
            except:
                self.color = color 
            
            # Physics from DB
            self.mass = self.data.get('weight', 150) / 150.0 
            base_strength = self.data.get('strength', 1.0)
            base_technique = self.data.get('technique', 1.0)
            base_speed = self.data.get('speed', 1.0)
            
            # Apply skill bonuses
            if self.data.get('id'):
                bonuses = get_skill_bonuses(self.data['id'])
                # Style bonuses applied in get_skill_bonuses now!
                self.base_strength = base_strength * (1.0 + bonuses.get('strength', 0))
                self.base_technique = base_technique * (1.0 + bonuses.get('technique', 0))
                self.base_speed = base_speed * (1.0 + bonuses.get('speed', 0))
                if any(v > 0 for v in bonuses.values()):
                    print(f"  Skills active for {self.name}: +{bonuses}")
            else:
                self.base_strength = base_strength
                self.base_technique = base_technique
                self.base_speed = base_speed
        else:
            # Fallback
            self.name = str(name_or_data)
            self.color = color
            self.mass = random.uniform(0.8, 1.2)
            self.base_strength = random.uniform(0.8, 1.2)
            self.base_technique = 1.0
            self.base_speed = random.uniform(0.9, 1.1)

        # Initialize current stats
        self.strength = self.base_strength
        self.technique = self.base_technique
        self.speed = self.base_speed

    def apply_boost(self) -> None:
        self.boost_timer = 60 # 2 seconds at 30fps
        # 20% Boost
        self.strength = self.base_strength * 1.2
        self.technique = self.base_technique * 1.2
        self.speed = self.base_speed * 1.2

    def update(self) -> None:
        if self.boost_timer > 0:
            self.boost_timer -= 1
            if self.boost_timer == 0:
                # Reset
                self.strength = self.base_strength
                self.technique = self.base_technique
                self.speed = self.base_speed

    def reset(self) -> None:
        self.x = float(self.start_x)
        self.y = float(self.start_y)
        self.vx = 0.0
        self.vy = 0.0
        self.is_out = False
        self.boost_timer = 0
        self.strength = self.base_strength
        self.technique = self.base_technique
        self.speed = self.base_speed
        if not self.data:
            self.mass = random.uniform(0.8, 1.2)

    def draw(self, canvas: Any, shake_x: int = 0, shake_y: int = 0) -> None:
        draw_x = int(self.x + shake_x)
        draw_y = int(self.y + shake_y)
        
        draw_color = self.color
        # Flash if boosted
        if self.boost_timer > 0:
            if (self.boost_timer // 2) % 2 == 0:
                draw_color = C.COLOR_WHITE
                
        for i in range(C.WRESTLER_SIZE):
            for j in range(C.WRESTLER_SIZE):
                canvas.SetPixel(draw_x + i, draw_y + j, *draw_color)

class SumoGame:
    def __init__(self):
        self.options = RGBMatrixOptions()
        self.options.rows = C.HEIGHT
        self.options.cols = C.WIDTH
        self.options.chain_length = 1
        self.options.parallel = 1
        self.options.hardware_mapping = 'regular'  
        
        self.matrix = RGBMatrix(options=self.options)
        self.canvas = self.matrix.CreateFrameCanvas()
        
        self.state = C.STATE_WAITING
        self.timer = 0
        self.shake_time = 0
        self.winner: Optional[Wrestler] = None
        
        self.p1 = Wrestler(C.CENTER_X - 10, C.CENTER_Y - 1, C.COLOR_RED, "P1")
        self.p2 = Wrestler(C.CENTER_X + 8, C.CENTER_Y - 1, C.COLOR_BLUE, "P2")

    def apply_screen_shake(self, frames: int, intensity: int = 1) -> None:
        self.shake_time = frames

    def check_ring_out(self, wrestler: Wrestler) -> bool:
        wx = wrestler.x + C.WRESTLER_SIZE / 2
        wy = wrestler.y + C.WRESTLER_SIZE / 2
        dist_sq = (wx - C.CENTER_X)**2 + (wy - C.CENTER_Y)**2
        return dist_sq > C.RING_RADIUS**2

    def update_names_from_remote(self) -> None:
        if GAME_STATE['reset_requested']:
             if GAME_STATE['p1_data']:
                 self.p1 = Wrestler(C.CENTER_X - 10, C.CENTER_Y - 1, C.COLOR_RED, GAME_STATE['p1_data'])
             if GAME_STATE['p2_data']:
                 self.p2 = Wrestler(C.CENTER_X + 8, C.CENTER_Y - 1, C.COLOR_BLUE, GAME_STATE['p2_data'])
             
             # Conflict Resolution
             r1, g1, b1 = self.p1.color
             r2, g2, b2 = self.p2.color
             diff = abs(r1-r2) + abs(g1-g2) + abs(b1-b2)
             
             if diff < 50:
                 print("Color Conflict Detected! P2 changing to White Sash.")
                 self.p2.color = C.COLOR_SASH_CONFLICT
                 
             self.state = C.STATE_RESET
             self.timer = 1000 # Force immediate reset
             GAME_STATE['reset_requested'] = False

    def logic(self) -> None:
        globals()['current_game'] = self # Expose for API
        self.update_names_from_remote()
        
        # Update Boosts
        self.p1.update()
        self.p2.update()
        
        # Expose Status for Lockout
        GAME_STATE['current_state'] = self.state

        if self.state == C.STATE_THROW:
            self.p1.x += self.p1.vx
            self.p1.y += self.p1.vy
            self.p2.x += self.p2.vx
            self.p2.y += self.p2.vy
            self.p1.vx *= C.FRICTION
            self.p1.vy *= C.FRICTION
            self.p2.vx *= C.FRICTION
            self.p2.vy *= C.FRICTION

        if self.state == C.STATE_RESET:
            self.timer += 1
            if self.timer > C.TIMER_RESET_DELAY:
                self.p1.reset()
                self.p2.reset()
                self.state = C.STATE_INTRO
                self.timer = 0
                self.winner = None
        
        elif self.state == C.STATE_INTRO:
            self.timer += 1
            if self.timer > C.TIMER_INTRO_DURATION:
                self.state = C.STATE_READY
                self.timer = 0
                
        elif self.state == C.STATE_READY:
            self.timer += 1
            if self.timer > C.TIMER_READY_DURATION:
                self.state = C.STATE_TACHIAI
                self.timer = 0

        elif self.state == C.STATE_TACHIAI:
            self.p1.vx = C.CHARGE_SPEED * self.p1.speed
            self.p2.vx = -C.CHARGE_SPEED * self.p2.speed
            self.p1.x += self.p1.vx
            self.p2.x += self.p2.vx
            
            if (self.p2.x - self.p1.x) < C.WRESTLER_SIZE:
                midpoint = (self.p1.x + self.p2.x) / 2
                self.p1.x = midpoint - C.WRESTLER_SIZE/2
                self.p2.x = midpoint + C.WRESTLER_SIZE/2
                self.p1.vx = 0
                self.p2.vx = 0
                self.apply_screen_shake(5, 2)
                self.state = C.STATE_CLINCH
                self.timer = 0
                
        elif self.state == C.STATE_CLINCH:
            self.timer += 1
            if self.timer > C.TIMER_CLINCH_DURATION:
                self.state = C.STATE_STRUGGLE
                self.timer = 0
                
        elif self.state == C.STATE_STRUGGLE:
            self.timer += 1
            f1 = (self.p1.strength * random.uniform(0.8, 1.2)) / self.p2.mass
            f2 = (self.p2.strength * random.uniform(0.8, 1.2)) / self.p1.mass
            diff = f1 - f2
            push_amount = diff * C.PUSH_FORCE_BASE
            self.p1.x += push_amount
            self.p2.x += push_amount
            
            jitter_y = random.choice([-1, 0, 1]) * 0.5
            self.p1.y = self.p1.start_y + jitter_y
            self.p2.y = self.p2.start_y + jitter_y
            
            # Ring Out Logic
            if self.check_ring_out(self.p1):
                self.winner = self.p2
                self.state = C.STATE_WINNER
                if self.p1.data and self.p2.data: record_win(self.p2.data, self.p1.data)
                self.apply_screen_shake(10)
            elif self.check_ring_out(self.p2):
                self.winner = self.p1
                self.state = C.STATE_WINNER
                if self.p1.data and self.p2.data: record_win(self.p1.data, self.p2.data)
                self.apply_screen_shake(10)
            
            dist_from_center = abs((self.p1.x + C.WRESTLER_SIZE/2) - C.CENTER_X)
            chance = 0.02 + (dist_from_center / C.RING_RADIUS) * 0.05
            if random.random() < chance and self.timer > 30:
                p1_adv = self.p1.strength * self.p1.mass
                p2_adv = self.p2.strength * self.p2.mass
                total = p1_adv + p2_adv
                p1_win_chance = p1_adv / total
                
                if random.random() < p1_win_chance:
                    self.winner = self.p1 
                    loser = self.p2
                    dir = 1
                else:
                    self.winner = self.p2
                    loser = self.p1
                    dir = -1
                
                if self.p1.data and self.p2.data: record_win(self.winner.data, loser.data)

                loser.vx = dir * C.THROW_IMPULSE
                loser.vy = random.uniform(-2, 2)
                self.apply_screen_shake(8)
                self.state = C.STATE_THROW

        elif self.state == C.STATE_THROW:
            if self.check_ring_out(self.p1):
                self.winner = self.p2
                self.state = C.STATE_WINNER
            elif self.check_ring_out(self.p2):
                self.winner = self.p1
                self.state = C.STATE_WINNER
            
            if abs(self.p1.vx) < 0.1 and abs(self.p2.vx) < 0.1:
                 self.state = C.STATE_RESET
                 
        elif self.state == C.STATE_WINNER:
            self.timer += 1
            if self.timer > C.TIMER_WINNER_DURATION:
                self.state = C.STATE_WAITING
                self.timer = 0

    def draw_sidebar_text(self) -> None:
        col_center = 16
        
        if self.state == C.STATE_INTRO:
             lines = []
             # 1. P1 Name
             lines.append((self.p1.name, C.COLOR_RED))
             
             # 2. P1 Record (Optional)
             if self.p1.data:
                 rec1 = f"{self.p1.data.get('wins',0)}-{self.p1.data.get('losses',0)}"
                 lines.append((rec1, C.COLOR_GREY))
             
             # 3. VS
             lines.append(("VS", C.COLOR_WHITE))
             
             # 4. P2 Name
             lines.append((self.p2.name, C.COLOR_BLUE))
             
             # 5. P2 Record (Optional)
             if self.p2.data:
                 rec2 = f"{self.p2.data.get('wins',0)}-{self.p2.data.get('losses',0)}"
                 lines.append((rec2, C.COLOR_GREY))
                 
             # Calculate Layout
             print(f"DEBUG Layout: {lines}")
                 
             # Calculate Layout
             num_lines = len(lines)
             line_height = 5
             spacing = 1
             total_h = (num_lines * line_height) + ((num_lines - 1) * spacing)
             start_y = int((C.HEIGHT - total_h) / 2)
             
             # Draw
             curr_y = start_y
             for text, color in lines:
                 w = len(text) * 4 - 1
                 draw_text_small(self.canvas, col_center - w/2, curr_y, text, color)
                 curr_y += line_height + spacing

        elif self.state == C.STATE_READY:
             txt1 = "HAKKEYOI"
             w1 = len(txt1) * 4 - 1
             draw_text_small(self.canvas, col_center - w1/2, 8, txt1, C.COLOR_WHITE)
             
             txt2 = "READY"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, C.COLOR_GREY)

        elif self.state == C.STATE_TACHIAI:
             if (time.time() * 10) % 2 > 1: pass
             else:
                txt1 = "HAKKEYOI"
                w1 = len(txt1) * 4 - 1
                draw_text_small(self.canvas, col_center - w1/2, 8, txt1, C.COLOR_WHITE)
             
             txt2 = "READY"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, C.COLOR_GREY)

        elif self.state == C.STATE_STRUGGLE:
             if (self.timer // 10) % 2 == 0:
                txt1 = "NOKOTTA"
                w1 = len(txt1) * 4 - 1
                draw_text_small(self.canvas, col_center - w1/2, 8, txt1, C.COLOR_WHITE)
             
             txt2 = "FIGHT!"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, C.COLOR_GREY)

        elif self.state == C.STATE_WINNER:
             txt1 = "WINNER"
             w1 = len(txt1) * 4 - 1
             draw_text_small(self.canvas, col_center - w1/2, 8, txt1, C.COLOR_WHITE)
             
             if self.winner:
                 txt2 = self.winner.name.upper()
                 w2 = len(txt2) * 4 - 1
                 draw_text_small(self.canvas, col_center - w2/2, 16, txt2, self.winner.color)

        elif self.state == C.STATE_WAITING:
             col_center = 16
             txt = "WAITING"
             w = len(txt) * 4 - 1
             draw_text_small(self.canvas, col_center - w/2, 12, txt, C.COLOR_GREY)

    def draw(self) -> None:
        self.canvas.Clear()
        
        sx = 0
        sy = 0
        if self.shake_time > 0:
            sx = random.randint(-1, 1)
            sy = random.randint(-1, 1)
            self.shake_time -= 1

        # Sidebar Separator Line
        for y in range(C.HEIGHT):
            self.canvas.SetPixel(32, y, 20, 20, 20) 

        # Draw Ring (Dohyo) - Right Side
        for angle in range(0, 360, 5):
            rad = math.radians(angle)
            x = int(C.CENTER_X + sx + math.cos(rad) * C.RING_RADIUS)
            y = int(C.CENTER_Y + sy + math.sin(rad) * C.RING_RADIUS)
            if 0 <= x < C.WIDTH and 0 <= y < C.HEIGHT:
                self.canvas.SetPixel(x, y, *C.COLOR_RING)
        
        # Balance Elements: Salt Piles
        self.canvas.SetPixel(35, 2, 80, 80, 80)
        self.canvas.SetPixel(35, 29, 80, 80, 80)
        self.canvas.SetPixel(61, 2, 80, 80, 80)
        self.canvas.SetPixel(61, 29, 80, 80, 80)

        self.p1.draw(self.canvas, sx, sy)
        self.p2.draw(self.canvas, sx, sy)
        
        self.draw_sidebar_text()
        
        # Winner Blink
        if self.state == C.STATE_WINNER and self.winner:
            if (self.timer // 5) % 2 == 0:
                 wx = int(self.winner.x + sx)
                 wy = int(self.winner.y + sy)
                 self.canvas.SetPixel(wx, wy-2, *self.winner.color)

        self.canvas = self.matrix.SwapOnVSync(self.canvas)

    def run(self) -> None:
        print("Sumo Smash Started! Press Ctrl+C to exit.")
        print(f"Mobile Remote running at: http://{C.FLASK_HOST}:{C.FLASK_PORT}")
        
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        
        try:
            while True:
                start_time = time.time()
                
                self.logic()
                self.draw()
                
                elapsed = time.time() - start_time
                delay = (1.0 / C.FPS) - elapsed
                if delay > 0:
                    time.sleep(delay)
                    
        except KeyboardInterrupt:
            print("\nExiting...")
            sys.exit(0)

if __name__ == "__main__":
    game = SumoGame()
    game.run()
