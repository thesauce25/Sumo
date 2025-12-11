"use client";

import { useEffect, useState } from "react";
import { api, Wrestler, MatchRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { PixelSumo } from "@/components/PixelSumo";
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
    const router = useRouter();

    useEffect(() => {
        if (isNaN(id)) return;
        api.getWrestler(id).then(setWrestler).catch(() => router.push("/profiles"));
        api.getHistory(id).then(setHistory);
    }, [id, router]);

    const confirmDelete = async () => {
        await api.deleteWrestler(id);
        router.push("/profiles");
    };

    if (!wrestler) return <div className="text-center p-10 font-arcade text-neutral-500">LOADING PROFILE...</div>;

    return (
        <>
            <div className="min-h-screen p-4 max-w-md mx-auto flex flex-col">
                <header className="flex items-center justify-between mb-6">
                    <Link href="/profiles">
                        <Button variant="outline" size="icon" className="rounded-none border-neutral-700 bg-neutral-900">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="font-arcade text-xs text-neutral-500 uppercase tracking-widest">WRESTLER PROFILE</h1>
                    <Button variant="destructive" size="icon" className="rounded-none" onClick={() => setShowAlert(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </header>

                {/* HERO CARD */}
                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden mb-6 relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={200} className="blur-sm grayscale opacity-30" />
                    </div>

                    <div className="p-6 relative z-10">
                        <div className="flex justify-center mb-6">
                            <div className="bg-neutral-950 p-4 border border-neutral-800 rounded-full shadow-2xl">
                                <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={96} />
                            </div>
                        </div>

                        <div className="text-center mb-6">
                            <h1 className="font-arcade text-3xl text-white leading-none mb-2 drop-shadow-md" style={{ textShadow: `0 0 20px rgb(${wrestler.color})` }}>
                                {wrestler.custom_name ? wrestler.custom_name.toUpperCase() : wrestler.name.toUpperCase()}
                            </h1>
                            {wrestler.custom_name && (
                                <h2 className="font-arcade text-neutral-500 text-sm mb-4">AKA: {wrestler.name.toUpperCase()}</h2>
                            )}
                            {wrestler.bio && (
                                <p className="text-xs text-neutral-400 font-serif italic max-w-[260px] mx-auto leading-relaxed">
                                    &quot;{wrestler.bio}&quot;
                                </p>
                            )}
                        </div>

                        <div className="flex justify-center gap-4 text-xs font-arcade text-neutral-400 mb-8 uppercase tracking-wider">
                            <div className="bg-neutral-800/50 px-3 py-1 rounded border border-neutral-800">{wrestler.stable} STABLE</div>
                            <div className="bg-neutral-800/50 px-3 py-1 rounded border border-neutral-800 text-green-500">{wrestler.wins} WINS</div>
                            <div className="bg-neutral-800/50 px-3 py-1 rounded border border-neutral-800 text-red-500">{wrestler.matches - wrestler.wins} LOSSES</div>
                        </div>

                        <Separator className="mb-6 bg-neutral-800" />

                        <div className="space-y-4">
                            <StatRow label="STRENGTH" value={wrestler.strength} max={2.0} color={wrestler.color} />
                            <StatRow label="TECHNIQUE" value={wrestler.technique} max={2.0} color={wrestler.color} />
                            <StatRow label="SPEED" value={wrestler.speed} max={2.0} color={wrestler.color} />

                            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-neutral-800/50">
                                <StatSimple label="HEIGHT" value={wrestler.height} unit="cm" />
                                <StatSimple label="WEIGHT" value={wrestler.weight} unit="kg" />
                            </div>
                        </div>
                    </div>
                </Card>

                <h3 className="font-arcade text-xs text-neutral-500 mb-4 px-1">MATCH HISTORY</h3>

                <div className="space-y-2 pb-10">
                    {history.length === 0 && <div className="text-center text-neutral-700 font-mono text-xs">No recorded bouts.</div>}
                    {history.map(match => (
                        <Card key={match.id} className="p-3 bg-neutral-900 border-neutral-800 flex justify-between items-center bg-opacity-50">
                            <div className={`text-xs font-arcade w-1/3 text-right pr-2 truncate ${match.winner_name === wrestler.name ? 'text-green-500' : 'text-neutral-500'}`}>
                                {match.p1_custom ? match.p1_custom.toUpperCase() : match.p1_name}
                            </div>
                            <div className="text-[10px] text-neutral-700 px-2">VS</div>
                            <div className={`text-xs font-arcade w-1/3 pl-2 truncate ${match.winner_name === wrestler.name ? 'text-green-500' : 'text-neutral-500'}`}>
                                {match.p2_custom ? match.p2_custom.toUpperCase() : match.p2_name}
                            </div>
                        </Card>
                    ))}
                </div>

            </div>

            <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
                <AlertDialogContent className="bg-neutral-900 border-neutral-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-arcade text-red-500">RETIRE WRESTLER?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            Are you sure you want to delete {wrestler.custom_name || wrestler.name}? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowAlert(false)} className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700 hover:text-white font-arcade text-xs">CANCEL</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 font-arcade text-xs text-white">DELETE</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function StatRow({ label, value, max, color }: { label: string, value: number, max: number, color: string }) {
    const percent = Math.min(100, (value / max) * 100);
    return (
        <div className="flex items-center gap-4">
            <div className="w-24 text-[10px] font-bold text-neutral-500 tracking-wider">{label}</div>
            <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${percent}%`, backgroundColor: `rgb(${color})` }}
                />
            </div>
            <div className="w-8 text-right font-arcade text-xs text-white">{value.toFixed(1)}</div>
        </div>
    )
}

function StatSimple({ label, value, unit }: { label: string, value: number, unit: string }) {
    return (
        <div className="text-center">
            <div className="text-[10px] text-neutral-600 mb-1 tracking-wider font-bold">{label}</div>
            <div className="font-arcade text-lg text-white">
                {value}
                <span className="text-[10px] ml-0.5 text-neutral-500 font-sans">{unit}</span>
            </div>
        </div>
    )
}
