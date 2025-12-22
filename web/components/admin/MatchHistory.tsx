"use client";

import { MatchRecord } from "@/lib/api";
import { Swords } from "lucide-react";

interface MatchHistoryProps {
    matches: MatchRecord[];
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";

    return Math.floor(seconds) + " seconds ago";
}

export function MatchHistory({ matches }: MatchHistoryProps) {
    if (matches.length === 0) {
        return (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                <Swords className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent matches found</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {matches.map((match) => {
                // Parse timestamp manually if it's a Firestore object or string
                let dateObj: Date = new Date(); // Default to now if invalid

                try {
                    // Handle Firestore Timestamp object if passed directly
                    if (match.timestamp && typeof match.timestamp === 'object' && 'seconds' in match.timestamp) {
                        dateObj = new Date(match.timestamp.seconds * 1000);
                    } else if (typeof match.timestamp === 'string') {
                        dateObj = new Date(match.timestamp);
                    }
                } catch (e) {
                    // Fallback to now
                }

                const timeStr = timeAgo(dateObj);

                const isP1Winner = match.winner_id === match.p1_id;

                return (
                    <div key={match.id} className="group relative flex items-center justify-between p-3 rounded-md border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 transition-colors">
                        <div className="flex items-center gap-4">
                            {/* P1 */}
                            <div className={`text-sm ${isP1Winner ? 'font-bold text-white' : 'text-zinc-500'}`}>
                                {match.p1_custom || match.p1_name}
                                {isP1Winner && <span className="ml-1.5 text-xs text-yellow-500">🏆</span>}
                            </div>

                            <span className="text-xs text-zinc-600 font-mono">vs</span>

                            {/* P2 */}
                            <div className={`text-sm ${!isP1Winner ? 'font-bold text-white' : 'text-zinc-500'}`}>
                                {match.p2_custom || match.p2_name}
                                {!isP1Winner && <span className="ml-1.5 text-xs text-yellow-500">🏆</span>}
                            </div>
                        </div>

                        <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                            {timeStr}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
