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

// Vibrant Mawashi Colors - Fun & Easy to Recognize!
const COLORS = [
    { name: "CRIMSON", value: "230,60,60", hex: "#e63c3c" },       // Bright Red
    { name: "ELECTRIC BLUE", value: "60,120,255", hex: "#3c78ff" }, // Vivid Blue
    { name: "SAKURA PINK", value: "255,120,180", hex: "#ff78b4" },  // Cherry Blossom
    { name: "GOLD", value: "255,200,60", hex: "#ffc83c" },          // Championship Gold
    { name: "JADE GREEN", value: "60,200,140", hex: "#3cc88c" },    // Jade
    { name: "SUNSET ORANGE", value: "255,140,60", hex: "#ff8c3c" }, // Bright Orange
    { name: "ROYAL PURPLE", value: "160,80,220", hex: "#a050dc" },  // Purple
    { name: "OCEAN TEAL", value: "60,200,200", hex: "#3cc8c8" },    // Teal
    { name: "LIME", value: "160,230,60", hex: "#a0e63c" },          // Lime Green
    { name: "SNOW WHITE", value: "245,240,230", hex: "#f5f0e6" },   // Ivory/White
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
        } catch {
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
        <div className="min-h-[100dvh] p-4 max-w-md mx-auto flex flex-col wood-texture">
            {/* Decorative Top Border */}
            <div className="wood-border-top h-3 -mx-4 -mt-4 mb-4" />

            {/* Header */}
            <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="icon" className="gba-panel">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="font-[family-name:var(--font-dotgothic)] text-xl text-[var(--jade)]">BANZUKE</h1>
                        <p className="text-[10px] text-muted-foreground">番付 • Rankings</p>
                    </div>
                </div>
            </header>

            {/* Tab Switcher */}
            <div className="flex gba-panel p-1 mb-4">
                <button
                    onClick={() => setView('roster')}
                    className={`flex-1 py-2 text-xs font-[family-name:var(--font-dotgothic)] transition-colors ${view === 'roster' ? 'bg-[var(--jade)]/20 text-[var(--jade)]' : 'text-muted-foreground'}`}
                >
                    ROSTER
                </button>
                <button
                    onClick={() => setView('history')}
                    className={`flex-1 py-2 text-xs font-[family-name:var(--font-dotgothic)] transition-colors ${view === 'history' ? 'bg-[var(--jade)]/20 text-[var(--jade)]' : 'text-muted-foreground'}`}
                >
                    RECORD
                </button>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                {view === 'roster' ? (
                    <div className="space-y-3 pb-20">
                        {/* Register Button */}
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full gba-btn text-xs font-[family-name:var(--font-dotgothic)]">
                                    <UserPlus className="mr-2 h-4 w-4" /> NYUMON (入門)
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="gba-panel border-2 text-foreground max-w-[90vw]">
                                <DialogHeader>
                                    <DialogTitle className="font-[family-name:var(--font-dotgothic)] text-[var(--gold)]">NEW RIKISHI</DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-sm">
                                        Enter your shikona and choose your mawashi color. You will be assigned to a heya.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name" className="text-xs text-muted-foreground font-[family-name:var(--font-dotgothic)]">
                                            SHIKONA (Optional)
                                        </Label>
                                        <Input
                                            id="name"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="Ring name"
                                            className="bg-[var(--input)] border-[var(--border)] font-[family-name:var(--font-dotgothic)] text-sm"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs text-muted-foreground font-[family-name:var(--font-dotgothic)]">
                                            MAWASHI COLOR
                                        </Label>
                                        <div className="grid grid-cols-5 gap-3">
                                            {COLORS.map(c => (
                                                <button
                                                    key={c.name}
                                                    onClick={() => setNewColor(c.value)}
                                                    className={`w-full aspect-square border-3 transition-all ${newColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-black/30 opacity-80 hover:opacity-100 hover:scale-105'}`}
                                                    style={{
                                                        backgroundColor: c.hex,
                                                        boxShadow: newColor === c.value ? `0 0 12px ${c.hex}` : 'none'
                                                    }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground text-center mt-1">
                                            {COLORS.find(c => c.value === newColor)?.name}
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreate} disabled={loading} className="w-full gba-btn font-[family-name:var(--font-dotgothic)]">
                                        {loading ? "TRAINING..." : "ENTER DOHYO"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Wrestler List */}
                        <div className="mt-3">
                            {wrestlers.length === 0 && (
                                <div className="text-center text-muted-foreground font-[family-name:var(--font-dotgothic)] text-xs mt-10">
                                    NO RIKISHI REGISTERED
                                </div>
                            )}
                            {wrestlers.map(w => (
                                <SwipeableWrestlerCard key={w.id} wrestler={w} onDelete={handleDelete} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 pb-20">
                        {history.length === 0 && (
                            <div className="text-center text-muted-foreground font-[family-name:var(--font-dotgothic)] text-xs mt-10">
                                NO BASHO RECORDS
                            </div>
                        )}
                        {history.map(match => (
                            <Card key={match.id} className="gba-panel p-3 flex justify-between items-center relative">
                                <div className="text-xs font-[family-name:var(--font-dotgothic)] text-muted-foreground w-2/5 text-right pr-2 truncate">
                                    {match.p1_custom ? match.p1_custom.toUpperCase() : match.p1_name.toUpperCase()}
                                </div>
                                <div className="text-[10px] text-muted-foreground px-2 font-[family-name:var(--font-dotgothic)]">対</div>
                                <div className="text-xs font-[family-name:var(--font-dotgothic)] text-muted-foreground w-2/5 pl-2 truncate">
                                    {match.p2_custom ? match.p2_custom.toUpperCase() : match.p2_name.toUpperCase()}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Decorative Bottom Border */}
            <div className="wood-border-bottom h-3 -mx-4 -mb-4 mt-4" />
        </div>
    );
}
