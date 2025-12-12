"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Wrestler, getApiUrl } from "@/lib/api";
import { WRESTLER_POLL_INTERVAL_MS, STATUS_POLL_INTERVAL_MS, AVATAR_SIZE_CONTROLLER, STAT_BAR_MAX_VALUE, BUTTON_TEXT, ButtonTextValue } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PixelSumo } from "@/components/PixelSumo";
import { ArrowLeft } from "lucide-react";

export default function ControllerPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [p1, setP1] = useState<string>("");
    const [p2, setP2] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [buttonText, setButtonText] = useState<ButtonTextValue>(BUTTON_TEXT.TACHIAI);

    const fetchWrestlers = useCallback(() => {
        api.getWrestlers().then(data => {
            setWrestlers(data);
            if (data.length >= 2 && !p1 && !p2) {
                setP1(data[0].id.toString());
                setP2(data[1].id.toString());
            }
        });
    }, [p1, p2]);

    useEffect(() => {
        fetchWrestlers();
        const pollInterval = setInterval(fetchWrestlers, WRESTLER_POLL_INTERVAL_MS);
        return () => clearInterval(pollInterval);
    }, [fetchWrestlers]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${getApiUrl()}/status`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === "FIGHTING") {
                        setLoading(true);
                        setButtonText(BUTTON_TEXT.NOKOTTA);
                    } else if (buttonText === BUTTON_TEXT.NOKOTTA) {
                        setLoading(false);
                        setButtonText(BUTTON_TEXT.TACHIAI);
                        fetchWrestlers();
                    }
                })
                .catch(err => console.error(err));
        }, STATUS_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [buttonText, fetchWrestlers]);

    const handleFight = async () => {
        if (!p1 || !p2) return;
        setLoading(true);
        setButtonText(BUTTON_TEXT.HAKKEYOI);
        await api.startFight(p1, p2);
    };

    const getWrestler = (idStr: string) => wrestlers.find(w => w.id.toString() === idStr);
    const w1 = getWrestler(p1);
    const w2 = getWrestler(p2);

    return (
        <div className="h-[100dvh] p-3 flex flex-col max-w-md mx-auto bg-[#1a1428] overflow-hidden">
            {/* GBA Top Border */}
            <div className="h-1.5 bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] -mx-3 -mt-3 mb-2" />

            {/* Compact Header */}
            <header className="flex items-center gap-3 mb-2">
                <Link href="/">
                    <Button variant="outline" size="icon" className="gba-panel h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="font-[family-name:var(--font-dotgothic)] text-lg text-[#FFD700] [text-shadow:_1px_1px_0_#000]">TACHIAI</h1>
            </header>

            {/* Main Content - Flex to fill space */}
            <div className="flex-1 flex flex-col justify-center gap-6 min-h-0">
                {/* EAST Fighter */}
                <div className="gba-menu-btn p-3 relative">
                    <div className="absolute top-1 right-2 text-2xl text-[#DC143C] opacity-40 font-[family-name:var(--font-dotgothic)]">東</div>
                    <p className="text-[10px] text-[#87CEEB] font-[family-name:var(--font-dotgothic)] mb-1">EAST</p>
                    <select
                        value={p1}
                        onChange={(e) => setP1(e.target.value)}
                        className="w-full bg-[#2a1f3d] text-white p-2 text-sm font-[family-name:var(--font-dotgothic)] border-2 border-[#3d2d5c] focus:border-[#FFD700] outline-none"
                    >
                        {wrestlers.map(w => (
                            <option key={w.id} value={w.id}>
                                {(w.custom_name || w.name).toUpperCase()} ({w.wins}-{w.matches - w.wins})
                            </option>
                        ))}
                    </select>
                    {w1 && (
                        <div className="mt-2 flex gap-3 items-center relative">
                            {/* KIAI OVERLAY */}
                            {buttonText === BUTTON_TEXT.NOKOTTA && (
                                <button
                                    onClick={() => api.fightAction(w1.id, 'kiai')}
                                    className="absolute inset-0 z-10 bg-red-600 active:bg-red-700 text-white font-[family-name:var(--font-dotgothic)] text-2xl animate-pulse border-4 border-yellow-400 flex flex-col items-center justify-center shadow-lg"
                                >
                                    <span>💥</span>
                                    <span>PUSH!</span>
                                </button>
                            )}

                            <div className="bg-[#1a1428] p-1.5 border-2 border-[#3d2d5c]">
                                <PixelSumo seed={w1.avatar_seed} color={w1.color} size={AVATAR_SIZE_CONTROLLER} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1.5">
                                    <span className="text-lg font-[family-name:var(--font-dotgothic)] text-[#FFD700]">{w1.wins}</span>
                                    <span className="text-[10px] text-gray-400">W</span>
                                    <span className="text-gray-500 mx-0.5">-</span>
                                    <span className="text-lg font-[family-name:var(--font-dotgothic)] text-[#DC143C]">{w1.matches - w1.wins}</span>
                                    <span className="text-[10px] text-gray-400">L</span>
                                </div>
                                <StatBar label="STR" value={w1.strength} color={w1.color} />
                                <StatBar label="TEC" value={w1.technique} color={w1.color} />
                                <StatBar label="SPD" value={w1.speed} color={w1.color} />
                            </div>
                        </div>
                    )}
                </div>

                {/* VS Badge - Minimal */}
                <div className="flex justify-center py-0.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#CD853F] to-[#8B4513] flex items-center justify-center border-2 border-[#DEB887]">
                        <span className="font-[family-name:var(--font-dotgothic)] text-xs text-white [text-shadow:_1px_1px_0_#000]">対</span>
                    </div>
                </div>

                {/* WEST Fighter */}
                <div className="gba-menu-btn p-3 relative">
                    <div className="absolute top-1 right-2 text-2xl text-[#50C878] opacity-40 font-[family-name:var(--font-dotgothic)]">西</div>
                    <p className="text-[10px] text-[#87CEEB] font-[family-name:var(--font-dotgothic)] mb-1">WEST</p>
                    <select
                        value={p2}
                        onChange={(e) => setP2(e.target.value)}
                        className="w-full bg-[#2a1f3d] text-white p-2 text-sm font-[family-name:var(--font-dotgothic)] border-2 border-[#3d2d5c] focus:border-[#50C878] outline-none"
                    >
                        {wrestlers.map(w => (
                            <option key={w.id} value={w.id}>
                                {(w.custom_name || w.name).toUpperCase()} ({w.wins}-{w.matches - w.wins})
                            </option>
                        ))}
                    </select>
                    {w2 && (
                        <div className="mt-2 flex gap-3 items-center relative">
                            {/* KIAI OVERLAY */}
                            {buttonText === BUTTON_TEXT.NOKOTTA && (
                                <button
                                    onClick={() => api.fightAction(w2.id, 'kiai')}
                                    className="absolute inset-0 z-10 bg-blue-600 active:bg-blue-700 text-white font-[family-name:var(--font-dotgothic)] text-2xl animate-pulse border-4 border-yellow-400 flex flex-col items-center justify-center shadow-lg"
                                >
                                    <span>💥</span>
                                    <span>PUSH!</span>
                                </button>
                            )}

                            <div className="bg-[#1a1428] p-1.5 border-2 border-[#3d2d5c]">
                                <PixelSumo seed={w2.avatar_seed} color={w2.color} size={AVATAR_SIZE_CONTROLLER} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1.5">
                                    <span className="text-lg font-[family-name:var(--font-dotgothic)] text-[#FFD700]">{w2.wins}</span>
                                    <span className="text-[10px] text-gray-400">W</span>
                                    <span className="text-gray-500 mx-0.5">-</span>
                                    <span className="text-lg font-[family-name:var(--font-dotgothic)] text-[#DC143C]">{w2.matches - w2.wins}</span>
                                    <span className="text-[10px] text-gray-400">L</span>
                                </div>
                                <StatBar label="STR" value={w2.strength} color={w2.color} />
                                <StatBar label="TEC" value={w2.technique} color={w2.color} />
                                <StatBar label="SPD" value={w2.speed} color={w2.color} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fight Button - PROMINENT */}
            <Button
                onClick={handleFight}
                disabled={loading || !p1 || !p2 || buttonText === BUTTON_TEXT.NOKOTTA}
                className="w-full h-16 text-xl font-[family-name:var(--font-dotgothic)] tracking-widest mt-3 bg-gradient-to-b from-[#FFD700] to-[#DAA520] text-black border-4 border-t-[#FFF8DC] border-l-[#FFF8DC] border-b-[#8B6914] border-r-[#8B6914] shadow-[0_4px_0_#5D4E0A] active:shadow-none active:translate-y-[3px] disabled:opacity-50 animate-pulse"
            >
                {buttonText}
            </Button>

            {/* GBA Bottom Border */}
            <div className="h-1.5 bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] -mx-3 -mb-3 mt-2" />
        </div>
    );
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[8px] w-6 text-gray-400">{label}</span>
            <div className="flex-1 h-1.5 bg-black/50 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.min(100, (value / STAT_BAR_MAX_VALUE) * 100)}%`, backgroundColor: `rgb(${color})` }} />
            </div>
        </div>
    )
}
