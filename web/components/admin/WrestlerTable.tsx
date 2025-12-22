"use client";

import { Wrestler } from "@/lib/api";
import { useState } from "react";
import { ArrowUpDown, Trophy, Skull } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WrestlerTableProps {
    wrestlers: Wrestler[];
}

type SortField = 'rank' | 'name' | 'wins' | 'win_rate' | 'xp';

export function WrestlerTable({ wrestlers }: WrestlerTableProps) {
    const [sortField, setSortField] = useState<SortField>('xp');
    const [sortDesc, setSortDesc] = useState(true);

    const sortedWrestlers = [...wrestlers].sort((a, b) => {
        const factor = sortDesc ? -1 : 1;

        if (sortField === 'rank') {
            return ((a.rank_index || 0) - (b.rank_index || 0)) * factor;
        }
        if (sortField === 'name') {
            return (a.custom_name || a.name).localeCompare(b.custom_name || b.name) * factor;
        }
        if (sortField === 'wins') {
            return ((a.wins || 0) - (b.wins || 0)) * factor;
        }
        if (sortField === 'win_rate') {
            const rateA = a.matches ? (a.wins / a.matches) : 0;
            const rateB = b.matches ? (b.wins / b.matches) : 0;
            return (rateA - rateB) * factor;
        }
        // Default XP
        return ((a.xp || 0) - (b.xp || 0)) * factor;
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(true);
        }
    };

    return (
        <div className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs font-medium border-b border-zinc-800">
                        <tr>
                            <th className="px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rank')}>
                                <div className="flex items-center gap-1">Rank <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">Wrestler <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('wins')}>
                                <div className="flex items-center gap-1 justify-center">Record <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('win_rate')}>
                                <div className="flex items-center gap-1">Win Rate <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('xp')}>
                                <div className="flex items-center gap-1 justify-end">XP <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {sortedWrestlers.map((w) => {
                            const winRate = w.matches > 0 ? (w.wins / w.matches) * 100 : 0;
                            return (
                                <tr key={w.id} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-zinc-500">
                                        <div className="flex flex-col">
                                            <span className="text-zinc-300 font-bold">{w.rank_name || "Jonokuchi"}</span>
                                            <span className="text-[10px] opacity-50">{w.rank_jp}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: `rgb(${w.color})` }}
                                            >
                                                <span className="text-xs text-white/50 font-mono">#{w.avatar_seed ? w.avatar_seed % 99 : '00'}</span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-zinc-200">{w.custom_name || w.name}</div>
                                                <div className="text-xs text-zinc-500">{w.stable || "Free Agent"}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2 font-mono">
                                            <span className="text-green-500">{w.wins}W</span>
                                            <span className="text-zinc-600">-</span>
                                            <span className="text-red-500">{w.losses}L</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden w-24">
                                                <div
                                                    className="h-full bg-indigo-500"
                                                    style={{ width: `${winRate}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-zinc-400 w-8 text-right">{Math.round(winRate)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-zinc-400">
                                        {w.xp?.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
