#!/usr/bin/env python3
import time
import random
import math
import sys
import os
import threading
import json
import logging

# --- Flask Setup (Mobile Remote) ---
# Suppress Flask logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

try:
    from flask import Flask, request, jsonify, render_template_string
except ImportError:
    print("Flask not found. Please install: pip install flask")
    sys.exit(1)

app = Flask(__name__)

# Shared State (Game Loop <-> Web Server)
GAME_STATE = {
    "p1_name": "RED",
    "p2_name": "BLUE",
    "reset_requested": False
}

# Embedded Mobile UI (HTML/CSS/JS)
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SUMO SMASH</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #212121;
            --p1: #e74c3c;
            --p2: #3498db;
            --text: #ecf0f1;
            --shadow: 4px 4px 0px #000;
        }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Press Start 2P', cursive;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100dvh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
            text-transform: uppercase;
        }
        /* Scanline Effect */
        body::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 2;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
        }

        h1 {
            font-size: 20px;
            line-height: 1.5;
            margin-bottom: 40px;
            text-shadow: 4px 4px 0px #000;
            color: #f1c40f;
        }
        
        .input-group {
            width: 100%;
            max-width: 350px;
            margin-bottom: 25px;
            position: relative;
            z-index: 3;
        }
        
        label {
            display: block;
            font-size: 10px;
            margin-bottom: 10px;
            color: #95a5a6;
        }
        
        input {
            width: 100%;
            padding: 15px;
            font-size: 16px;
            background: #000;
            border: 4px solid #fff;
            color: #fff;
            border-radius: 0; /* 8-bit ! */
            box-sizing: border-box;
            font-family: 'Press Start 2P', cursive;
            text-align: center;
            box-shadow: var(--shadow);
        }
        
        input:focus {
            outline: none;
            background: #111;
        }

        .red-input input { border-color: var(--p1); color: var(--p1); }
        .blue-input input { border-color: var(--p2); color: var(--p2); }
        
        button {
            width: 100%;
            max-width: 350px;
            padding: 25px;
            font-size: 20px;
            background: #e67e22; /* Arcade Orange */
            border: 4px solid #fff;
            color: white;
            border-radius: 0;
            cursor: pointer;
            box-shadow: var(--shadow);
            font-family: 'Press Start 2P', cursive;
            position: relative;
            z-index: 3;
            margin-top: 20px;
            transition: all 0.1s;
        }
        
        button:active {
            transform: translate(4px, 4px);
            box-shadow: none;
        }
        
        button:disabled {
            background: #7f8c8d;
            border-color: #95a5a6;
            cursor: not-allowed;
            transform: translate(4px, 4px);
            box-shadow: none;
        }

        .status {
            margin-top: 30px;
            height: 20px;
            color: #2ecc71;
            font-size: 10px;
            opacity: 0;
            transition: opacity 0.3s;
            text-shadow: 2px 2px 0px #000;
        }
        .show-status { opacity: 1; }
    </style>
</head>
<body>
    <h1>SUMO SMASH<br>CHAMPIONSHIP</h1>
    
    <div class="input-group red-input">
        <label>PLAYER 1 (RED)</label>
        <input type="text" id="p1" value="RED" maxlength="6">
    </div>
    
    <div class="input-group blue-input">
        <label>PLAYER 2 (BLUE)</label>
        <input type="text" id="p2" value="BLUE" maxlength="6">
    </div>
    
    <button id="fightBtn" onclick="startMatch()">FIGHT!</button>
    <div class="status" id="status">MATCH START!</div>

    <script>
        async function startMatch() {
            const p1 = document.getElementById('p1').value || "RED";
            const p2 = document.getElementById('p2').value || "BLUE";
            const btn = document.getElementById('fightBtn');
            const status = document.getElementById('status');
            
            // UX: Prevent Double Submission
            btn.disabled = true;
            btn.innerText = "LOADING...";
            
            try {
                const res = await fetch('/api/fight', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ p1_name: p1, p2_name: p2 })
                });
                
                if (res.ok) {
                    status.classList.add('show-status');
                    setTimeout(() => status.classList.remove('show-status'), 2000);
                    
                    // Keep disabled for a bit to prevent spamming restart
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.innerText = "REMATCH!";
                    }, 5000);
                } else {
                     // Error fallback
                     btn.disabled = false;
                     btn.innerText = "TRY AGAIN";
                }
            } catch (e) {
                console.error(e);
                btn.disabled = false;
                btn.innerText = "ERROR";
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/fight', methods=['POST'])
def api_fight():
    data = request.json
    GAME_STATE['p1_name'] = data.get('p1_name', 'RED')[:6].upper() # Limit 6 chars for display
    GAME_STATE['p2_name'] = data.get('p2_name', 'BLUE')[:6].upper()
    GAME_STATE['reset_requested'] = True
    print(f"Update received: {GAME_STATE['p1_name']} vs {GAME_STATE['p2_name']}")
    return jsonify({"success": True})

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
    def __init__(self, x, y, color, name):
        self.start_x = x
        self.start_y = y
        self.x = float(x)
        self.y = float(y)
        self.color = color
        self.name = name
        
        # Physics Stats
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
             self.p1.name = GAME_STATE['p1_name']
             self.p2.name = GAME_STATE['p2_name']
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
                self.apply_screen_shake(10)
            elif self.check_ring_out(self.p2):
                self.winner = self.p1
                self.state = STATE_WINNER
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
