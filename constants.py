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

# --- Skill Points & XP Economy ---
SP_BASE_WIN = 2         # Base SP for winning
SP_BASE_LOSS = 1        # Base SP for participating
SP_STREAK_BONUS = 1     # +1 SP per 3 wins in a row
SP_UNDERDOG_BONUS = 2   # +2 SP for beating higher rank

XP_BASE_WIN = 50        # Base XP for winning
XP_BASE_LOSS = 10       # Base XP for participating
XP_RANK_DIFF_BONUS = 10 # XP bonus per rank difference (lower beating higher)

# --- Wrestler Ranks (D&D Style Levels) ---
# Multiplier reduces SP earnings as you rank up (diminishing returns)
WRESTLER_RANKS = [
    {"name": "Jonokuchi", "jp": "序ノ口", "xp_required": 0, "sp_multiplier": 1.0, "color": "#a0a0a0"},
    {"name": "Jonidan", "jp": "序二段", "xp_required": 200, "sp_multiplier": 0.95, "color": "#c0c0c0"},
    {"name": "Sandanme", "jp": "三段目", "xp_required": 600, "sp_multiplier": 0.9, "color": "#6fa8dc"},
    {"name": "Makushita", "jp": "幕下", "xp_required": 1200, "sp_multiplier": 0.85, "color": "#3d85c6"},
    {"name": "Juryo", "jp": "十両", "xp_required": 2000, "sp_multiplier": 0.8, "color": "#93c47d"},
    {"name": "Maegashira", "jp": "前頭", "xp_required": 3000, "sp_multiplier": 0.75, "color": "#6aa84f"},
    {"name": "Komusubi", "jp": "小結", "xp_required": 4500, "sp_multiplier": 0.7, "color": "#e69138"},
    {"name": "Sekiwake", "jp": "関脇", "xp_required": 6500, "sp_multiplier": 0.65, "color": "#e06666"},
    {"name": "Ozeki", "jp": "大関", "xp_required": 9000, "sp_multiplier": 0.6, "color": "#cc0000"},
    {"name": "Yokozuna", "jp": "横綱", "xp_required": 12000, "sp_multiplier": 0.5, "color": "#f1c232"},
]

# --- Skill Tree (Kimarite-Based) ---
# 5 Branches × 4 Skills = 20 Total Skills
# Each skill provides stat bonuses when unlocked

SKILL_BRANCHES = {
    "OSHI": {
        "name": "Oshi-Waza",
        "jp": "押し技",
        "description": "Pushing and thrusting techniques",
        "color": "#e63c3c",
        "skills": [
            {"id": "oshidashi", "name": "Oshidashi", "jp": "押し出し", "desc": "Frontal push out", "tier": 1, "cost": 1, "effect": {"strength": 0.05}},
            {"id": "tsukidashi", "name": "Tsukidashi", "jp": "突き出し", "desc": "Thrust out with locked elbows", "tier": 2, "cost": 2, "effect": {"strength": 0.08}},
            {"id": "oshitaoshi", "name": "Oshitaoshi", "jp": "押し倒し", "desc": "Push opponent down", "tier": 3, "cost": 3, "effect": {"strength": 0.10}},
            {"id": "hatakikomi", "name": "Hatakikomi", "jp": "叩き込み", "desc": "Slap down technique", "tier": 4, "cost": 5, "effect": {"strength": 0.12, "technique": 0.05}},
            {"id": "oshi_mastery", "name": "Grand Oshi", "jp": "大押し", "desc": "Legendary pushing mastery", "tier": 5, "cost": 8, "effect": {"strength": 0.15}},
            {"id": "oshi_legend", "name": "Oshi Yokozuna", "jp": "押し横綱", "desc": "Push technique of a Grand Champion", "tier": 6, "cost": 12, "effect": {"strength": 0.20, "technique": 0.08}},
        ]
    },
    "YORI": {
        "name": "Yori-Waza",
        "jp": "寄り技",
        "description": "Grappling and forcing techniques",
        "color": "#3c78ff",
        "skills": [
            {"id": "yorikiri", "name": "Yorikiri", "jp": "寄り切り", "desc": "Frontal force out with belt grip", "tier": 1, "cost": 1, "effect": {"strength": 0.04, "technique": 0.02}},
            {"id": "yoritaoshi", "name": "Yoritaoshi", "jp": "寄り倒し", "desc": "Force opponent down with grip", "tier": 2, "cost": 2, "effect": {"strength": 0.06, "technique": 0.03}},
            {"id": "abisetaoshi", "name": "Abisetaoshi", "jp": "浴びせ倒し", "desc": "Backward force down", "tier": 3, "cost": 3, "effect": {"strength": 0.08, "technique": 0.04}},
            {"id": "kimedashi", "name": "Kimedashi", "jp": "極め出し", "desc": "Arm barring force out", "tier": 4, "cost": 5, "effect": {"strength": 0.10, "technique": 0.06}},
            {"id": "yori_mastery", "name": "Grand Yori", "jp": "大寄り", "desc": "Legendary grappling mastery", "tier": 5, "cost": 8, "effect": {"strength": 0.12, "technique": 0.08}},
            {"id": "yori_legend", "name": "Yori Yokozuna", "jp": "寄り横綱", "desc": "Grapple technique of a Grand Champion", "tier": 6, "cost": 12, "effect": {"strength": 0.15, "technique": 0.12}},
        ]
    },
    "NAGE": {
        "name": "Nage-Waza",
        "jp": "投げ技",
        "description": "Throwing techniques",
        "color": "#ffc83c",
        "skills": [
            {"id": "uwatenage", "name": "Uwatenage", "jp": "上手投げ", "desc": "Overarm throw", "tier": 1, "cost": 1, "effect": {"technique": 0.05}},
            {"id": "shitatenage", "name": "Shitatenage", "jp": "下手投げ", "desc": "Underarm throw", "tier": 2, "cost": 2, "effect": {"technique": 0.08}},
            {"id": "kotenage", "name": "Kotenage", "jp": "小手投げ", "desc": "Armlock throw", "tier": 3, "cost": 3, "effect": {"technique": 0.10, "speed": 0.03}},
            {"id": "kubinage", "name": "Kubinage", "jp": "首投げ", "desc": "Headlock throw", "tier": 4, "cost": 5, "effect": {"technique": 0.12, "strength": 0.05}},
            {"id": "nage_mastery", "name": "Grand Nage", "jp": "大投げ", "desc": "Legendary throwing mastery", "tier": 5, "cost": 8, "effect": {"technique": 0.18}},
            {"id": "nage_legend", "name": "Nage Yokozuna", "jp": "投げ横綱", "desc": "Throw technique of a Grand Champion", "tier": 6, "cost": 12, "effect": {"technique": 0.25, "speed": 0.05}},
        ]
    },
    "KAKE": {
        "name": "Kake-Waza",
        "jp": "掛け技",
        "description": "Leg tripping techniques",
        "color": "#3cc88c",
        "skills": [
            {"id": "ketaguri", "name": "Ketaguri", "jp": "蹴手繰り", "desc": "Inside ankle sweep", "tier": 1, "cost": 1, "effect": {"speed": 0.05}},
            {"id": "sotogake", "name": "Sotogake", "jp": "外掛け", "desc": "Outside leg trip", "tier": 2, "cost": 2, "effect": {"speed": 0.06, "technique": 0.03}},
            {"id": "uchigake", "name": "Uchigake", "jp": "内掛け", "desc": "Inside leg trip", "tier": 3, "cost": 3, "effect": {"speed": 0.08, "technique": 0.05}},
            {"id": "kawazugake", "name": "Kawazugake", "jp": "河津掛け", "desc": "Hooking backward counter throw", "tier": 4, "cost": 5, "effect": {"speed": 0.10, "technique": 0.08}},
            {"id": "kake_mastery", "name": "Grand Kake", "jp": "大掛け", "desc": "Legendary tripping mastery", "tier": 5, "cost": 8, "effect": {"speed": 0.15, "technique": 0.05}},
            {"id": "kake_legend", "name": "Kake Yokozuna", "jp": "掛け横綱", "desc": "Tripping technique of a Grand Champion", "tier": 6, "cost": 12, "effect": {"speed": 0.20, "technique": 0.10}},
        ]
    },
    "HINERI": {
        "name": "Hineri-Waza",
        "jp": "捻り技",
        "description": "Twisting techniques",
        "color": "#a050dc",
        "skills": [
            {"id": "shitatehineri", "name": "Shitatehineri", "jp": "下手捻り", "desc": "Underarm twist down", "tier": 1, "cost": 1, "effect": {"technique": 0.04, "speed": 0.02}},
            {"id": "uwatehineri", "name": "Uwatehineri", "jp": "上手捻り", "desc": "Overarm twist down", "tier": 2, "cost": 2, "effect": {"technique": 0.06, "speed": 0.03}},
            {"id": "makiotoshi", "name": "Makiotoshi", "jp": "巻き落とし", "desc": "Twist down with arm wrap", "tier": 3, "cost": 3, "effect": {"technique": 0.08, "speed": 0.05}},
            {"id": "tokkurinage", "name": "Tokkurinage", "jp": "徳利投げ", "desc": "Two-handed head twist", "tier": 4, "cost": 5, "effect": {"technique": 0.12, "speed": 0.06}},
            {"id": "hineri_mastery", "name": "Grand Hineri", "jp": "大捻り", "desc": "Legendary twisting mastery", "tier": 5, "cost": 8, "effect": {"technique": 0.15, "speed": 0.08}},
            {"id": "hineri_legend", "name": "Hineri Yokozuna", "jp": "捻り横綱", "desc": "Twisting technique of a Grand Champion", "tier": 6, "cost": 12, "effect": {"technique": 0.22, "speed": 0.10}},
        ]
    }
}

# --- Fighting Styles (Emergent Classes) ---
FIGHTING_STYLES = {
    "oshi_specialist": {
        "id": "oshi_specialist", "name": "Oshi Specialist", "jp": "押し相撲",
        "desc": "Master of pushing attacks. +5% Strength.",
        "condition": lambda s: s.get('OSHI', 0) >= 4,
        "bonus": {"strength": 0.05}
    },
    "yori_specialist": {
        "id": "yori_specialist", "name": "Yori Specialist", "jp": "寄り相撲",
        "desc": "Master of grappling. +5% Technique.",
        "condition": lambda s: s.get('YORI', 0) >= 4,
        "bonus": {"technique": 0.05}
    },
    "nage_specialist": {
        "id": "nage_specialist", "name": "Nage Specialist", "jp": "投げ相撲",
        "desc": "Master of throws. +5% Technique.",
        "condition": lambda s: s.get('NAGE', 0) >= 4,
        "bonus": {"technique": 0.05}
    },
    "speed_demon": {
        "id": "speed_demon", "name": "Speed Demon", "jp": "スピードスター",
        "desc": "Relentless pace. +5% Speed.",
        "condition": lambda s: s.get('KAKE', 0) >= 3 and s.get('HINERI', 0) >= 3,
        "bonus": {"speed": 0.05}
    },
    "grand_champion": {
        "id": "grand_champion", "name": "Grand Champion", "jp": "横綱スタイル",
        "desc": "The pinnacle of sumo. All stats +5%.",
        "condition": lambda s: sum(s.values()) >= 15, # 15 total skills
        "bonus": {"strength": 0.05, "technique": 0.05, "speed": 0.05}
    }
}

# --- Milestones (Achievements) ---
MILESTONES = [
    {"id": "first_blood", "name": "First Victory", "jp": "初勝利", 
     "desc": "Win your first match", "reward_sp": 5},
    {"id": "win_streak_3", "name": "On Fire", "jp": "三連勝", 
     "desc": "Win 3 matches in a row", "reward_sp": 5},
    {"id": "win_streak_10", "name": "Unstoppable", "jp": "十連勝", 
     "desc": "Win 10 matches in a row", "reward_sp": 20},
    {"id": "rank_juryo", "name": "Sekitori Debut", "jp": "十両昇進", 
     "desc": "Reach Juryo rank", "reward_sp": 15},
    {"id": "rank_yokozuna", "name": "Living Legend", "jp": "横綱昇進", 
     "desc": "Reach Yokozuna rank", "reward_sp": 100},
    {"id": "skill_master", "name": "Technique Master", "jp": "技のデパート", 
     "desc": "Unlock 10 skills", "reward_sp": 20},
]
