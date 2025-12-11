# Constants for Sumo Game Refactor

# --- Database ---
DB_FILE = 'sumo_data.db'

# --- Network ---
FLASK_PORT = 5001
FLASK_HOST = '0.0.0.0'

# --- Generator Lists ---
STABLES = ["Thunder", "Mountain", "Dragon", "Ocean", "Phoenix"]
NAMES_FIRST = ["Taka", "Haku", "Yama", "Koto", "Tochi", "Waka", "Teru", "Haru"]
NAMES_LAST = ["ho", "vuji", "zato", "shoryu", "nishiki", "zakura", "umi", "bayama"]

# Bio Generation
BIO_ADJECTIVES = ["legendary", "unstoppable", "humble", "ferocious", "agile", "stoic", "mountainous", "swift"]
BIO_NOUNS = ["warrior", "titan", "defender", "champion", "spirit", "destroyer", "technician"]
BIO_VERBS = ["crushing", "tossing", "outsmarting", "dominating", "slamming", "uprooting"]

# --- Display & Dimensions ---
WIDTH = 64
HEIGHT = 32
CENTER_X = 48  # Moved to right side
CENTER_Y = HEIGHT // 2
RING_RADIUS = 13  # Slightly smaller to fit safely
FPS = 30
VSYNC = True

# --- Colors (R, G, B) ---
COLOR_BLACK = (0, 0, 0)
COLOR_RING = (40, 40, 40)   # Faint grey
COLOR_RED = (255, 30, 30)
COLOR_BLUE = (30, 30, 255)
COLOR_WHITE = (200, 200, 200)  # Salt/Text
COLOR_GREY = (100, 100, 100)   # Subtitles
COLOR_SASH_CONFLICT = (200, 200, 200) # White sash override

# --- Entities ---
WRESTLER_SIZE = 2  # 2x2 pixels

# --- Game States ---
STATE_RESET = 0
STATE_TACHIAI = 1   # Charge
STATE_CLINCH = 2    # Impact/Lock
STATE_STRUGGLE = 3  # Pushing
STATE_THROW = 4     # Finish
STATE_WINNER = 5    # Celebration
STATE_INTRO = 6     # Pre-fight Ritual
STATE_READY = 7     # Hakkeyoi (Get Ready)
STATE_WAITING = 8   # Idle awaiting API

# --- Physics & Gameplay ---
CHARGE_SPEED = 2.5       # Pixels per frame during charge
PUSH_FORCE_BASE = 0.2    # Base movement during struggle
JITTER_INTENSITY = 1     # Visual vibration pixel amount
THROW_IMPULSE = 4.0      # Velocity when thrown
FRICTION = 0.9           # Friction for thrown bodies

# --- Timers (Frames) ---
TIMER_RESET_DELAY = 30
TIMER_INTRO_DURATION = 90
TIMER_READY_DURATION = 50
TIMER_CLINCH_DURATION = 10
TIMER_WINNER_DURATION = 150
