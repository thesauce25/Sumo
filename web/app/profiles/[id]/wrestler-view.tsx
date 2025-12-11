"use client";

import { useEffect, useState } from "react";
import { api, Wrestler, MatchRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export default function WrestlerView({ id }: { id: number }) {
    const [wrestler, setWrestler] = useState<Wrestler | null>(null);
    const [history, setHistory] = useState<MatchRecord[]>([]);
    const router = useRouter();

    useEffect(() => {
        if (isNaN(id)) return;
        api.getWrestler(id).then(setWrestler).catch(() => router.push("/profiles"));
        api.getHistory(id).then(setHistory);
    }, [id, router]);

    const handleDelete = async () => {
        if (confirm("Are you sure you want to retire this wrestler?")) {
            await api.deleteWrestler(id);
            router.push("/profiles");
        }
    };

    if (!wrestler) return <div className="text-center p-10 font-arcade text-neutral-500">LOADING PROFILE...</div>;

    return (
        <div className="min-h-screen p-4 max-w-md mx-auto flex flex-col">
            <header className="flex items-center justify-between mb-6">
                <Link href="/profiles">
                    <Button variant="outline" size="icon" className="rounded-none border-neutral-700 bg-neutral-900">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="font-arcade text-xs text-neutral-500 uppercase tracking-widest">WRESTLER PROFILE</h1>
                <Button variant="destructive" size="icon" className="rounded-none" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </header>

            {/* HERO CARD */}
            <Card className="bg-neutral-900 border-neutral-800 overflow-hidden mb-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <div className="text-9xl font-arcade leading-none" style={{ color: `rgb(${wrestler.color})` }}>
                        {wrestler.name[0]}
                    </div>
                </div>

                <div className="p-6 relative z-10">
                    <div className="w-16 h-16 mb-4 border-4 border-white shadow-lg" style={{ backgroundColor: `rgb(${wrestler.color})` }} />

                    <h1 className="font-arcade text-3xl text-white leading-none mb-1">
                        {wrestler.custom_name ? wrestler.custom_name.toUpperCase() : wrestler.name.toUpperCase()}
                    </h1>
                    {wrestler.custom_name && (
                        <h2 className="font-arcade text-neutral-500 text-sm mb-4">{wrestler.name.toUpperCase()}</h2>
                    )}

                    <div className="flex gap-4 text-xs font-mono text-neutral-400 mb-6">
                        <div className="bg-neutral-800 px-2 py-1 rounded">{wrestler.stable} STABLE</div>
                        <div className="bg-neutral-800 px-2 py-1 rounded">{wrestler.wins} WINS</div>
                        <div className="bg-neutral-800 px-2 py-1 rounded">{wrestler.matches - wrestler.wins} LOSSES</div>
                    </div>

                    <Separator className="mb-6 bg-neutral-800" />

                    <div className="grid grid-cols-3 gap-4">
                        <Stat label="STR" value={wrestler.strength} />
                        <Stat label="TEC" value={wrestler.technique} />
                        <Stat label="SPD" value={wrestler.speed} />
                        <Stat label="HGT" value={wrestler.height} unit="cm" />
                        <Stat label="WGT" value={wrestler.weight} unit="kg" />
                        <Stat label="EXP" value={wrestler.matches} />
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
    );
}

function Stat({ label, value, unit = "" }: { label: string, value: number, unit?: string }) {
    return (
        <div>
            <div className="text-[10px] text-neutral-600 mb-1 font-bold">{label}</div>
            <div className="font-arcade text-lg text-white">
                {value}
                <span className="text-[10px] ml-0.5 text-neutral-500 font-sans">{unit}</span>
            </div>
        </div>
    )
}
