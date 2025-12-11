"use client";

import { useEffect, useState } from "react";
import { api, Wrestler, MatchRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixelSumo } from "@/components/PixelSumo";
import { SkillTree } from "@/components/SkillTree";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function WrestlerView({ id }: { id: number }) {
    const [wrestler, setWrestler] = useState<Wrestler | null>(null);
    const [history, setHistory] = useState<MatchRecord[]>([]);
    const [showAlert, setShowAlert] = useState(false);
    const [showSkillTree, setShowSkillTree] = useState(false);
    const router = useRouter();

    const refresh = () => {
        if (isNaN(id)) return;
        api.getWrestler(id).then(setWrestler).catch(() => router.push("/profiles"));
        api.getHistory(id).then(setHistory);
    };

    useEffect(() => {
        refresh();
    }, [id, router]);

    const confirmDelete = async () => {
        await api.deleteWrestler(id);
        router.push("/profiles");
    };

    if (!wrestler) return (
        <div className="min-h-[100dvh] flex items-center justify-center">
            <div className="font-[family-name:var(--font-dotgothic)] text-muted-foreground animate-pulse">
                LOADING...
            </div>
        </div>
    );

    const winRate = wrestler.matches > 0 ? Math.round((wrestler.wins / wrestler.matches) * 100) : 0;

    return (
        <>
            <div className="min-h-[100dvh] p-4 max-w-md mx-auto flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between mb-4">
                    <Link href="/profiles">
                        <Button variant="outline" size="icon" className="gba-panel">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="font-[family-name:var(--font-dotgothic)] text-xs text-muted-foreground uppercase tracking-widest">
                        RIKISHI PROFILE
                    </h1>
                    <Button variant="destructive" size="icon" className="bg-[var(--crimson)]" onClick={() => setShowAlert(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </header>

                {/* Profile Card */}
                <Card className="gba-panel overflow-hidden mb-4">
                    <div className="p-5">
                        {/* Avatar Section */}
                        <div className="flex justify-center mb-4">
                            <div className="bg-black/30 p-3 border-2 border-[var(--border)]">
                                <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={80} />
                            </div>
                        </div>

                        {/* Name & Stable */}
                        <div className="text-center mb-4">
                            <h1
                                className="font-[family-name:var(--font-dotgothic)] text-2xl leading-none mb-1"
                                style={{ color: `rgb(${wrestler.color})`, textShadow: `0 0 15px rgb(${wrestler.color} / 0.4)` }}
                            >
                                {wrestler.custom_name ? wrestler.custom_name.toUpperCase() : wrestler.name.toUpperCase()}
                            </h1>
                            {wrestler.custom_name && (
                                <div className="font-[family-name:var(--font-dotgothic)] text-muted-foreground text-xs mb-2">
                                    ({wrestler.name})
                                </div>
                            )}
                            <div className="text-xs text-[var(--jade)] font-[family-name:var(--font-dotgothic)]">
                                {wrestler.stable}-BEYA
                            </div>
                        </div>

                        {/* Bio */}
                        {wrestler.bio && (
                            <div className="text-center mb-4 px-4">
                                <p className="text-xs text-muted-foreground italic leading-relaxed">
                                    &quot;{wrestler.bio}&quot;
                                </p>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <StatBox label="勝" value={wrestler.wins} color="var(--gold)" />
                            <StatBox label="敗" value={wrestler.matches - wrestler.wins} color="var(--crimson)" />
                            <StatBox label="率" value={`${winRate}%`} color="var(--jade)" />
                        </div>

                        {/* Attribute Bars */}
                        <div className="space-y-2 mb-4">
                            <AttrBar label="STRENGTH" value={wrestler.strength} color={wrestler.color} />
                            <AttrBar label="TECHNIQUE" value={wrestler.technique} color={wrestler.color} />
                            <AttrBar label="SPEED" value={wrestler.speed} color={wrestler.color} />
                        </div>

                        {/* Physical Stats */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border)]">
                            <div className="text-center">
                                <div className="text-[10px] text-muted-foreground font-[family-name:var(--font-dotgothic)]">HEIGHT</div>
                                <div className="font-[family-name:var(--font-dotgothic)] text-lg text-foreground">
                                    {wrestler.height}<span className="text-xs text-muted-foreground ml-0.5">cm</span>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-muted-foreground font-[family-name:var(--font-dotgothic)]">WEIGHT</div>
                                <div className="font-[family-name:var(--font-dotgothic)] text-lg text-foreground">
                                    {wrestler.weight}<span className="text-xs text-muted-foreground ml-0.5">kg</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* KEIKO Training Button */}
                <button
                    onClick={() => setShowSkillTree(true)}
                    className="w-full gba-btn font-[family-name:var(--font-dotgothic)] text-sm py-3 mb-4 flex items-center justify-center gap-3"
                >
                    <span className="text-lg">稽古</span>
                    <span>KEIKO (TRAINING)</span>
                    {(wrestler.skill_points ?? 0) > 0 && (
                        <span className="bg-[var(--jade)] text-black px-2 py-0.5 text-xs">
                            {wrestler.skill_points} SP
                        </span>
                    )}
                </button>

                {/* Match History - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    <h3 className="font-[family-name:var(--font-dotgothic)] text-xs text-muted-foreground mb-2">BASHO RECORD</h3>

                    {history.length === 0 && (
                        <div className="text-center text-muted-foreground font-[family-name:var(--font-dotgothic)] text-xs mt-6">
                            NO RECORDED BOUTS
                        </div>
                    )}

                    <div className="space-y-2 pb-4">
                        {history.map(match => {
                            const isWinner = (match.winner_name === wrestler.name) || (match.winner_custom === wrestler.custom_name);
                            return (
                                <Card key={match.id} className="gba-panel p-2 flex items-center gap-2">
                                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-[family-name:var(--font-dotgothic)] ${isWinner ? 'text-[var(--gold)]' : 'text-muted-foreground'}`}>
                                        {isWinner ? '○' : '●'}
                                    </div>
                                    <div className="flex-1 text-xs font-[family-name:var(--font-dotgothic)] text-muted-foreground truncate">
                                        vs {match.p1_name === wrestler.name || match.p1_custom === wrestler.custom_name
                                            ? (match.p2_custom || match.p2_name).toUpperCase()
                                            : (match.p1_custom || match.p1_name).toUpperCase()
                                        }
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Skill Tree Modal */}
            {showSkillTree && (
                <SkillTree
                    wrestlerId={id}
                    wrestlerName={wrestler.custom_name || wrestler.name}
                    onClose={() => {
                        setShowSkillTree(false);
                        refresh();
                    }}
                />
            )}

            <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
                <AlertDialogContent className="gba-panel border-2 text-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-[family-name:var(--font-dotgothic)] text-[var(--crimson)]">INTAI (引退)?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Retire {wrestler.custom_name || wrestler.name} from the dohyo? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowAlert(false)} className="gba-panel text-foreground border-[var(--border)] hover:bg-[var(--muted)] font-[family-name:var(--font-dotgothic)] text-xs">
                            CANCEL
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-[var(--crimson)] hover:bg-[var(--crimson)]/80 font-[family-name:var(--font-dotgothic)] text-xs text-white">
                            RETIRE
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function StatBox({ label, value, color }: { label: string, value: number | string, color: string }) {
    return (
        <div className="bg-black/20 p-2 border border-[var(--border)] text-center">
            <div className="font-[family-name:var(--font-dotgothic)] text-xl" style={{ color }}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
    );
}

function AttrBar({ label, value, color }: { label: string, value: number, color: string }) {
    const percent = Math.min(100, (value / 2.0) * 100);
    return (
        <div className="flex items-center gap-2">
            <span className="text-[9px] w-16 font-bold text-muted-foreground">{label}</span>
            <div className="flex-1 h-2 bg-black/30 overflow-hidden">
                <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${percent}%`, backgroundColor: `rgb(${color})` }}
                />
            </div>
            <span className="text-[10px] w-6 text-right font-[family-name:var(--font-dotgothic)] text-foreground">
                {value.toFixed(1)}
            </span>
        </div>
    );
}
