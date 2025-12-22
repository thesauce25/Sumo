/**
 * Sumo Smash - Frontend Constants
 * Centralized configuration to eliminate magic values
 */

// --- Timing Constants (milliseconds) ---
export const WRESTLER_POLL_INTERVAL_MS = 5000;
export const STATUS_POLL_INTERVAL_MS = 1000;
export const ACTIVE_MATCH_POLL_INTERVAL_MS = 2000;
export const WAITING_DOTS_INTERVAL_MS = 500;
export const RING_OUT_PHASE_MS = 3000;      // "RING OUT!" dramatic pause
export const DECISION_PHASE_MS = 3000;       // "SHOBU-ARI" decision announcement
export const WINNER_DISPLAY_MS = 5000;       // Winner celebration screen
export const SKILL_POPUP_DURATION_MS = 1500;  // How long skill popups display

// --- UI Constants ---
export const AVATAR_SIZE_CONTROLLER = 44;
export const STAT_BAR_MAX_VALUE = 2.0;
export const RING_SIZE = 300;
export const WRESTLER_MARKER_SIZE = 40;
export const WRESTLER_SPRITE_SIZE = 64;  // PixelSumo sprite size on watch page
export const COLLISION_SHAKE_DURATION_MS = 100;
export const POSITION_LERP_FACTOR = 0.25;  // Smoothing for position updates

// --- Game Engine Dimensions ---
// These must match the Python constants (WIDTH=64, HEIGHT=32)
export const ENGINE_WIDTH = 64;
export const ENGINE_HEIGHT = 32;

// --- Button Text States ---
export const BUTTON_TEXT = {
    TACHIAI: 'TACHIAI!',
    HAKKEYOI: 'HAKKEYOI...',
    NOKOTTA: 'NOKOTTA...',
} as const;

export type ButtonTextValue = typeof BUTTON_TEXT[keyof typeof BUTTON_TEXT];

// --- Wrestler Ranks (synced with Python constants.py) ---
export const WRESTLER_RANKS = [
    { name: "Jonokuchi", xp: 0, color: "#a0a0a0" },
    { name: "Jonidan", xp: 200, color: "#c0c0c0" },
    { name: "Sandanme", xp: 600, color: "#6fa8dc" },
    { name: "Makushita", xp: 1200, color: "#3d85c6" },
    { name: "Juryo", xp: 2000, color: "#93c47d" },
    { name: "Maegashira", xp: 3000, color: "#6aa84f" },
    { name: "Komusubi", xp: 4500, color: "#e69138" },
    { name: "Sekiwake", xp: 6500, color: "#e06666" },
    { name: "Ozeki", xp: 9000, color: "#cc0000" },
    { name: "Yokozuna", xp: 12000, color: "#f1c232" },
] as const;

export type RankName = typeof WRESTLER_RANKS[number]['name'];
