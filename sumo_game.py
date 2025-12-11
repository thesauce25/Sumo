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

# --- Database Setup ---
DB_FILE = 'sumo_data.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
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
        is_active INTEGER DEFAULT 1
    )''')
    
    # Simple migration check: see if custom_name exists, if not add it
    try:
        c.execute('SELECT custom_name FROM wrestlers LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating DB: Adding custom_name column...")
        c.execute('ALTER TABLE wrestlers ADD COLUMN custom_name TEXT')

    # Migration for is_active
    try:
        c.execute('SELECT is_active FROM wrestlers LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating DB: Adding is_active column...")
        c.execute('ALTER TABLE wrestlers ADD COLUMN is_active INTEGER DEFAULT 1')
    # Match History
    c.execute('''CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        p1_id INTEGER,
        p2_id INTEGER,
        winner_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()

# Initialize on start
init_db()

# --- Flask Setup (API Server) ---
# Suppress Flask logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS # Need to install flask-cors
except ImportError:
    print("Flask or Flask-CORS not found. Please install: pip install flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app) # Allow cross-origin requests from Next.js (port 3000)

# Shared State (Game Loop <-> Web Server)
GAME_STATE = {
    "p1_data": None,
    "p2_data": None,
    "reset_requested": False
}

# Helper: Generate Random wrestler
STABLES = ["Thunder", "Mountain", "Dragon", "Ocean", "Phoenix"]
NAMES_FIRST = ["Taka", "Haku", "Yama", "Koto", "Tochi", "Waka", "Teru", "Haru"]
NAMES_LAST = ["ho", "vuji", "zato", "shoryu", "nishiki", "zakura", "umi", "bayama"]

def generate_random_wrestler():
    name = random.choice(NAMES_FIRST) + random.choice(NAMES_LAST)
    stable = random.choice(STABLES)
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

@app.route('/api/wrestlers', methods=['GET'])
def get_wrestlers():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE is_active = 1 ORDER BY wins DESC')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/wrestlers/<int:w_id>', methods=['GET'])
def get_wrestler_detail(w_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE id = ?', (w_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return jsonify(dict(row))
    return jsonify({"error": "Not found"}), 404

@app.route('/api/wrestlers/<int:w_id>', methods=['DELETE'])
def delete_wrestler(w_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Soft Delete
    c.execute('UPDATE wrestlers SET is_active = 0 WHERE id = ?', (w_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/wrestlers', methods=['POST'])
def create_wrestler():
    req_data = request.json or {}
    data = generate_random_wrestler()
    
    # Overrides
    custom_name = req_data.get('custom_name') # Optional
    if req_data.get('color'):
        # Validate format "r,g,b"
        color_override = req_data.get('color')
        # Use override color in data tuple
        data = (data[0], data[1], data[2], data[3], data[4], data[5], data[6], color_override)
        
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''INSERT INTO wrestlers 
              (name, custom_name, stable, height, weight, strength, technique, speed, color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
              (data[0], custom_name, data[1], data[2], data[3], data[4], data[5], data[6], data[7]))
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "name": data[0], "custom_name": custom_name, "stable": data[1]})

@app.route('/api/fight', methods=['POST'])
def api_fight():
    data = request.json
    p1_id = data.get('p1_id')
    p2_id = data.get('p2_id')
    
    if not p1_id or not p2_id:
        return jsonify({"error": "Missing wrestler IDs"}), 400

    # Fetch stats from DB to load into Game
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE id IN (?, ?)', (p1_id, p2_id))
    rows = c.fetchall()
    conn.close()
    
    if len(rows) != 2:
         return jsonify({"error": "Wrestlers not found"}), 404

    # Map to Game State
    w1 = dict(rows[0]) if rows[0]['id'] == int(p1_id) else dict(rows[1])
    w2 = dict(rows[1]) if rows[1]['id'] == int(p1_id) else dict(rows[0])

    GAME_STATE['p1_data'] = w1
    GAME_STATE['p2_data'] = w2
    GAME_STATE['reset_requested'] = True
    
    print(f"Match Requested: {w1['name']} vs {w2['name']}")
    return jsonify({"success": True})

@app.route('/api/history', methods=['GET'])
def get_history():
    wrestler_id = request.args.get('wrestler_id')
    
    conn = sqlite3.connect(DB_FILE)
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

def record_win(winner_data, loser_data):
    """Called by Game Loop when match ends"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Update Winner
    c.execute('UPDATE wrestlers SET matches = matches + 1, wins = wins + 1 WHERE id = ?', (winner_data['id'],))
    
    # Update Loser
    c.execute('UPDATE wrestlers SET matches = matches + 1, losses = losses + 1 WHERE id = ?', (loser_data['id'],))
    
    # Record Match
    c.execute('INSERT INTO matches (p1_id, p2_id, winner_id) VALUES (?, ?, ?)', 
              (winner_data['id'], loser_data['id'], winner_data['id'])) # Simplify: p1 is winner, p2 is loser for tracking or just generic
    
    conn.commit()
    conn.close()
    print(f"Match recorded: {winner_data['name']} def. {loser_data['name']}")

def run_flask():
    # Run on 0.0.0.0 to be accessible from local network (Phone)
    # Port 5001 to avoid MacOS AirPlay conflict on 5000
    app.run(host='0.0.0.0', port=5001)

# --- Hardware/Emulator Fallback ---
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

# --- Constants & Vibe Tuning ---
# Display
WIDTH = 64
HEIGHT = 32
CENTER_X = 48 # Moved to right side
CENTER_Y = HEIGHT // 2
RING_RADIUS = 13 # Slightly smaller to fit safely
FPS = 30
VSYNC = True

# Colors (R, G, B)
COLOR_BLACK = (0, 0, 0)
COLOR_RING  = (40, 40, 40)  # Faint grey
COLOR_RED   = (255, 30, 30)
COLOR_BLUE  = (30, 30, 255)
COLOR_WHITE = (200, 200, 200) # Salt/Text
COLOR_GREY  = (100, 100, 100) # Subtitles

# Entities
WRESTLER_SIZE = 2 # 2x2 pixels

# Sumo Physics 'Vibe' Constants
STATE_RESET    = 0
STATE_TACHIAI  = 1 # Charge
STATE_CLINCH   = 2 # Impact/Lock
STATE_STRUGGLE = 3 # Pushing
STATE_THROW    = 4 # Finish
STATE_WINNER   = 5 # Celebration
STATE_INTRO    = 6 # Pre-fight Ritual
STATE_READY    = 7 # Hakkeyoi (Get Ready)

CHARGE_SPEED = 2.5    # Pixels per frame during charge
PUSH_FORCE_BASE = 0.2 # Base movement during struggle
JITTER_INTENSITY = 1  # Visual vibration pixel amount
THROW_IMPULSE = 4.0   # Velocity when thrown
FRICTION = 0.9        # Friction for thrown bodies

# Font
FONT_3x5 = {
    'A': [0x2, 0x5, 0x7, 0x5, 0x5], 'B': [0x6, 0x5, 0x6, 0x5, 0x6], 'C': [0x3, 0x4, 0x4, 0x4, 0x3],
    'D': [0x6, 0x5, 0x5, 0x5, 0x6], 'E': [0x7, 0x4, 0x7, 0x4, 0x7], 'F': [0x7, 0x4, 0x6, 0x4, 0x4],
    'G': [0x3, 0x4, 0x5, 0x5, 0x3], 'H': [0x5, 0x5, 0x7, 0x5, 0x5], 'I': [0x7, 0x2, 0x2, 0x2, 0x7],
    'J': [0x1, 0x1, 0x1, 0x5, 0x2], 'K': [0x5, 0x5, 0x6, 0x5, 0x5], 'L': [0x4, 0x4, 0x4, 0x4, 0x7],
    'M': [0x5, 0x7, 0x5, 0x5, 0x5], 'N': [0x6, 0x5, 0x5, 0x5, 0x5], 'O': [0x2, 0x5, 0x5, 0x5, 0x2],
    'P': [0x6, 0x5, 0x6, 0x4, 0x4], 'Q': [0x2, 0x5, 0x5, 0x6, 0x3], 'R': [0x6, 0x5, 0x6, 0x6, 0x5],
    'S': [0x3, 0x4, 0x2, 0x1, 0x6], 'T': [0x7, 0x2, 0x2, 0x2, 0x2], 'U': [0x5, 0x5, 0x5, 0x5, 0x2],
    'V': [0x5, 0x5, 0x5, 0x2, 0x2], 'W': [0x5, 0x5, 0x5, 0x7, 0x5], 'X': [0x5, 0x5, 0x2, 0x5, 0x5],
    'Y': [0x5, 0x5, 0x2, 0x2, 0x2], 'Z': [0x7, 0x1, 0x2, 0x4, 0x7], '!': [0x2, 0x2, 0x2, 0x0, 0x2],
    ' ': [0x0, 0x0, 0x0, 0x0, 0x0]
}

def draw_text_small(canvas, x, y, text, color):
    """Draws text using the internal 3x5 font map."""
    cursor_x = int(x)
    cursor_y = int(y)
    
    for char in text.upper():
        if char in FONT_3x5:
            rows = FONT_3x5[char]
            for r, row_bits in enumerate(rows):
                # 3 bits wide (usually)
                for bit in range(3):
                    if (row_bits >> (2 - bit)) & 1:
                        canvas.SetPixel(cursor_x + bit, cursor_y + r, *color)
        
        cursor_x += 4 # 3px char + 1px gap

class Wrestler:
    def __init__(self, x, y, color, name_or_data):
        self.start_x = x
        self.start_y = y
        self.x = float(x)
        self.y = float(y)
        
        self.data = None
        if isinstance(name_or_data, dict):
            self.data = name_or_data
            # Use Custom Name if available, else Sumo Name
            self.name = self.data.get('custom_name') if self.data.get('custom_name') else self.data['name']
            
            # Parse color safely
            try:
                c_str = self.data.get('color', '255,255,255')
                self.color = tuple(map(int, c_str.split(',')))
            except:
                self.color = color 
            
            # Physics from DB
            self.mass = self.data.get('weight', 150) / 150.0 # Normalize around 1.0 (150kg)
            self.strength = self.data.get('strength', 1.0)
            self.speed = self.data.get('speed', 1.0)
        else:
            # Fallback (Legacy)
            self.name = name_or_data
            self.color = color
            self.mass = random.uniform(0.8, 1.2)
            self.strength = random.uniform(0.8, 1.2)
            self.speed = random.uniform(0.9, 1.1)
        
        self.vx = 0.0
        self.vy = 0.0
        self.is_out = False

    def reset(self):
        self.x = float(self.start_x)
        self.y = float(self.start_y)
        self.vx = 0.0
        self.vy = 0.0
        self.is_out = False
        # Do not randomize stats on reset, keep them consistent from DB
        if not self.data:
            self.mass = random.uniform(0.8, 1.2)
            self.strength = random.uniform(0.8, 1.2)

    def draw(self, canvas, shake_x=0, shake_y=0):
        draw_x = int(self.x + shake_x)
        draw_y = int(self.y + shake_y)
        for i in range(WRESTLER_SIZE):
            for j in range(WRESTLER_SIZE):
                canvas.SetPixel(draw_x + i, draw_y + j, *self.color)

class SumoGame:
    def __init__(self):
        self.options = RGBMatrixOptions()
        self.options.rows = HEIGHT
        self.options.cols = WIDTH
        self.options.chain_length = 1
        self.options.parallel = 1
        self.options.hardware_mapping = 'regular'  
        
        self.matrix = RGBMatrix(options=self.options)
        self.canvas = self.matrix.CreateFrameCanvas()
        
        self.state = STATE_RESET
        self.timer = 0
        self.shake_time = 0
        self.shake_x = 0
        self.shake_y = 0
        self.winner = None
        
        # Spawning (CENTER_X is now 48)
        self.p1 = Wrestler(CENTER_X - 10, CENTER_Y - 1, COLOR_RED, "RED")
        self.p2 = Wrestler(CENTER_X + 8, CENTER_Y - 1, COLOR_BLUE, "BLUE")

    def apply_screen_shake(self, frames, intensity=1):
        self.shake_time = frames

    def check_ring_out(self, wrestler):
        wx = wrestler.x + WRESTLER_SIZE / 2
        wy = wrestler.y + WRESTLER_SIZE / 2
        dist_sq = (wx - CENTER_X)**2 + (wy - CENTER_Y)**2
        if dist_sq > RING_RADIUS**2:
            return True
        return False

    def update_names_from_remote(self):
        """Checks shared state for name updates."""
        if GAME_STATE['reset_requested']:
             # Re-init wrestlers with new data
             if GAME_STATE['p1_data']:
                 self.p1 = Wrestler(CENTER_X - 10, CENTER_Y - 1, COLOR_RED, GAME_STATE['p1_data'])
             if GAME_STATE['p2_data']:
                 self.p2 = Wrestler(CENTER_X + 8, CENTER_Y - 1, COLOR_BLUE, GAME_STATE['p2_data'])
             
             # COLOR CONFLICT RESOLUTION
             # If colors are too similar (sum of abs diff < 50), set P2 to White
             r1, g1, b1 = self.p1.color
             r2, g2, b2 = self.p2.color
             diff = abs(r1-r2) + abs(g1-g2) + abs(b1-b2)
             
             if diff < 50:
                 print("Color Conflict Detected! P2 changing to White Sash.")
                 self.p2.color = (200, 200, 200) # White/Grey
                 # Update name to indicate sash? Optional.
                 
             self.state = STATE_RESET
             self.timer = 1000 # Force immediate reset logic in logic()
             GAME_STATE['reset_requested'] = False

    def logic(self):
        # Poll Remote
        self.update_names_from_remote()

        if self.state == STATE_THROW:
            self.p1.x += self.p1.vx
            self.p1.y += self.p1.vy
            self.p2.x += self.p2.vx
            self.p2.y += self.p2.vy
            self.p1.vx *= FRICTION
            self.p1.vy *= FRICTION
            self.p2.vx *= FRICTION
            self.p2.vy *= FRICTION

        if self.state == STATE_RESET:
            self.timer += 1
            if self.timer > 30:
                self.p1.reset()
                self.p2.reset()
                self.state = STATE_INTRO # Go to Intro Sequence
                self.timer = 0
                self.winner = None
        
        elif self.state == STATE_INTRO:
            self.timer += 1
            if self.timer > 90: # 3 seconds of stare down (Red vs Blue)
                self.state = STATE_READY # Transition to Ready
                self.timer = 0
                
        elif self.state == STATE_READY:
            self.timer += 1
            if self.timer > 50: # ~1.6 seconds of "Ready"
                self.state = STATE_TACHIAI
                self.timer = 0

        elif self.state == STATE_TACHIAI:
            self.p1.vx = CHARGE_SPEED * self.p1.speed
            self.p2.vx = -CHARGE_SPEED * self.p2.speed
            self.p1.x += self.p1.vx
            self.p2.x += self.p2.vx
            
            if (self.p2.x - self.p1.x) < WRESTLER_SIZE:
                midpoint = (self.p1.x + self.p2.x) / 2
                self.p1.x = midpoint - WRESTLER_SIZE/2
                self.p2.x = midpoint + WRESTLER_SIZE/2
                self.p1.vx = 0
                self.p2.vx = 0
                self.apply_screen_shake(5, 2)
                self.state = STATE_CLINCH
                self.timer = 0
                
        elif self.state == STATE_CLINCH:
            self.timer += 1
            if self.timer > 10:
                self.state = STATE_STRUGGLE
                self.timer = 0
                
        elif self.state == STATE_STRUGGLE:
            self.timer += 1
            f1 = (self.p1.strength * random.uniform(0.8, 1.2)) / self.p2.mass
            f2 = (self.p2.strength * random.uniform(0.8, 1.2)) / self.p1.mass
            diff = f1 - f2
            push_amount = diff * PUSH_FORCE_BASE
            self.p1.x += push_amount
            self.p2.x += push_amount
            
            jitter_y = random.choice([-1, 0, 1]) * 0.5
            self.p1.y = self.p1.start_y + jitter_y
            self.p2.y = self.p2.start_y + jitter_y
            
            # Ring Out Logic
            if self.check_ring_out(self.p1):
                self.winner = self.p2
                self.state = STATE_WINNER
                if self.p1.data and self.p2.data: record_win(self.p2.data, self.p1.data)
                self.apply_screen_shake(10)
            elif self.check_ring_out(self.p2):
                self.winner = self.p1
                self.state = STATE_WINNER
                if self.p1.data and self.p2.data: record_win(self.p1.data, self.p2.data)
                self.apply_screen_shake(10)
            
            dist_from_center = abs((self.p1.x + WRESTLER_SIZE/2) - CENTER_X)
            chance = 0.02 + (dist_from_center / RING_RADIUS) * 0.05
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

                loser.vx = dir * THROW_IMPULSE
                loser.vy = random.uniform(-2, 2)
                self.apply_screen_shake(8)
                self.state = STATE_THROW

        elif self.state == STATE_THROW:
            if self.check_ring_out(self.p1):
                self.winner = self.p2
                self.state = STATE_WINNER
            elif self.check_ring_out(self.p2):
                self.winner = self.p1
                self.state = STATE_WINNER
            
            if abs(self.p1.vx) < 0.1 and abs(self.p2.vx) < 0.1:
                 self.state = STATE_RESET
                 
        elif self.state == STATE_WINNER:
            self.timer += 1
            if self.timer > 150: # 5 seconds
                self.state = STATE_RESET
                self.timer = 0

    def draw_sidebar_text(self):
        # Text Column is x=0 to x=30
        col_center = 16
        
        if self.state == STATE_INTRO:
             # RED
             txt1 = self.p1.name
             w1 = len(txt1) * 4 - 1
             draw_text_small(self.canvas, col_center - w1/2, 4, txt1, COLOR_RED)
             # VS
             txt2 = "VS"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 13, txt2, COLOR_WHITE)
             # BLUE
             txt3 = self.p2.name
             w3 = len(txt3) * 4 - 1
             draw_text_small(self.canvas, col_center - w3/2, 22, txt3, COLOR_BLUE)

        elif self.state == STATE_READY:
             # Static HAKKEYOI
             txt1 = "HAKKEYOI"
             w1 = len(txt1) * 4 - 1
             draw_text_small(self.canvas, col_center - w1/2, 8, txt1, COLOR_WHITE)
             
             txt2 = "READY"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, COLOR_GREY)

        elif self.state == STATE_TACHIAI:
             if (time.time() * 10) % 2 > 1: pass
             else:
                txt1 = "HAKKEYOI"
                w1 = len(txt1) * 4 - 1
                draw_text_small(self.canvas, col_center - w1/2, 8, txt1, COLOR_WHITE)
             
             txt2 = "READY"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, COLOR_GREY)

        elif self.state == STATE_STRUGGLE:
             if (self.timer // 10) % 2 == 0:
                txt1 = "NOKOTTA"
                w1 = len(txt1) * 4 - 1
                draw_text_small(self.canvas, col_center - w1/2, 8, txt1, COLOR_WHITE)
             
             txt2 = "FIGHT!"
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, COLOR_GREY)

        elif self.state == STATE_WINNER and self.winner:
             txt1 = "WINNER"
             w1 = len(txt1) * 4 - 1
             draw_text_small(self.canvas, col_center - w1/2, 8, txt1, COLOR_WHITE)
             
             txt2 = self.winner.name.upper()
             w2 = len(txt2) * 4 - 1
             draw_text_small(self.canvas, col_center - w2/2, 16, txt2, self.winner.color)

    def draw(self):
        self.canvas.Clear()
        
        sx = 0
        sy = 0
        if self.shake_time > 0:
            sx = random.randint(-1, 1)
            sy = random.randint(-1, 1)
            self.shake_time -= 1

        # Sidebar Separator Line
        for y in range(HEIGHT):
            self.canvas.SetPixel(32, y, 20, 20, 20) # Very faint grey line

        # Draw Ring (Dohyo) - Right Side
        for angle in range(0, 360, 5):
            rad = math.radians(angle)
            x = int(CENTER_X + sx + math.cos(rad) * RING_RADIUS)
            y = int(CENTER_Y + sy + math.sin(rad) * RING_RADIUS)
            if 0 <= x < WIDTH and 0 <= y < HEIGHT:
                self.canvas.SetPixel(x, y, *COLOR_RING)
        
        # Balance Elements: Salt Piles (Corners of Arena)
        # Arena is ~32 to 64
        # Top Left of Arena
        self.canvas.SetPixel(35, 2, 80, 80, 80)
        # Bottom Left of Arena
        self.canvas.SetPixel(35, 29, 80, 80, 80)
        # Top Right of Arena
        self.canvas.SetPixel(61, 2, 80, 80, 80)
        # Bottom Right of Arena
        self.canvas.SetPixel(61, 29, 80, 80, 80)

        # Wrestlers
        self.p1.draw(self.canvas, sx, sy)
        self.p2.draw(self.canvas, sx, sy)
        
        # Sidebar Text
        self.draw_sidebar_text()
        
        # Winner Blink
        if self.state == STATE_WINNER and self.winner:
            if (self.timer // 5) % 2 == 0:
                 wx = int(self.winner.x + sx)
                 wy = int(self.winner.y + sy)
                 self.canvas.SetPixel(wx, wy-2, *self.winner.color)

        self.canvas = self.matrix.SwapOnVSync(self.canvas)

    def run(self):
        print("Sumo Smash Started! Press Ctrl+C to exit.")
        print("Mobile Remote running at: http://<YOUR_IP>:5001")
        
        # Start Flask in separate thread
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        
        try:
            while True:
                start_time = time.time()
                
                self.logic()
                self.draw()
                
                # Cap FPS (Roughly)
                elapsed = time.time() - start_time
                delay = (1.0 / FPS) - elapsed
                if delay > 0:
                    time.sleep(delay)
                    
        except KeyboardInterrupt:
            print("\nExiting...")
            sys.exit(0)

if __name__ == "__main__":
    game = SumoGame()
    game.run()
