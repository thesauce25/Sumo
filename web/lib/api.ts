export const getApiUrl = () => {
    // Use Cloud Run backend for production
    return process.env.NEXT_PUBLIC_API_URL || 'https://sumo-server-1056239062336.us-central1.run.app/api';
};

export interface Wrestler {
    id: string;
    name: string;
    custom_name?: string;
    stable: string;
    height: number;
    weight: number;
    strength: number;
    technique: number;
    speed: number;
    wins: number;
    losses: number;
    matches: number;
    color: string;
    bio?: string;
    avatar_seed?: number;
    skill_points?: number;
    // Progression
    xp?: number;
    year?: number;
    rank_index?: number;
    rank_name?: string;
    rank_jp?: string;
    win_streak?: number;
    fighting_style?: string;
    milestones?: string[];
}

export interface Skill {
    id: string;
    name: string;
    jp: string;
    desc: string;
    tier: number;
    cost: number;
    effect: Record<string, number>;
}

export interface SkillBranch {
    name: string;
    jp: string;
    description: string;
    color: string;
    skills: Skill[];
}

export interface WrestlerSkillsResponse {
    skill_points: number;
    unlocked_skills: Array<Skill & { unlocked_at: string }>;
    total_bonuses: Record<string, number>;
}

export interface MatchRecord {
    id: string; // Changed from number to string as backend uses string IDs
    p1_id: string;
    p1_name: string;
    p1_custom?: string;
    p2_id: string;
    p2_name: string;
    p2_custom?: string;
    winner_id: string;
    winner_name: string;
    winner_custom?: string;
    loser_id?: string;
    timestamp: any; // Firestore timestamp
}

export const api = {
    getWrestlers: async (): Promise<Wrestler[]> => {
        const res = await fetch(`${getApiUrl()}/wrestlers`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch wrestlers');
        return res.json();
    },

    getWrestler: async (id: string): Promise<Wrestler> => {
        const res = await fetch(`${getApiUrl()}/wrestlers/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch wrestler');
        return res.json();
    },

    deleteWrestler: async (id: string) => {
        const res = await fetch(`${getApiUrl()}/wrestlers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete wrestler');
        return res.json();
    },

    createWrestler: async (custom_name?: string, color?: string): Promise<Wrestler> => {
        const res = await fetch(`${getApiUrl()}/wrestlers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom_name, color })
        });
        if (!res.ok) throw new Error('Failed to create wrestler');
        return res.json();
    },

    startFight: async (p1_id: string, p2_id: string) => {
        // Call the cloud match endpoint (creates a WebSocket-enabled match)
        const res = await fetch(`${getApiUrl()}/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ p1_id, p2_id }),
        });
        if (!res.ok) throw new Error('Failed to start fight');
        return res.json();
    },

    getHistory: async (wrestlerId?: string, limit: number = 10): Promise<MatchRecord[]> => {
        let url = `${getApiUrl()}/history?limit=${limit}`;
        if (wrestlerId) {
            url += `&wrestler_id=${wrestlerId}`;
        }
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    },

    // Skill Tree API
    getSkillTree: async (): Promise<Record<string, SkillBranch>> => {
        const res = await fetch(`${getApiUrl()}/skills`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch skill tree');
        return res.json();
    },

    getWrestlerSkills: async (wrestlerId: string): Promise<WrestlerSkillsResponse> => {
        const res = await fetch(`${getApiUrl()}/wrestlers/${wrestlerId}/skills`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch wrestler skills');
        return res.json();
    },

    unlockSkill: async (wrestlerId: string, skillId: string): Promise<{ success: boolean; skill_id: string; cost: number }> => {
        const res = await fetch(`${getApiUrl()}/wrestlers/${wrestlerId}/skills/${skillId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to unlock skill');
        }
        return res.json();
    },

    fightAction: async (wrestlerId: string | number, action: 'kiai' | 'push' | 'push_left' | 'push_right') => {
        const res = await fetch(`${getApiUrl()}/fight/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wrestler_id: wrestlerId, action: action.toUpperCase() })
        });
        if (!res.ok) throw new Error('Failed to perform action');
        return res.json();
    },

    resetMatch: async () => {
        const res = await fetch(`${getApiUrl()}/matches/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to reset match');
        return res.json();
    },

    // --- Remote Lobby API ---
    getLobbyStatus: async () => {
        const res = await fetch(`${getApiUrl()}/lobby/status`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch lobby status');
        return res.json();
    },

    joinLobby: async (side: 'p1' | 'p2', wrestlerId: string, wrestlerName: string) => {
        const res = await fetch(`${getApiUrl()}/lobby/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side, wrestler_id: wrestlerId, wrestler_name: wrestlerName })
        });
        if (!res.ok) throw new Error('Failed to join lobby');
        return res.json();
    },

    startLobbyMatch: async () => {
        const res = await fetch(`${getApiUrl()}/lobby/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to start lobby match');
        return res.json();
    },

    resetLobby: async () => {
        const res = await fetch(`${getApiUrl()}/lobby/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to reset lobby');
        return res.json();
    }
};
