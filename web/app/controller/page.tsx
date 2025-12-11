"use client";

import { useEffect, useState } from "react";
import { api, Wrestler } from "@/lib/api";
import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";
import { ArrowLeft, Swords } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Custom simplified Select for cleaner UI if Shadcn select is too complex to setup quickly without extra files
// We'll use native select styled for now to ensure robustness without missing components
// actually, let's just make a simple selector component inline to avoid 'select' component issues if not fully installed (shadcn select has many parts)

export default function ControllerPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [p1, setP1] = useState<string>("");
    const [p2, setP2] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    useEffect(() => {
        api.getWrestlers().then(data => {
            setWrestlers(data);
            if (data.length >= 2) {
                setP1(data[0].id.toString());
                setP2(data[1].id.toString());
            }
        });
    }, []);

    const handleFight = async () => {
        if (!p1 || !p2 || p1 === p2) {
            setStatus("SELECT DIFFERENT WRESTLERS");
            return;
        }
        setLoading(true);
        setStatus("TRANSMITTING...");
        try {
            await api.startFight(parseInt(p1), parseInt(p2));
            setStatus("MATCH STARTED!");
            setTimeout(() => setStatus(""), 3000);
        } catch {
            setStatus("CONNECTION ERROR");
        }
        setLoading(false);
    };

    const getWrestler = (id: string) => wrestlers.find(w => w.id.toString() === id);

    return (
        <div className="min-h-screen p-4 max-w-md mx-auto flex flex-col">
            <header className="flex items-center gap-4 mb-8">
                <Link href="/">
                    <Button variant="outline" size="icon" className="rounded-none border-neutral-700 bg-neutral-900">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="font-arcade text-xl text-orange-500">FIGHT DECK</h1>
            </header>

            <div className="flex-1 flex flex-col gap-6">
                {/* PLAYER 1 */}
                <Card className="p-4 bg-neutral-900 border-red-900/50 border-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-red-600 px-2 py-1 text-[10px] font-arcade text-white">P1 (RED)</div>
                    <div className="mt-4">
                        <select
                            className="w-full bg-black text-white p-3 font-arcade text-sm border border-red-800 focus:outline-none focus:border-red-500"
                            value={p1}
                            onChange={(e) => setP1(e.target.value)}
                        >
                            {wrestlers.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.custom_name ? w.custom_name.toUpperCase() : w.name} ({w.wins}-{w.losses})
                                </option>
                            ))}
                        </select>
                        {/* Stats Preview */}
                        {p1 && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-neutral-400 font-mono">
                                <div className="text-center">STR: {getWrestler(p1)?.strength}</div>
                                <div className="text-center">TEC: {getWrestler(p1)?.technique}</div>
                                <div className="text-center">SPD: {getWrestler(p1)?.speed}</div>
                            </div>
                        )}
                    </div>
                </Card>

                <div className="flex justify-center -my-2 z-10">
                    <div className="bg-neutral-950 p-2 rounded-full border border-neutral-800">
                        <div className="font-arcade text-neutral-500 text-xs">VS</div>
                    </div>
                </div>

                {/* PLAYER 2 */}
                <Card className="p-4 bg-neutral-900 border-blue-900/50 border-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-600 px-2 py-1 text-[10px] font-arcade text-white">P2 (BLUE)</div>
                    <div className="mt-4">
                        <select
                            className="w-full bg-black text-white p-3 font-arcade text-sm border border-blue-800 focus:outline-none focus:border-blue-500"
                            value={p2}
                            onChange={(e) => setP2(e.target.value)}
                        >
                            {wrestlers.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.custom_name ? w.custom_name.toUpperCase() : w.name} ({w.wins}-{w.losses})
                                </option>
                            ))}
                        </select>
                        {/* Stats Preview */}
                        {p2 && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-neutral-400 font-mono">
                                <div className="text-center">STR: {getWrestler(p2)?.strength}</div>
                                <div className="text-center">TEC: {getWrestler(p2)?.technique}</div>
                                <div className="text-center">SPD: {getWrestler(p2)?.speed}</div>
                            </div>
                        )}
                    </div>
                </Card>

                <Button
                    onClick={handleFight}
                    disabled={loading}
                    className={cn(
                        "w-full h-24 text-2xl font-arcade border-4 border-white bg-orange-600 hover:bg-orange-500 text-white rounded-none shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all mt-auto",
                        loading && "bg-neutral-700 border-neutral-500"
                    )}
                >
                    {loading ? "LOAD..." : "FIGHT!"}
                </Button>

                <div className="h-8 text-center font-arcade text-green-500 text-xs animate-pulse">
                    {status}
                </div>
            </div>
        </div>
    );
}
