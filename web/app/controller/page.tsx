"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Wrestler, getApiUrl } from "@/lib/api";
import { WRESTLER_POLL_INTERVAL_MS, STATUS_POLL_INTERVAL_MS, AVATAR_SIZE_CONTROLLER, STAT_BAR_MAX_VALUE, BUTTON_TEXT, ButtonTextValue } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PixelSumo } from "@/components/PixelSumo";
import { ArrowLeft, Gamepad2, RotateCcw, Eye } from "lucide-react";

export default function ControllerPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [p1, setP1] = useState<string>("");
    const [p2, setP2] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [buttonText, setButtonText] = useState<ButtonTextValue>(BUTTON_TEXT.TACHIAI);
    const [soloMode, setSoloMode] = useState(false); // Solo mode: control both wrestlers from one device
    const [twoPlayerMode, setTwoPlayerMode] = useState(false);

    // Sync Mode State
    const [syncMode, setSyncMode] = useState(false);
    const [mySide, setMySide] = useState<'p1' | 'p2' | null>(null);
    const [lobbyStatus, setLobbyStatus] = useState<any>(null);

    // UI State for improved selection
    const [selectorOpen, setSelectorOpen] = useState<'p1' | 'p2' | null>(null);

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

    // Sync Mode Polling
    useEffect(() => {
        if (!syncMode) return;

        const pollLobby = async () => {
            try {
                const status = await api.getLobbyStatus();
                setLobbyStatus(status);

                // Auto-update opponent ID if joined
                if (status.p1 && status.p1.id && mySide === 'p2') setP1(status.p1.id);
                if (status.p2 && status.p2.id && mySide === 'p1') setP2(status.p2.id);

            } catch (e) {
                console.error(e);
            }
        };

        pollLobby();
        const interval = setInterval(pollLobby, 1000);
        return () => clearInterval(interval);
    }, [syncMode, mySide]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${getApiUrl()}/status`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === "FIGHTING" || data.status === "COUNTDOWN") {
                        setLoading(true);
                        setButtonText(data.status === "COUNTDOWN" ? BUTTON_TEXT.HAKKEYOI : BUTTON_TEXT.NOKOTTA);
                    } else if (data.status === "GAME_OVER") {
                        // Match just ended - keep showing buttons but prepare for reset
                        // Will reset when status returns to IDLE/WAITING
                    } else if (data.status === "IDLE" || data.status === "WAITING") {
                        // Server is idle - reset to wrestler selection if we were in a match
                        if (buttonText === BUTTON_TEXT.NOKOTTA || buttonText === BUTTON_TEXT.HAKKEYOI || loading) {
                            setLoading(false);
                            setButtonText(BUTTON_TEXT.TACHIAI);
                            fetchWrestlers(); // Refresh to get updated win/loss records
                        }
                    }
                })
                .catch(err => console.error(err));
        }, STATUS_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [buttonText, fetchWrestlers, loading]);

    const triggerHaptic = (ms: number) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(ms);
        }
    };

    const handleFight = async () => {
        if (!p1 || !p2) return;
        // Validate: can't fight yourself
        if (p1 === p2) {
            alert("Cannot select the same wrestler for both sides!");
            return;
        }
        triggerHaptic(200); // Heavy thud for TACHIAI
        setLoading(true);
        setButtonText(BUTTON_TEXT.HAKKEYOI);
        await api.startFight(p1, p2);
    };

    const getWrestler = (idStr: string) => wrestlers.find(w => w.id.toString() === idStr);
    const w1 = getWrestler(p1);
    const w2 = getWrestler(p2);

    const handlePush = (wId: string) => {
        triggerHaptic(50); // Sharp tap for interactions
        api.fightAction(wId, 'push');
    };

    // --- 2P MODE RENDER ---
    if (twoPlayerMode) {
        return (
            <div className="h-[100dvh] w-full bg-[#1a1428] overflow-hidden flex flex-row relative">
                {/* Global Settings (Top Center Overlay) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 flex gap-2 p-2 pointer-events-auto opacity-50 hover:opacity-100 transition-opacity">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 text-[10px] font-[family-name:var(--font-dotgothic)] border border-white/20"
                        onClick={() => {
                            triggerHaptic(20);
                            setTwoPlayerMode(false);
                        }}
                    >
                        EXIT 2P
                    </Button>
                    <button
                        onClick={async () => {
                            if (window.confirm('Reset match?')) {
                                try {
                                    await api.resetMatch();
                                    setButtonText(BUTTON_TEXT.TACHIAI);
                                    setLoading(false);
                                } catch { }
                            }
                        }}
                        className="h-6 w-6 bg-red-900/50 flex items-center justify-center rounded border border-white/20 text-white"
                    >
                        <RotateCcw className="h-3 w-3" />
                    </button>
                </div>

                {/* FIGHT BUTTON OVERLAY (Centered) */}
                {buttonText === BUTTON_TEXT.TACHIAI || buttonText === BUTTON_TEXT.HAKKEYOI ? (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
                        <div className="pointer-events-auto">
                            <Button
                                onClick={handleFight}
                                disabled={loading || !p1 || !p2}
                                className="w-48 h-24 text-2xl font-[family-name:var(--font-dotgothic)] tracking-widest bg-gradient-to-b from-[#FFD700] to-[#DAA520] text-black border-4 border-white shadow-2xl animate-pulse"
                            >
                                {buttonText}
                            </Button>
                        </div>
                    </div>
                ) : null}

                {/* LEFT PLAYER (P1 - WEST) */}
                <div className="flex-1 border-r-2 border-[#3d2d5c] flex flex-col relative">
                    <div className="absolute top-2 left-2 z-10 w-32">
                        <select
                            value={p1}
                            onChange={(e) => setP1(e.target.value)}
                            className="w-full bg-[#2a1f3d]/90 text-white text-xs p-1 border border-[#3d2d5c] font-[family-name:var(--font-dotgothic)]"
                        >
                            {wrestlers.map(w => <option key={w.id} value={w.id}>{w.custom_name || w.name}</option>)}
                        </select>
                    </div>

                    {/* Big Touch Area for P1 - SINGLE PUSH */}
                    <div
                        className="flex-1 bg-gradient-to-br from-[#1a1428] to-[#2a1f3d] flex items-center justify-center active:bg-[#50C878]/20 transition-colors relative"
                        onTouchStart={() => { if (w1 && buttonText === BUTTON_TEXT.NOKOTTA) { handlePush(w1.id); } }}
                        onClick={() => w1 && buttonText === BUTTON_TEXT.NOKOTTA && handlePush(w1.id)}
                    >
                        <span className="text-4xl text-white/20 font-[family-name:var(--font-dotgothic)] select-none pointer-events-none tracking-widest">PUSH</span>
                        {/* Stats Overlay */}
                        {w1 && <div className="absolute bottom-2 left-2 text-[10px] text-white/30 font-[family-name:var(--font-dotgothic)]">STR:{w1.strength}</div>}
                    </div>
                </div>

                {/* RIGHT PLAYER (P2 - EAST) */}
                <div className="flex-1 flex flex-col relative">
                    <div className="absolute top-2 right-2 z-10 w-32">
                        <select
                            value={p2}
                            onChange={(e) => setP2(e.target.value)}
                            className="w-full bg-[#2a1f3d]/90 text-white text-xs p-1 border border-[#3d2d5c] font-[family-name:var(--font-dotgothic)] text-right"
                        >
                            {wrestlers.map(w => <option key={w.id} value={w.id}>{w.custom_name || w.name}</option>)}
                        </select>
                    </div>

                    {/* Big Touch Area for P2 - SINGLE PUSH */}
                    <div
                        className="flex-1 bg-gradient-to-bl from-[#1a1428] to-[#2a1f3d] flex items-center justify-center active:bg-[#DC143C]/20 transition-colors relative"
                        onTouchStart={() => { if (w2 && buttonText === BUTTON_TEXT.NOKOTTA) { handlePush(w2.id); } }}
                        onClick={() => w2 && buttonText === BUTTON_TEXT.NOKOTTA && handlePush(w2.id)}
                    >
                        <span className="text-4xl text-white/20 font-[family-name:var(--font-dotgothic)] select-none pointer-events-none tracking-widest">PUSH</span>
                        {/* Stats Overlay */}
                        {w2 && <div className="absolute bottom-2 right-2 text-[10px] text-white/30 font-[family-name:var(--font-dotgothic)]">STR:{w2.strength}</div>}
                    </div>
                </div>
            </div>

        )
    }

    // --- SYNC MODE (REMOTE PLAY) ---
    if (syncMode) {
        // 1. SELECT SIDE SCREEN
        if (!mySide) {
            return (
                <div className="h-[100dvh] w-full bg-[#1a1428] flex flex-col p-4">
                    <Button onClick={() => setSyncMode(false)} variant="secondary" className="self-start mb-8">EXIT SYNC</Button>
                    <h2 className="text-xl text-[var(--gold)] font-[family-name:var(--font-dotgothic)] text-center mb-8">CHOOSE SIDE</h2>

                    <div className="flex-1 flex flex-col gap-4">
                        <button
                            disabled={!!lobbyStatus?.p1}
                            onClick={() => setMySide('p1')}
                            className={`flex-1 border-4 border-red-500/50 rounded-xl flex items-center justify-center relative overflow-hidden active:scale-95 transition-all
                                ${lobbyStatus?.p1 ? 'opacity-30 grayscale' : 'hover:bg-red-900/20'}`}
                        >
                            <span className="text-2xl text-red-400 font-[family-name:var(--font-dotgothic)]">WEST (P1)</span>
                            {lobbyStatus?.p1 && <span className="absolute bottom-4 text-xs text-white">TAKEN</span>}
                        </button>

                        <button
                            disabled={!!lobbyStatus?.p2}
                            onClick={() => setMySide('p2')}
                            className={`flex-1 border-4 border-blue-500/50 rounded-xl flex items-center justify-center relative overflow-hidden active:scale-95 transition-all
                                ${lobbyStatus?.p2 ? 'opacity-30 grayscale' : 'hover:bg-blue-900/20'}`}
                        >
                            <span className="text-2xl text-blue-400 font-[family-name:var(--font-dotgothic)]">EAST (P2)</span>
                            {lobbyStatus?.p2 && <span className="absolute bottom-4 text-xs text-white">TAKEN</span>}
                        </button>
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={async () => { await api.resetLobby(); alert('Lobby Reset!'); }}
                                className="text-xs text-gray-500 underline"
                            >
                                Reset Lobby State
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // 2. LOBBY / FIGHTING SCREEN for SYNC
        // If match starts (BUTTON_TEXT not TACHIAI), showing normal fight UI but customized
        const isFighting = buttonText === BUTTON_TEXT.NOKOTTA || buttonText === BUTTON_TEXT.HAKKEYOI;

        return (
            <div className="h-[100dvh] w-full bg-[#1a1428] flex flex-col p-4 relative overflow-hidden">
                {!isFighting && (
                    <div className="absolute top-2 left-2 z-50">
                        <Button size="sm" variant="ghost" onClick={() => { setMySide(null); setSyncMode(false); }} className="text-xs text-gray-400">EXIT</Button>
                    </div>
                )}

                {/* STATUS BAR */}
                <div className="bg-black/50 p-2 text-center rounded mb-4 mt-8 backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] text-gray-400 font-[family-name:var(--font-dotgothic)]">
                        LOBBY STATUS
                    </p>
                    <div className="flex justify-between items-center px-4 mt-1">
                        <div className={`text-xs ${lobbyStatus?.p1 ? 'text-green-400' : 'text-gray-600'}`}>P1: {lobbyStatus?.p1 ? 'READY' : '...'}</div>
                        <div className={`text-xs ${lobbyStatus?.p2 ? 'text-green-400' : 'text-gray-600'}`}>P2: {lobbyStatus?.p2 ? 'READY' : '...'}</div>
                    </div>
                </div>

                {/* FIGHTER SELECTION (Only show if not fighting) */}
                {/* FIGHTER SELECTION (Only show if not fighting) */}
                {!isFighting && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <h3 className="text-[var(--gold)] font-[family-name:var(--font-dotgothic)]">SELECT YOUR FIGHTER</h3>

                        {/* Visual Selector Trigger */}
                        <button
                            onClick={() => setSelectorOpen(mySide)} // Open selector for my side
                            className="bg-[#2a1f3d] text-white p-4 rounded-xl border-2 border-[var(--gold)] w-full max-w-xs flex items-center justify-between group hover:bg-[#3d2d5c] transition-colors"
                        >
                            <span className="font-[family-name:var(--font-dotgothic)] text-xl">
                                {(mySide === 'p1' ? w1 : w2)?.custom_name?.toUpperCase() || (mySide === 'p1' ? w1 : w2)?.name.toUpperCase() || "CHOOSE FIGHTER..."}
                            </span>
                            <span className="text-[var(--gold)]">▼</span>
                        </button>

                        <div className="py-4">
                            {mySide === 'p1' && w1 && <PixelSumo seed={w1.avatar_seed} color={w1.color} size={120} />}
                            {mySide === 'p2' && w2 && <PixelSumo seed={w2.avatar_seed} color={w2.color} size={120} />}
                        </div>

                        {/* START BUTTON (If both ready) */}
                        <Button
                            disabled={!lobbyStatus?.ready_to_start}
                            onClick={() => api.startLobbyMatch()}
                            className="w-full h-16 text-xl tracking-widest bg-[var(--jade)] hover:bg-[#00a86b] disabled:opacity-30 disabled:grayscale transition-all font-[family-name:var(--font-dotgothic)]"
                        >
                            {lobbyStatus?.ready_to_start ? "START MATCH" : "WAITING FOR OPPONENT..."}
                        </Button>
                    </div>
                )}

                {/* FIGHT BUTTON (Big Overlay when fighting) */}
                {isFighting && (
                    <div className="absolute inset-0 z-40 bg-[#1a1428] flex flex-col">
                        <div className="flex-1 flex items-center justify-center relative">
                            {/* Single huge button for my side */}
                            <button
                                onTouchStart={() => {
                                    const id = mySide === 'p1' ? p1 : p2;
                                    if (id) handlePush(id);
                                }}
                                onClick={() => {
                                    const id = mySide === 'p1' ? p1 : p2;
                                    if (id) handlePush(id);
                                }}
                                className="w-full h-full flex flex-col items-center justify-center active:scale-95 transition-transform"
                                style={{ backgroundColor: mySide === 'p1' ? '#3d2d5c' : '#2d1f1f' }} // purple vs red-ish dark
                            >
                                <span className="text-6xl text-white/20 font-[family-name:var(--font-dotgothic)] select-none pointer-events-none tracking-widest animate-pulse">
                                    PUSH!
                                </span>
                                <span className="mt-4 text-sm text-white/40 font-[family-name:var(--font-dotgothic)]">
                                    {buttonText}
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

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
                <h1 className="font-[family-name:var(--font-dotgothic)] text-lg text-[#FFD700] [text-shadow:_1px_1px_0_#000] flex-1">TACHIAI</h1>

                {/* 1P/2P Toggle */}
                <button
                    onClick={() => { triggerHaptic(20); setTwoPlayerMode(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-[#3d2d5c] bg-[#2a1f3d] text-xs font-[family-name:var(--font-dotgothic)] text-gray-300 hover:text-[#FFD700]"
                >
                    <Gamepad2 className="h-3 w-3" />
                    <span>2P MODE</span>
                </button>

                {/* Watch View Link */}
                <Link href="/watch">
                    <button
                        className="flex items-center gap-1 px-2 py-1 rounded border border-[#3d2d5c] bg-[#2a1f3d] text-xs font-[family-name:var(--font-dotgothic)] text-gray-300 hover:text-[#DC143C]"
                        title="Watch Match"
                    >
                        <Eye className="h-3 w-3" />
                        <span>WATCH</span>
                    </button>
                </Link>

                {/* Solo Mode Toggle */}
                <button
                    onClick={() => {
                        triggerHaptic(20);
                        setSoloMode(!soloMode);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border-2 text-[10px] font-[family-name:var(--font-dotgothic)] transition-all ${soloMode
                        ? 'bg-[#50C878] text-white border-[#90EE90] shadow-[0_0_10px_rgba(80,200,120,0.5)]'
                        : 'bg-[#2a1f3d] text-gray-400 border-[#3d2d5c] hover:border-[#FFD700]'
                        }`}
                >
                    <Gamepad2 className="h-3 w-3" />
                    <span>{soloMode ? "SOLO ACTIVE" : "SOLO OFF"}</span>
                </button>

                {/* Sync Mode Toggle */}
                <button
                    onClick={() => {
                        triggerHaptic(20);
                        setSyncMode(true);
                        setTwoPlayerMode(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded border-2 text-[10px] font-[family-name:var(--font-dotgothic)] bg-[#2a1f3d] text-[#87CEEB] border-[#3d2d5c] hover:border-[#87CEEB]"
                >
                    <RotateCcw className="h-3 w-3" />
                    <span>SYNC</span>
                </button>

                {/* Reset Match Button */}
                <button
                    onClick={async () => {
                        if (window.confirm('Reset current match? This will clear any stuck state.')) {
                            triggerHaptic(20);
                            try {
                                await api.resetMatch();
                                setLoading(false);
                                setButtonText(BUTTON_TEXT.TACHIAI);
                                fetchWrestlers();
                            } catch (err) {
                                console.error('Reset failed:', err);
                                alert('Failed to reset match');
                            }
                        }
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded border-2 text-[10px] font-[family-name:var(--font-dotgothic)] bg-[#2a1f3d] text-gray-400 border-[#3d2d5c] hover:border-red-400 hover:text-red-400 transition-all"
                    title="Reset stuck match"
                >
                    <RotateCcw className="h-3 w-3" />
                </button>
            </header>

            {/* Main Content - Flex to fill space */}
            <div className="flex-1 flex flex-col justify-center gap-6 min-h-0">
                {/* P1 - WEST Fighter (Top) */}
                <div className="gba-menu-btn p-3 relative">
                    <p className="text-[10px] text-[#87CEEB] font-[family-name:var(--font-dotgothic)] mb-1">WEST</p>
                    <div
                        onClick={() => setSelectorOpen('p1')}
                        className="bg-[#2a1f3d] p-2 border-2 border-[#3d2d5c] flex justify-between items-center cursor-pointer hover:border-[#50C878] transition-colors"
                    >
                        <span className="text-sm text-white font-[family-name:var(--font-dotgothic)] truncate flex-1">
                            {w1?.custom_name?.toUpperCase() || w1?.name.toUpperCase() || "SELECT FIGHTER..."}
                        </span>
                        <span className="text-gray-400 text-xs">▼</span>
                    </div>
                    {w1 && (
                        <div className="mt-2 flex gap-3 items-center relative">
                            {/* SINGLE PUSH BUTTON - Shows during fight (NOKOTTA state) */}
                            {buttonText === BUTTON_TEXT.NOKOTTA && (
                                <div className="absolute inset-0 z-10 flex p-1">
                                    <button
                                        onClick={() => handlePush(w1.id)}
                                        style={{ backgroundColor: `rgb(${w1.color})` }}
                                        className="flex-1 text-white font-[family-name:var(--font-dotgothic)] text-2xl border-4 border-l-yellow-300 border-t-yellow-300 border-r-yellow-600 border-b-yellow-600 flex items-center justify-center shadow-lg active:brightness-75 active:scale-95 transition-all tracking-widest"
                                    >
                                        PUSH
                                    </button>
                                    {soloMode && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-white/70 font-[family-name:var(--font-dotgothic)]">WEST</span>}
                                </div>
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

                {/* P2 - EAST Fighter (Bottom) */}
                <div className="gba-menu-btn p-3 relative">
                    <p className="text-[10px] text-[#87CEEB] font-[family-name:var(--font-dotgothic)] mb-1">EAST</p>
                    <div
                        onClick={() => setSelectorOpen('p2')}
                        className="bg-[#2a1f3d] p-2 border-2 border-[#3d2d5c] flex justify-between items-center cursor-pointer hover:border-[#FFD700] transition-colors"
                    >
                        <span className="text-gray-400 text-xs">▼</span>
                        <span className="text-sm text-white font-[family-name:var(--font-dotgothic)] truncate flex-1 text-right">
                            {w2?.custom_name?.toUpperCase() || w2?.name.toUpperCase() || "SELECT FIGHTER..."}
                        </span>
                    </div>
                    {w2 && (
                        <div className="mt-2 flex gap-3 items-center relative">
                            {/* SINGLE PUSH BUTTON - Shows during fight (NOKOTTA state) */}
                            {buttonText === BUTTON_TEXT.NOKOTTA && (
                                <div className="absolute inset-0 z-10 flex p-1">
                                    <button
                                        onClick={() => handlePush(w2.id)}
                                        style={{ backgroundColor: `rgb(${w2.color})` }}
                                        className="flex-1 text-white font-[family-name:var(--font-dotgothic)] text-2xl border-4 border-l-yellow-300 border-t-yellow-300 border-r-yellow-600 border-b-yellow-600 flex items-center justify-center shadow-lg active:brightness-75 active:scale-95 transition-all tracking-widest"
                                    >
                                        PUSH
                                    </button>
                                    {soloMode && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-white/70 font-[family-name:var(--font-dotgothic)]">EAST</span>}
                                </div>
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

            {/* SELECTOR MODAL */}
            <WrestlerSelector
                isOpen={!!selectorOpen}
                onClose={() => setSelectorOpen(null)}
                wrestlers={wrestlers}
                onSelect={(w) => {
                    if (selectorOpen === 'p1') {
                        setP1(w.id.toString());
                        // If in sync mode, auto-join
                        if (syncMode && mySide === 'p1') api.joinLobby('p1', w.id.toString(), w.name);
                    } else if (selectorOpen === 'p2') {
                        setP2(w.id.toString());
                        // If in sync mode, auto-join
                        if (syncMode && mySide === 'p2') api.joinLobby('p2', w.id.toString(), w.name);
                    }
                    setSelectorOpen(null);
                }}
            />
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

function WrestlerSelector({
    isOpen,
    onClose,
    onSelect,
    wrestlers
}: {
    isOpen: boolean,
    onClose: () => void,
    onSelect: (w: Wrestler) => void,
    wrestlers: Wrestler[]
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-[var(--gold)] font-[family-name:var(--font-dotgothic)] text-xl">ROSTER</h2>
                <Button variant="ghost" className="text-white hover:text-red-400 text-xl h-10 w-10" onClick={onClose}>✕</Button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pb-20">
                {wrestlers.map(w => (
                    <button
                        key={w.id}
                        onClick={() => onSelect(w)}
                        className="bg-[#1a1428] border border-gray-700 hover:border-[var(--gold)] rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-all text-left group"
                    >
                        <div className="bg-[#2a1f3d] rounded-full p-2 group-hover:bg-[#3d2d5c] transition-colors">
                            <PixelSumo seed={w.avatar_seed} color={w.color} size={64} />
                        </div>
                        <div className="w-full">
                            <div className="font-[family-name:var(--font-dotgothic)] text-white text-sm truncate w-full text-center">
                                {(w.custom_name || w.name).toUpperCase()}
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                                <span>{w.rank_name}</span>
                                <span>{w.wins}W - {w.matches - w.wins}L</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
