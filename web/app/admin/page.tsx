"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Wrestler, MatchRecord } from "@/lib/api";
import { WrestlerTable } from "@/components/admin/WrestlerTable";
import { MatchHistory } from "@/components/admin/MatchHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Activity, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
    const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
    const [matches, setMatches] = useState<MatchRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [wData, mData] = await Promise.all([
                api.getWrestlers(),
                api.getHistory(undefined, 20) // Get last 20 matches
            ]);
            setWrestlers(wData);
            setMatches(mData);
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalMatches = wrestlers.reduce((sum, w) => sum + (w.matches || 0), 0) / 2; // Approximate since each match counts for 2 wrestlers
    // Or better, just count total wins (assuming no draws)
    const totalWins = wrestlers.reduce((sum, w) => sum + (w.wins || 0), 0);

    // Calculate total XP in system
    const totalXP = wrestlers.reduce((sum, w) => sum + (w.xp || 0), 0);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            <LayoutDashboard className="w-8 h-8 text-zinc-500" />
                            Sumo Analytics
                        </h1>
                        <p className="text-zinc-500 mt-1">Real-time performance metrics and system status.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Button variant="outline" className="text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-800">
                                Back to App
                            </Button>
                        </Link>
                        <Button onClick={fetchData} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Data
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">Total Wrestlers</CardTitle>
                            <Users className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{wrestlers.length}</div>
                            <p className="text-xs text-zinc-600 mt-1">Registered fighters</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">Total Combat</CardTitle>
                            <Activity className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{Math.floor(totalWins)}</div>
                            <p className="text-xs text-zinc-600 mt-1">Completed matches (Wins)</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">System XP</CardTitle>
                            <Trophy className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{totalXP.toLocaleString()}</div>
                            <p className="text-xs text-zinc-600 mt-1">Total experience accumulated</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: Wrestler Table (Span 2) */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-300 flex items-center gap-2">
                            Wrestler Leaderboard
                            <span className="text-xs font-normal text-zinc-500 py-0.5 px-2 bg-zinc-900 rounded-full">{wrestlers.length}</span>
                        </h2>
                        <WrestlerTable wrestlers={wrestlers} />
                    </div>

                    {/* Right Col: Recent Matches (Span 1) */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-300">Recent Activity</h2>
                        <Card className="bg-zinc-900/30 border-zinc-800 h-full max-h-[600px] overflow-y-auto">
                            <CardContent className="p-4">
                                <MatchHistory matches={matches} />
                            </CardContent>
                        </Card>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Icon for KPI
function Trophy(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )
}
