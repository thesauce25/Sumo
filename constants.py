# Constants for Sumo Game - AUTHENTIC JAPANESE SUMO EDITION

# --- Database ---
DB_FILE = 'sumo_data.db'

# --- Network ---
FLASK_PORT = 5001
FLASK_HOST = '0.0.0.0'

# --- Authentic Heya (Stables) ---
# Real sumo stables from Japan with their naming traditions
STABLES = [
    "Kokonoe",      # 九重部屋 - Famous for Chiyonofuji
    "Dewanoumi",    # 出羽海部屋 - Historic stable, Dewa- prefix
    "Kasugano",     # 春日野部屋 - Tochi- naming tradition
    "Miyagino",     # 宮城野部屋 - Hakuho's stable
    "Isegahama",    # 伊勢ヶ濱部屋 - Harumafuji's stable
    "Sadogatake",   # 佐渡ヶ嶽部屋 - Koto- naming tradition
    "Tagonoura",    # 田子ノ浦部屋 - Newer stable
    "Tokitsukaze",  # 時津風部屋 - Historic ichimon
]

# --- Shikona (Ring Name) Components ---
# First elements - common prefixes with meaning
NAMES_FIRST = [
    "Koto",     # 琴 (Koto harp) - Sadogatake tradition
    "Tochi",    # 栃 (Horse chestnut) - Kasugano tradition
    "Waka",     # 若 (Young/Fresh)
    "Teru",     # 照 (Shining/Radiant)
    "Haru",     # 春 (Spring)
    "Ryu",      # 龍 (Dragon)
    "Ura",      # 浦 (Bay/Inlet)
    "Asa",      # 朝 (Morning)
    "Taka",     # 高 (High/Noble)
    "Oki",      # 沖 (Open Sea)
    "Haku",     # 白 (White/Pure)
    "Dai",      # 大 (Great)
]

# Second elements - suffixes with meaning
NAMES_LAST = [
    "yama",     # 山 (Mountain)
    "umi",      # 海 (Sea)
    "shio",     # 潮 (Tide)
    "fuji",     # 富士 (Mt. Fuji)
    "nishiki",  # 錦 (Brocade)
    "arashi",   # 嵐 (Storm)
    "zakura",   # 桜 (Cherry Blossom)
    "nosato",   # の里 (Of the Village)
    "noshin",   # の心 (Of Spirit)
    "bayashi",  # 林 (Grove)
    "tenro",    # 天狼 (Heavenly Wolf)
    "ho",       # 鵬 (Phoenix)
]

# --- Bio Generation with Sumo Terminology ---
BIO_ADJECTIVES = [
    "legendary", "fierce", "disciplined", "promising", 
    "powerful", "agile", "stoic", "relentless",
    "honorable", "formidable", "rising", "spirited"
]

BIO_NOUNS = [
    "rikishi",          # Sumo wrestler
    "sumotori",         # Sumo practitioner  
    "ozeki hopeful",    # Second-highest rank aspirant
    "sekitori",         # Top division wrestler
    "newcomer",         # Fresh talent
    "veteran",          # Experienced fighter
    "yokozuna",         # Grand Champion (highest rank)
    "komusubi",         # Fourth-highest rank
]

BIO_VERBS = [
    "mastering yorikiri",       # Force-out technique
    "perfecting uwatenage",     # Overarm throw
    "dominating at tachiai",    # Initial charge
    "studying kimarite",        # Winning techniques
    "training for basho",       # Tournament preparation
    "executing oshidashi",      # Push-out technique
    "refining hatakikomi",      # Slap-down technique
]

# --- Display & Dimensions ---
WIDTH = 64
HEIGHT = 32
CENTER_X = 48  # Moved to right side
CENTER_Y = HEIGHT // 2
RING_RADIUS = 13  # Slightly smaller to fit safely
FPS = 30
VSYNC = True

# --- Colors (R, G, B) - GBA-Inspired Sumo Palette ---
COLOR_BLACK = (0, 0, 0)
COLOR_RING = (60, 50, 40)       # Tatami/clay color
COLOR_RED = (220, 80, 60)       # Crimson mawashi
COLOR_BLUE = (60, 80, 180)      # Indigo
COLOR_WHITE = (240, 230, 200)   # Warm off-white
COLOR_GREY = (120, 110, 100)    # Warm grey
COLOR_SASH_CONFLICT = (240, 200, 80)  # Gold sash override

# --- Entities ---
WRESTLER_SIZE = 2  # 2x2 pixels

# --- Game States ---
STATE_RESET = 0
STATE_TACHIAI = 1   # Charge (立ち合い)
STATE_CLINCH = 2    # Impact/Lock (組み合い)
STATE_STRUGGLE = 3  # Pushing (押し合い)
STATE_THROW = 4     # Finish (決まり手)
STATE_WINNER = 5    # Celebration (勝ち)
STATE_INTRO = 6     # Pre-fight Ritual (儀式)
STATE_READY = 7     # Hakkeyoi (はっけよい - Get Ready)
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
