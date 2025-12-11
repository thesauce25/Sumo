"use client";

import { useEffect, useState } from "react";
import { api, Wrestler, MatchRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { SwipeableWrestlerCard } from "@/components/SwipeableWrestlerCard";

// Matrix Safe Colors
const COLORS = [
    { name: "RED", value: "255,30,30", hex: "#ff1e1e" },
    { name: "BLUE", value: "30,30,255", hex: "#1e1eff" },
    { name: "GREEN", value: "30,255,30", hex: "#1eff1e" },
    { name: "YELLOW", value: "255,255,0", hex: "#ffff00" },
    { name: "CYAN", value: "0,255,255", hex: "#00ffff" },
    { name: "MAGENTA", value: "255,0,255", hex: "#ff00ff" },
    { name: "ORANGE", value: "255,165,0", hex: "#ffa500" },
    { name: "PURPLE", value: "128,0,128", hex: "#800080" },
    { name: "LIME", value: "50,205,50", hex: "#32cd32" },
    { name: "PINK", value: "255,105,180", hex: "#ff69b4" },
];

export default function ProfilesPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [history, setHistory] = useState<MatchRecord[]>([]);
    const [view, setView] = useState<'roster' | 'history'>('roster');

    // Form State
    const [open, setOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(COLORS[0].value);
    const [loading, setLoading] = useState(false);

    const refresh = () => {
        api.getWrestlers().then(setWrestlers);
        api.getHistory().then(setHistory);
    };

    useEffect(() => {
        refresh();
    }, []);

    const handleCreate = async () => {
        setLoading(true);
        try {
            await api.createWrestler(newName || undefined, newColor);
            setOpen(false);
            setNewName("");
            refresh();
        } catch (e) {
            alert("Failed to register wrestler. Ensure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        await api.deleteWrestler(id);
        refresh();
    };

    return (
        <div className="min-h-screen p-4 max-w-md mx-auto flex flex-col">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="icon" className="rounded-none border-neutral-700 bg-neutral-900">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="font-arcade text-xl text-blue-500">SUMOVERSE</h1>
                </div>
            </header>

            <div className="flex bg-neutral-900 p-1 mb-6 rounded-lg border border-neutral-800">
                <button
                    onClick={() => setView('roster')}
                    className={`flex-1 py-2 text-xs font-arcade transition-colors ${view === 'roster' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500'}`}
                >
                    ROSTER
                </button>
                <button
                    onClick={() => setView('history')}
                    className={`flex-1 py-2 text-xs font-arcade transition-colors ${view === 'history' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500'}`}
                >
                    HISTORY
                </button>
            </div>

            {view === 'roster' ? (
                <div className="space-y-4 pb-20">
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 font-arcade text-xs">
                                <UserPlus className="mr-2 h-4 w-4" /> REGISTER WRESTLER
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-neutral-900 border-neutral-700 text-white font-sans">
                            <DialogHeader>
                                <DialogTitle className="font-arcade text-orange-500">NEW WRESTLER</DialogTitle>
                                <DialogDescription>
                                    Enter your name and pick your colors. You will be assigned a Sumo stable and generated stats.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="text-right text-xs uppercase text-neutral-400 text-left">
                                        Name (Optional)
                                    </Label>
                                    <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Matt" className="bg-black border-neutral-700 font-arcade text-sm" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-right text-xs uppercase text-neutral-400 text-left">
                                        Signature Color
                                    </Label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {COLORS.map(c => (
                                            <button
                                                key={c.name}
                                                onClick={() => setNewColor(c.value)}
                                                className={`w-full aspect-square rounded-sm border-2 transition-all ${newColor === c.value ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                style={{ backgroundColor: c.hex }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreate} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 font-arcade">
                                    {loading ? "TRAINING..." : "ENTER DOJYO"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <div className="mt-4">
                        {wrestlers.map(w => (
                            <SwipeableWrestlerCard key={w.id} wrestler={w} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-2 pb-20">
                    {history.length === 0 && <div className="text-center text-neutral-600 font-arcade text-xs mt-10">NO MATCHES YET</div>}
                    {history.map(match => (
                        <Card key={match.id} className="p-3 bg-neutral-900 border-neutral-800 flex justify-between items-center">
                            <div className="text-xs font-arcade text-neutral-400 w-1/3 text-right pr-2 truncate">
                                {match.p1_custom ? match.p1_custom.toUpperCase() : match.p1_name}
                            </div>
                            <div className="text-[10px] text-neutral-600 px-2">VS</div>
                            <div className="text-xs font-arcade text-neutral-400 w-1/3 pl-2 truncate">
                                {match.p2_custom ? match.p2_custom.toUpperCase() : match.p2_name}
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 top-8 text-[9px] text-yellow-600 uppercase tracking-widest">
                                Winner: {match.winner_custom ? match.winner_custom : match.winner_name}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
