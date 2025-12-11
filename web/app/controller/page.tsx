"use client";

import { useEffect, useState } from "react";
import { api, Wrestler, getApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PixelSumo } from "@/components/PixelSumo";

export default function ControllerPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [p1, setP1] = useState<string>("");
    const [p2, setP2] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [buttonText, setButtonText] = useState("START FIGHT!");

    useEffect(() => {
        api.getWrestlers().then(data => {
            setWrestlers(data);
            if (data.length >= 2) {
                setP1(data[0].id.toString());
                setP2(data[1].id.toString());
            }
        });
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${getApiUrl()}/status`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === "FIGHTING") {
                        setLoading(true);
                        setButtonText("FIGHT IN PROGRESS...");
                    } else if (buttonText === "FIGHT IN PROGRESS...") {
                        setLoading(false);
                        setButtonText("START FIGHT!");
                    }
                })
                .catch(err => console.error(err));
        }, 1000);
        return () => clearInterval(interval);
    }, [buttonText]);

    const handleFight = async () => {
        if (!p1 || !p2) return;
        setLoading(true);
        setButtonText("INITIALIZING...");
        await api.startFight(parseInt(p1), parseInt(p2));
        // Status polling will take over text update
    };

    const getWrestler = (idStr: string) => wrestlers.find(w => w.id.toString() === idStr);
    const w1 = getWrestler(p1);
    const w2 = getWrestler(p2);

    return (
        <div className="min-h-screen p-4 flex flex-col justify-between max-w-md mx-auto">
            <div>
                <header className="flex items-center gap-4 mb-8">
                    <Link href="/">
                        <Button variant="outline" size="icon" className="rounded-none border-neutral-700 bg-neutral-900">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="font-arcade text-xl text-yellow-500">FIGHT DECK</h1>
                </header>

                <div className="space-y-6">
                    {/* PLAYER 1 */}
                    <div className="bg-neutral-900 p-4 border border-neutral-800 rounded-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                            <span className="font-arcade text-4xl text-neutral-700">P1</span>
                        </div>

                        <label className="text-xs text-neutral-500 font-arcade mb-2 block uppercase">West Corner</label>
                        <div className="relative">
                            <select
                                value={p1}
                                onChange={(e) => setP1(e.target.value)}
                                className="w-full bg-black text-white p-3 font-arcade text-sm border border-neutral-700 rounded appearance-none focus:border-yellow-500 outline-none"
                            >
                                {wrestlers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.custom_name ? w.custom_name.toUpperCase() : w.name.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>

                        {w1 && (
                            <div className="mt-4 flex gap-4">
                                <div className="bg-black/50 p-2 rounded border border-neutral-800">
                                    <PixelSumo seed={w1.avatar_seed} color={w1.color} size={48} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <StatBar label="STRENGTH" value={w1.strength} color={w1.color} />
                                    <StatBar label="TECHNIQUE" value={w1.technique} color={w1.color} />
                                    <StatBar label="SPEED" value={w1.speed} color={w1.color} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center items-center">
                        <div className="bg-neutral-800 rounded-full p-2 border-2 border-neutral-900 shadow-xl">
                            <Swords className="h-6 w-6 text-neutral-400" />
                        </div>
                    </div>

                    {/* PLAYER 2 */}
                    <div className="bg-neutral-900 p-4 border border-neutral-800 rounded-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                            <span className="font-arcade text-4xl text-neutral-700">P2</span>
                        </div>

                        <label className="text-xs text-neutral-500 font-arcade mb-2 block uppercase">East Corner</label>
                        <div className="relative">
                            <select
                                value={p2}
                                onChange={(e) => setP2(e.target.value)}
                                className="w-full bg-black text-white p-3 font-arcade text-sm border border-neutral-700 rounded appearance-none focus:border-blue-500 outline-none"
                            >
                                {wrestlers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.custom_name ? w.custom_name.toUpperCase() : w.name.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>

                        {w2 && (
                            <div className="mt-4 flex gap-4">
                                <div className="bg-black/50 p-2 rounded border border-neutral-800">
                                    <PixelSumo seed={w2.avatar_seed} color={w2.color} size={48} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <StatBar label="STRENGTH" value={w2.strength} color={w2.color} />
                                    <StatBar label="TECHNIQUE" value={w2.technique} color={w2.color} />
                                    <StatBar label="SPEED" value={w2.speed} color={w2.color} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Button
                onClick={handleFight}
                disabled={loading || !p1 || !p2 || buttonText === "FIGHT IN PROGRESS..."}
                className="w-full h-16 text-xl bg-orange-600 hover:bg-orange-500 font-arcade tracking-widest mt-8 border-b-4 border-orange-800 active:border-b-0 active:mt-[34px] transition-all"
            >
                {buttonText}
            </Button>
        </div>
    );
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[9px] w-14 font-bold text-neutral-500">{label}</span>
            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                    className="h-full"
                    style={{ width: `${Math.min(100, (value / 2.0) * 100)}%`, backgroundColor: `rgb(${color})` }}
                />
            </div>
        </div>
    )
}
