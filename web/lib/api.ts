const API_URL = 'http://192.168.1.43:5001/api';

export interface Wrestler {
    id: number;
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
}

export interface MatchRecord {
    id: number;
    p1_name: string;
    p1_custom?: string;
    p2_name: string;
    p2_custom?: string;
    winner_name: string;
    winner_custom?: string;
    timestamp: string;
}

export const api = {
    getWrestlers: async (): Promise<Wrestler[]> => {
        const res = await fetch(`${API_URL}/wrestlers`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch wrestlers');
        return res.json();
    },

    getWrestler: async (id: number): Promise<Wrestler> => {
        const res = await fetch(`${API_URL}/wrestlers/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch wrestler');
        return res.json();
    },

    deleteWrestler: async (id: number) => {
        const res = await fetch(`${API_URL}/wrestlers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete wrestler');
        return res.json();
    },

    createWrestler: async (custom_name?: string, color?: string): Promise<Wrestler> => {
        const res = await fetch(`${API_URL}/wrestlers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom_name, color })
        });
        if (!res.ok) throw new Error('Failed to create wrestler');
        return res.json();
    },

    startFight: async (p1_id: number, p2_id: number) => {
        const res = await fetch(`${API_URL}/fight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ p1_id, p2_id }),
        });
        if (!res.ok) throw new Error('Failed to start fight');
        return res.json();
    },

    getHistory: async (wrestlerId?: number): Promise<MatchRecord[]> => {
        const url = wrestlerId ? `${API_URL}/history?wrestler_id=${wrestlerId}` : `${API_URL}/history`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    }
};
