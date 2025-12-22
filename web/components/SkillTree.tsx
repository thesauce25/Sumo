"use client";

import { useState, useEffect } from "react";
import { api, Skill, SkillBranch, WrestlerSkillsResponse, Wrestler } from "@/lib/api";
import { WRESTLER_RANKS } from "@/lib/constants";
import { Scroll, Paintbrush, Zap, Trophy, Lock } from "lucide-react";

interface SkillTreeProps {
    wrestlerId: string;
    wrestlerName: string;
    onClose: () => void;
}

// 32-bit Scroll Aesthetic Constants
const SCROLL_BG = "#e6d5ac"; // Parchment
const INK_BLACK = "#1a1515"; // Sumi ink
const STAMP_RED = "#d03e3e"; // Hanko red
const GOLD_ACCENT = "#ccb536"; // Gold leaf

// A pixel-art style skill node
function SkillNode({
    skill,
    isUnlocked,
    canUnlock,
    onSelect,
    branchColor,
    lockReason
}: {
    skill: Skill;
    isUnlocked: boolean;
    canUnlock: boolean;
    onSelect: () => void;
    branchColor: string;
    lockReason?: string;
}) {
    // Determine visual state
    let borderColor = "#8b7e66"; // Faded ink
    let bgColor = "transparent";
    let textColor = "#8b7e66";
    let iconOpacity = 0.3;

    if (isUnlocked) {
        borderColor = INK_BLACK;
        bgColor = "rgba(40, 30, 30, 0.05)";
        textColor = INK_BLACK;
        iconOpacity = 1.0;
    } else if (canUnlock) {
        borderColor = branchColor; // Use branch color to hint at type
        bgColor = "rgba(255,255,255,0.4)";
        textColor = INK_BLACK;
        iconOpacity = 0.8;
    }

    return (
        <button
            onClick={onSelect}
            className={`relative w-24 h-28 flex flex-col items-center justify-between p-2 transition-all duration-200 
                ${canUnlock && !isUnlocked ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''}
                ${!canUnlock && !isUnlocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={{
                border: `3px solid ${isUnlocked ? INK_BLACK : borderColor}`,
                backgroundColor: bgColor,
                boxShadow: isUnlocked ? "2px 2px 0px rgba(0,0,0,0.1)" : "none",
                imageRendering: "pixelated" // 32-bit crispness
            }}
        >
            {/* Scroll/Paper Texture Overlay for Nodes */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/paper.png")` }} />

            {/* Ink wash background effect for high tiers */}
            {skill.tier > 2 && (
                <div className="absolute inset-0 bg-yellow-500/10 z-0 animate-pulse" />
            )}

            {/* Header: Tier */}
            <span className="font-[family-name:var(--font-dotgothic)] text-[8px] uppercase tracking-widest z-10" style={{ color: borderColor }}>
                {skill.jp}
            </span>

            {/* Icon / Central Visual */}
            <div className={`flex-1 flex items-center justify-center z-10 w-full ${canUnlock && !isUnlocked ? 'animate-pulse' : ''}`}>
                {/* Pixel Art Representation of Tier */}
                <div className="text-2xl font-bold font-[family-name:var(--font-dotgothic)] text-center w-full" style={{ color: isUnlocked ? INK_BLACK : borderColor }}>
                    {skill.tier === 3 ? "★★★" : (skill.tier === 2 ? "★★" : "★")}
                </div>
            </div>

            {/* Footer: Name */}
            <span className="font-[family-name:var(--font-dotgothic)] text-[9px] text-center leading-3 z-10 w-full truncate px-1" style={{ color: textColor }}>
                {skill.name.toUpperCase()}
            </span>

            {/* HANKO STAMP (The Red Seal of Mastery) */}
            {isUnlocked && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-4 border-[var(--stamp-red)] rounded-full flex items-center justify-center opacity-80 mix-blend-multiply rotate-[-15deg] animate-in zoom-in duration-300 pointer-events-none z-20"
                    style={{ borderColor: STAMP_RED }}
                >
                    <span className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[var(--stamp-red)] font-bold tracking-widest uppercase transform rotate-12" style={{ color: STAMP_RED }}>
                        MASTER
                    </span>
                </div>
            )}

            {/* Padlock for locked items */}
            {!isUnlocked && !canUnlock && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 opacity-50 z-20">
                    <Lock className="w-6 h-6" />
                </div>
            )}

            {/* Cost Badge for available items */}
            {canUnlock && !isUnlocked && (
                <div className="absolute -bottom-2 bg-[#fdf6e3] border border-[#8b7e66] px-2 py-0.5 rounded-sm z-20 shadow-sm">
                    <span className="font-[family-name:var(--font-dotgothic)] text-[9px] text-[#1a1515]">
                        {skill.cost}pts
                    </span>
                </div>
            )}
        </button>
    );
}

export function SkillTree({ wrestlerId, wrestlerName, onClose }: SkillTreeProps) {
    const [skillTree, setSkillTree] = useState<Record<string, SkillBranch>>({});
    const [wrestlerSkills, setWrestlerSkills] = useState<WrestlerSkillsResponse | null>(null);
    const [wrestler, setWrestler] = useState<Wrestler | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const treePromise = api.getSkillTree().catch(e => { throw new Error(`Failed to load Skill Tree: ${e.message}`); });
            const skillsPromise = api.getWrestlerSkills(wrestlerId).catch(e => { throw new Error(`Failed to load Wrestler Skills: ${e.message}`); });
            const wrestlerPromise = api.getWrestler(wrestlerId).catch(e => { throw new Error(`Failed to load Wrestler Data: ${e.message}`); });

            const [tree, skills, wData] = await Promise.all([treePromise, skillsPromise, wrestlerPromise]);

            setSkillTree(tree);
            setWrestlerSkills(skills);
            setWrestler(wData);
        } catch (e: any) {
            console.error("SkillTree load error:", e);
            setError(e.message || "Failed to load skill tree.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [wrestlerId]);

    const isSkillUnlocked = (skillId: string) => {
        return wrestlerSkills?.unlocked_skills.some(s => s.id === skillId) ?? false;
    };

    const getLockReason = (skill: Skill, branchKey: string | null): string | null => {
        if (isSkillUnlocked(skill.id)) return null;
        if (skill.tier > 1) {
            if (!branchKey || !skillTree[branchKey]) return null;
            const prevTierSkill = skillTree[branchKey]?.skills.find(s => s.tier === skill.tier - 1);
            if (prevTierSkill && !isSkillUnlocked(prevTierSkill.id)) {
                return `Requires ${prevTierSkill.name}`;
            }
        }
        return null;
    };

    const canUnlockSkill = (skill: Skill, branchKey: string) => {
        if (isSkillUnlocked(skill.id)) return false;
        if (skill.tier > 1) {
            const prevTierSkill = skillTree[branchKey]?.skills.find(s => s.tier === skill.tier - 1);
            if (prevTierSkill && !isSkillUnlocked(prevTierSkill.id)) return false;
        }
        return true;
    };

    const handleUnlock = async () => {
        if (!selectedSkill || !wrestlerSkills) return;
        setUnlocking(true);
        setError(null);
        try {
            await api.unlockSkill(wrestlerId, selectedSkill.id);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to unlock");
            setUnlocking(false);
        } finally {
            setUnlocking(false);
        }
    };

    // Calculate Progress Stats
    const totalSkills = Object.values(skillTree).reduce((acc, branch) => acc + branch.skills.length, 0);
    const unlockedCount = wrestlerSkills?.unlocked_skills.length || 0;
    const progressPercent = totalSkills > 0 ? Math.round((unlockedCount / totalSkills) * 100) : 0;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0d0a14] z-50 flex items-center justify-center">
                <div className="font-[family-name:var(--font-dotgothic)] text-xl text-[var(--gold)] animate-pulse flex flex-col items-center gap-2">
                    <span>Reading Scrolls...</span>
                    <div className="w-32 h-1 bg-gray-800"><div className="h-full bg-[var(--gold)] w-1/2 animate-pulse" /></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-[#0d0a14] z-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-red-400 font-[family-name:var(--font-dotgothic)] text-xl mb-4">ERROR</div>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={onClose} className="text-white underline">Close</button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            {/* THE SCROLL CONTAINER */}
            <div
                className="w-full max-w-5xl h-[95vh] bg-[#e6d5ac] relative flex flex-col overflow-hidden"
                style={{
                    boxShadow: "inset 0 0 100px rgba(92, 64, 51, 0.4), 0 20px 50px rgba(0,0,0,0.8)",
                    borderRadius: "2px",
                }}
            >
                {/* Decorative Scroll Experience: Top/Bottom Wood Rollers */}
                <div className="h-6 bg-[#3d2b23] w-full shadow-lg z-20 flex items-center justify-center border-b border-[#2a1f1f]">
                    <div className="w-1/2 h-1 bg-[#5c4033]/50 rounded-full" />
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-[#8b7e66] scrollbar-track-transparent">
                    {/* Background Texture Overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply" />

                    {/* HEADER SECTION */}
                    <div className="p-6 text-center border-b border-[#8b7e66]/30 relative">
                        <div className="inline-block border-4 border-double border-[#1a1515] p-3 bg-[#fdf6e3]/50 rounded-sm rotate-1 shadow-sm transform hover:rotate-0 transition-transform">
                            <h2 className="font-[family-name:var(--font-dotgothic)] text-4xl text-[#1a1515] tracking-[0.2em] drop-shadow-sm">
                                秘伝書
                            </h2>
                            <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[#5c4033] mt-1 tracking-widest uppercase">
                                The Scroll of Secrets
                            </p>
                        </div>

                        <div className="mt-4 flex justify-center items-center gap-12 text-[#1a1515]">
                            <div className="text-center group cursor-default">
                                <p className="text-[9px] uppercase tracking-widest text-[#8b7e66] font-[family-name:var(--font-dotgothic)] mb-1 group-hover:text-[#d03e3e]">DISCIPLE</p>
                                <p className="text-xl font-[family-name:var(--font-dotgothic)] border-b border-transparent group-hover:border-[#d03e3e]">{wrestlerName.toUpperCase()}</p>
                            </div>
                            <div className="h-8 w-px bg-[#8b7e66]/50"></div>
                            <div className="text-center group cursor-default">
                                <p className="text-[9px] uppercase tracking-widest text-[#8b7e66] font-[family-name:var(--font-dotgothic)] mb-1 group-hover:text-[#d03e3e]">MASTERY</p>
                                <p className="text-xl font-[family-name:var(--font-dotgothic)] text-[#d03e3e]">{progressPercent}%</p>
                            </div>
                            <div className="h-8 w-px bg-[#8b7e66]/50"></div>
                            <div className="text-center group cursor-default">
                                <p className="text-[9px] uppercase tracking-widest text-[#8b7e66] font-[family-name:var(--font-dotgothic)] mb-1 group-hover:text-[#d03e3e]">SPIRIT (SP)</p>
                                <p className="text-xl font-[family-name:var(--font-dotgothic)]">{wrestlerSkills?.skill_points || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* MAIN SKILL GRID */}
                    <div className="p-8 space-y-16">
                        {/* Intro Text / Quote */}
                        <div className="max-w-xl mx-auto text-center relative py-4">
                            <span className="text-6xl text-[#8b7e66]/10 absolute -top-4 left-0 font-serif">"</span>
                            <p className="font-[family-name:var(--font-dotgothic)] text-[#5c4033] text-sm leading-relaxed italic">
                                True strength lies not just in the body, but in the refinement of technique.
                                <br />Master the three pillars of Sumo to become Yokozuna.
                            </p>
                            <span className="text-6xl text-[#8b7e66]/10 absolute -bottom-8 right-0 font-serif">"</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                            {Object.entries(skillTree).map(([key, branch]) => (
                                <div key={key} className="flex flex-col relative group">
                                    {/* Branch Header as a "Wooden Sign" or calligraphy */}
                                    <div className="mb-8 text-center">
                                        <div className="inline-block relative">
                                            <span className="font-[family-name:var(--font-dotgothic)] text-7xl opacity-5 absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none w-full text-center">
                                                {branch.jp}
                                            </span>
                                            <h3 className="font-[family-name:var(--font-dotgothic)] text-3xl text-[#1a1515] relative z-10 border-b-2 border-[#1a1515] pb-2 uppercase tracking-widest">
                                                {branch.name}
                                            </h3>
                                        </div>
                                        <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[#8b7e66] mt-3 h-8 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            {branch.description}
                                        </p>
                                    </div>

                                    {/* Vertical Path Line */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-32 bottom-0 w-[2px] bg-[#1a1515]/10 rounded-full" />

                                    {/* Nodes Stack */}
                                    <div className="space-y-12 relative z-10 flex flex-col items-center">
                                        {branch.skills.map((skill, index) => {
                                            const lockReason = getLockReason(skill, key);
                                            return (
                                                <div key={skill.id} className="relative group/node w-full flex justify-center">
                                                    {/* Connector from previous */}
                                                    {index > 0 && (
                                                        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-[3px] h-12 
                                                            ${isSkillUnlocked(skill.id) ? 'bg-[#1a1515]' : 'bg-[#1a1515]/20'}
                                                        transition-colors duration-500`} />
                                                    )}

                                                    {/* Tier Marker on the side */}
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                                        <span className="text-[9px] font-[family-name:var(--font-dotgothic)] text-[#8b7e66] rotate-90 inline-block">TIER {skill.tier}</span>
                                                    </div>

                                                    <SkillNode
                                                        skill={skill}
                                                        isUnlocked={isSkillUnlocked(skill.id)}
                                                        canUnlock={canUnlockSkill(skill, key)}
                                                        onSelect={() => {
                                                            setSelectedSkill(skill);
                                                            setSelectedBranch(key);
                                                        }}
                                                        branchColor={branch.color}
                                                        lockReason={lockReason ?? undefined}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Spacer */}
                    <div className="h-32 flex items-center justify-center opacity-30">
                        <div className="bg-[#1a1515] w-8 h-8 rounded-full" /> {/* End seal */}
                    </div>
                </div>

                <div className="h-6 bg-[#3d2b23] w-full shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-20 border-t border-[#2a1f1f]" /> {/* Bottom Roller */}

                {/* CLOSE BUTTON (Absolute) */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-[#1a1515] hover:text-[#d03e3e] transition-colors bg-[#e6d5ac] border-2 border-[#1a1515] w-10 h-10 flex items-center justify-center rounded-full font-bold shadow-md z-30 hover:rotate-90 duration-300"
                >
                    ✕
                </button>

                {/* DETAIL OVERLAY (Slide up card) */}
                {selectedSkill && (
                    <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[2px] flex items-end justify-center animate-in fade-in duration-200">
                        {/* Click outside to close */}
                        <div className="absolute inset-0" onClick={() => setSelectedSkill(null)} />

                        <div className="bg-[#fdf6e3] w-full max-w-2xl mx-4 mb-8 p-8 rounded-sm shadow-2xl border-4 border-double border-[#1a1515] relative animate-in slide-in-from-bottom-10 flex gap-8">
                            {/* Decorative corner */}
                            <div className="absolute top-2 right-2 flex gap-1">
                                <span className="text-[#1a1515] text-xs font-mono">+++</span>
                            </div>

                            {/* Left: Giant Character Visual */}
                            <div className="w-32 flex flex-col items-center gap-2">
                                <div className="bg-[#1a1515] text-[#f2e6c2] w-32 h-32 flex items-center justify-center rounded-sm shadow-inner border-2 border-[#8b7e66]">
                                    <span className="text-6xl font-[family-name:var(--font-dotgothic)]">{selectedSkill.jp}</span>
                                </div>
                                <div className="text-center">
                                    <span className="font-[family-name:var(--font-dotgothic)] text-xs text-[#8b7e66] uppercase tracking-widest">Technique</span>
                                </div>
                            </div>

                            {/* Right: Info & Action */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-3xl font-[family-name:var(--font-dotgothic)] text-[#1a1515] uppercase tracking-wide border-b border-[#1a1515]/10 pb-2 mb-2">
                                        {selectedSkill.name}
                                    </h3>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className="bg-[#1a1515] text-[#f2e6c2] text-[10px] px-2 py-1 rounded-sm font-[family-name:var(--font-dotgothic)]">
                                            TIER {selectedSkill.tier}
                                        </span>
                                        {Object.entries(selectedSkill.effect).map(([k, v]) => (
                                            <span key={k} className="bg-[#e6d5ac] text-[#1a1515] border border-[#1a1515]/20 text-[10px] px-2 py-1 rounded-sm font-[family-name:var(--font-dotgothic)] uppercase items-center flex gap-1">
                                                <Zap className="w-3 h-3" />
                                                {(v as number) * 100}% {k}
                                            </span>
                                        ))}
                                    </div>

                                    <p className="font-[family-name:var(--font-dotgothic)] text-[#5c4033] text-sm leading-relaxed border-l-4 border-[#d03e3e] pl-4 italic bg-[#d03e3e]/5 p-2 rounded-r">
                                        "{selectedSkill.desc}"
                                    </p>
                                </div>

                                {/* Action Area */}
                                <div className="mt-6">
                                    {isSkillUnlocked(selectedSkill.id) ? (
                                        <div className="bg-[#1a1515]/5 border border-[#1a1515]/20 p-4 text-center rounded-sm">
                                            <p className="font-[family-name:var(--font-dotgothic)] text-[#1a1515] text-xl flex items-center justify-center gap-3">
                                                <span className="text-[#d03e3e] text-3xl animate-bounce">💮</span>
                                                <span>MASTERED</span>
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            {(() => {
                                                const lockReason = getLockReason(selectedSkill, selectedBranch);
                                                const canAfford = wrestlerSkills && wrestlerSkills.skill_points >= selectedSkill.cost;

                                                if (lockReason) {
                                                    return (
                                                        <div className="bg-red-900/10 border border-red-900/30 p-4 text-center rounded-sm">
                                                            <p className="font-[family-name:var(--font-dotgothic)] text-red-800 text-sm font-bold">
                                                                ⛔ LOCKED
                                                            </p>
                                                            <p className="font-[family-name:var(--font-dotgothic)] text-red-600 text-xs mt-1">
                                                                {lockReason}
                                                            </p>
                                                        </div>
                                                    )
                                                }

                                                return (
                                                    <button
                                                        onClick={handleUnlock}
                                                        disabled={!canAfford || unlocking}
                                                        className={`w-full py-4 text-xl font-[family-name:var(--font-dotgothic)] uppercase tracking-[0.1em] transition-all rounded-sm relative overflow-hidden group
                                                            ${canAfford
                                                                ? 'bg-[#1a1515] text-[#f2e6c2] hover:bg-[#d03e3e] hover:shadow-xl'
                                                                : 'bg-[#8b7e66] text-[#e6d5ac] opacity-70 cursor-not-allowed'}
                                                        `}
                                                    >
                                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                                            {unlocking ? "Learning..." : canAfford
                                                                ? <><span>Master Technique</span> <span className="text-xs opacity-70">({selectedSkill.cost} SP)</span></>
                                                                : `Need ${selectedSkill.cost} SP`}
                                                        </span>
                                                        {/* Hover Effect */}
                                                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                                                    </button>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
