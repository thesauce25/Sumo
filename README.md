# 🏋️ Sumo Smash

A retro 8-bit sumo wrestling game designed for **LED Matrix displays** (or desktop emulation). Features a **mobile remote control** for selecting wrestlers and triggering fights.

![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **LED Matrix Display**: Renders on a 64x32 RGB LED panel via `rpi-rgb-led-matrix` (or emulator for desktop dev)
- **Physics-Based Fighting**: Mass, strength, speed, and technique stats determine fight outcomes
- **Wrestler Database**: SQLite-backed persistence for wrestler stats, win/loss records, and match history
- **Mobile Remote Control**: Next.js web app for selecting fighters and initiating matches
- **Procedural Generation**: Random wrestler names, colors, bios, and stats

---

## 🏗️ Architecture

```
┌─────────────────┐       HTTP API       ┌──────────────────┐
│  Mobile Remote  │◄────────────────────►│  Python Backend  │
│   (Next.js)     │   :5001 /api/*       │   (Flask + Game) │
└─────────────────┘                      └──────────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │  LED Matrix      │
                                         │  (or Emulator)   │
                                         └──────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+**
- **Node.js 18+** (for web remote)
- **Hardware** (optional): Raspberry Pi + RGB LED Matrix

### 1. Clone & Install Backend

```bash
cd /path/to/Sumo
python3 -m venv .venv
source .venv/bin/activate
pip install flask flask-cors rgbmatrixemulator
```

> **On Raspberry Pi**: Install `rpi-rgb-led-matrix` instead of `rgbmatrixemulator`.

### 2. Run the Game

```bash
python3 sumo_game.py
```

The game will start in **WAITING** mode. Access the API at `http://localhost:5001`.

### 3. Run the Mobile Remote (Optional)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000` to access the retro remote control.

---

## 📡 API Reference

| Endpoint                    | Method | Description                        |
|-----------------------------|--------|------------------------------------|
| `/api/wrestlers`            | GET    | List all active wrestlers          |
| `/api/wrestlers`            | POST   | Create a new random wrestler       |
| `/api/wrestlers/<id>`       | GET    | Get wrestler details               |
| `/api/wrestlers/<id>`       | DELETE | Soft-delete (deactivate) wrestler  |
| `/api/fight`                | POST   | Start a fight `{p1_id, p2_id}`     |
| `/api/history`              | GET    | Get match history (last 50)        |
| `/api/status`               | GET    | Get current game state             |

---

## 🗄️ Data Schema

### Wrestler Object

```json
{
  "id": 1,
  "name": "Takaho",
  "custom_name": "The Mountain",
  "stable": "Thunder",
  "height": 185.5,
  "weight": 155.2,
  "strength": 1.2,
  "technique": 0.95,
  "speed": 1.1,
  "wins": 5,
  "losses": 2,
  "matches": 7,
  "color": "255,30,30",
  "is_active": 1,
  "bio": "Takaho is a legendary warrior from the Thunder stable...",
  "avatar_seed": 123456
}
```

### Match Object

```json
{
  "id": 1,
  "timestamp": "2025-12-10 21:00:00",
  "p1_name": "Takaho",
  "p2_name": "Hakuvuji",
  "winner_name": "Takaho"
}
```

---

## ⚙️ Configuration

All game constants are in `constants.py`:

| Constant          | Default    | Description                    |
|-------------------|------------|--------------------------------|
| `FLASK_PORT`      | `5001`     | API server port                |
| `FLASK_HOST`      | `0.0.0.0`  | API server host                |
| `DB_FILE`         | `sumo_data.db` | SQLite database file       |
| `WIDTH` / `HEIGHT`| `64` / `32`| LED matrix dimensions          |
| `FPS`             | `30`       | Game loop frames per second    |
| `RING_RADIUS`     | `13`       | Dohyo (ring) radius in pixels  |

---

## 🎮 Game States

| State       | Description                              |
|-------------|------------------------------------------|
| `WAITING`   | Idle, awaiting fight request via API     |
| `INTRO`     | Displays wrestler names and records      |
| `READY`     | "HAKKEYOI" (Get Ready) screen            |
| `TACHIAI`   | Initial charge toward each other         |
| `CLINCH`    | Impact moment                            |
| `STRUGGLE`  | Physics-based pushing battle             |
| `THROW`     | Loser is thrown out of the ring          |
| `WINNER`    | Victory celebration                      |

---

## 📁 Project Structure

```
Sumo/
├── sumo_game.py       # Main game loop, Flask API, game logic
├── constants.py       # All configurable constants
├── fonts.py           # 3x5 pixel font definitions
├── sumo_data.db       # SQLite wrestler/match database
└── web/               # Next.js mobile remote control
    ├── app/           # App router pages
    ├── components/    # React components
    └── lib/           # Utilities
```

---

## 🧪 Testing Locally

1. **Start the emulator**:  

   ```bash
   python3 sumo_game.py
   ```

2. **Create test wrestlers**:  

   ```bash
   curl -X POST http://localhost:5001/api/wrestlers
   curl -X POST http://localhost:5001/api/wrestlers
   ```

3. **Trigger a fight**:  

   ```bash
   curl -X POST http://localhost:5001/api/fight \
     -H "Content-Type: application/json" \
     -d '{"p1_id": 1, "p2_id": 2}'
   ```

---

## 📜 License

MIT License - Have fun building!
