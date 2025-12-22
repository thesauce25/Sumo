"use client";

import { useState, useEffect } from "react";
import { api, Skill, SkillBranch, WrestlerSkillsResponse, Wrestler } from "@/lib/api";
import { WRESTLER_RANKS } from "@/lib/constants";

interface SkillTreeProps {
    wrestlerId: string;
    wrestlerName: string;
    onClose: () => void;
}

// Improved Skill Node with better legibility
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
    // Helper to handle the "r,g,b" string from backend
    const formatColor = (c: string) => c.includes(',') ? `rgb(${c})` : c;
    const safeBranchColor = formatColor(branchColor);

    // Larger nodes for better tappability and readability
    const baseClasses = "w-16 h-16 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative";

    let stateClasses = "";
    let bgStyle: React.CSSProperties = {};
    let textColorClass = "text-white";

    if (isUnlocked) {
        // Unlocked: Gold border, rich dark background, high contrast text
        stateClasses = "border-2 border-[var(--gold)] bg-[#2a1f1f] shadow-[0_0_8px_rgba(255,215,0,0.4)]";
        bgStyle = {}; // Remove dynamic color to keep consistent dark theme with colored borders
        textColorClass = "text-white font-bold";
    } else if (canUnlock) {
        // Available: Color border, slightly lighter background
        // Use the branch color for the border to distinguish types!
        stateClasses = "border-2 hover:scale-105 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-pulse";
        bgStyle = { borderColor: safeBranchColor, backgroundColor: 'rgba(255,255,255,0.05)' };
        textColorClass = "text-white font-bold";
    } else {
        // Locked: Dark gray border, but lighter text for readability
        stateClasses = "border-2 border-gray-600 bg-[#151515] opacity-80";
        bgStyle = {};
        textColorClass = "text-gray-400"; // Much lighter than gray-500
    }

    return (
        <button
            onClick={onSelect}
            className={`${baseClasses} ${stateClasses} p-1`}
            style={bgStyle}
        >
            {/* Skill Name - Wrapped text for better readability */}
            <span className={`font-[family-name:var(--font-dotgothic)] text-[9px] ${textColorClass} text-center leading-3 px-0.5 drop-shadow-md break-words w-full`}>
                {skill.name.toUpperCase()}
            </span>
            {/* Tier Badge */}
            <span className={`font-[family-name:var(--font-dotgothic)] text-[8px] ${isUnlocked ? 'text-[var(--gold)]' : 'text-gray-400'} mt-0.5`}>
                TIER {skill.tier}
            </span>
            {/* Unlocked Checkmark */}
            {isUnlocked && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--gold)] rounded-full flex items-center justify-center border-2 border-black">
                    <span className="text-[10px] text-black font-bold">✓</span>
                </div>
            )}
            {/* Cost Badge for unlockable */}
            {canUnlock && !isUnlocked && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[var(--jade)] px-1.5 py-0.5 rounded text-[8px] text-black font-bold whitespace-nowrap">
                    {skill.cost} SP
                </div>
            )}
            {/* Locked Icon */}
            {!canUnlock && !isUnlocked && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap text-red-200 bg-red-900/80 border border-red-500/50">
                    LOCKED
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
            // Fetch concurrently but handle errors individually
            const treePromise = api.getSkillTree().catch(e => { throw new Error(`Failed to load Skill Tree: ${e.message}`); });
            const skillsPromise = api.getWrestlerSkills(wrestlerId).catch(e => { throw new Error(`Failed to load Wrestler Skills: ${e.message}`); });
            const wrestlerPromise = api.getWrestler(wrestlerId).catch(e => { throw new Error(`Failed to load Wrestler Data: ${e.message}`); });

            const [tree, skills, wData] = await Promise.all([treePromise, skillsPromise, wrestlerPromise]);

            setSkillTree(tree);
            setWrestlerSkills(skills);
            setWrestler(wData);
        } catch (e: any) {
            console.error("SkillTree load error:", e);
            setError(e.message || "Failed to load skill tree. Please check connection.");
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

        // 1. Check SP
        // Note: This isn't a "Lock" reason per se, but an inability to purchase.
        // We'll separate this logic in the UI or keep it simple.

        // 2. Check Prerequisite
        if (skill.tier > 1) {
            if (!branchKey || !skillTree[branchKey]) return null; // Safety check
            const prevTierSkill = skillTree[branchKey]?.skills.find(s => s.tier === skill.tier - 1);
            if (prevTierSkill && !isSkillUnlocked(prevTierSkill.id)) {
                return `REQUIRES ${prevTierSkill.name.toUpperCase()} (TIER ${prevTierSkill.tier})`;
            }
        }

        // 3. Check Cost (Optional, if we want to "Lock" based on funds)
        if (wrestlerSkills && wrestlerSkills.skill_points < skill.cost) {
            return `NEED ${skill.cost} SP`;
        }

        return null;
    };

    const canUnlockSkill = (skill: Skill, branchKey: string) => {
        // If there's any lock reason (including cost), we can't unlock right now
        // BUT strict "Can Unlock" usually means "Requirements Met". 
        // Let's define "Can Unlock" as: Prereqs met + Not Unlocked. Cost is separate check for button state.
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
            // Optimistic update or refetch
            await refresh();
            // Keep selected to see the "Mastered" state
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to unlock");
            setUnlocking(false);
        } finally {
            // If successful refetch happens, unlocking is reset
            // If error, we reset unlocking here
            if (loading) setUnlocking(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0d0a14] z-50 flex flex-col items-center justify-center">
                <div className="font-[family-name:var(--font-dotgothic)] text-xl text-[var(--gold)] animate-pulse mb-4">
                    LOADING KEIKO...
                </div>
                {/* Fake loading bar for aesthetics */}
                <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--gold)] animate-[width_1s_ease-in-out_infinite]" style={{ width: '60%' }}></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-[#0d0a14] z-50 flex flex-col items-center justify-center p-6">
                <div className="text-red-400 font-[family-name:var(--font-dotgothic)] text-xl mb-4 text-center">
                    ERROR INITIALIZING TRAINING
                </div>
                <div className="text-gray-400 font-[family-name:var(--font-dotgothic)] text-sm mb-6 text-center max-w-xs">
                    {error}
                </div>
                <button
                    onClick={refresh}
                    className="px-6 py-3 bg-[var(--gold)] text-black font-[family-name:var(--font-dotgothic)] rounded hover:bg-yellow-500 transition-colors"
                >
                    RETRY CONNECTION
                </button>
                <button
                    onClick={onClose}
                    className="mt-4 text-gray-500 underline font-[family-name:var(--font-dotgothic)] text-sm"
                >
                    Close
                </button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-[#0d0a14] flex flex-col z-50 overflow-hidden">
            {/* Header - More prominent */}
            <div className="bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] p-4 flex items-center justify-between shadow-lg shrink-0">
                <div>
                    <h2 className="font-[family-name:var(--font-dotgothic)] text-2xl text-[var(--gold)] tracking-wide drop-shadow-[2px_2px_0_#000]">
                        稽古 KEIKO
                    </h2>
                    <p className="font-[family-name:var(--font-dotgothic)] text-sm text-white/90 mt-1">
                        {wrestlerName.toUpperCase()}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* SP Counter - Larger and more visible */}
                    <div className="bg-[#1a1428] px-4 py-2 border-2 border-[var(--gold)] rounded-lg">
                        <span className="font-[family-name:var(--font-dotgothic)] text-lg text-[var(--gold)]">
                            {wrestlerSkills?.skill_points ?? 0} <span className="text-sm">SP</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="font-[family-name:var(--font-dotgothic)] text-white hover:text-[var(--gold)] text-2xl w-10 h-10 flex items-center justify-center bg-black/30 rounded-lg border border-transparent hover:border-white/20"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* PROGRESSION HEADER */}
            {wrestler && (
                <div className="bg-[#151020] px-4 py-3 border-b border-gray-800 shrink-0">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-[family-name:var(--font-dotgothic)] text-xl" style={{ color: WRESTLER_RANKS.find(r => r.name === wrestler.rank_name)?.color || 'white' }}>
                                {wrestler.rank_name?.toUpperCase()}
                            </span>
                            {wrestler.fighting_style && (
                                <span className="bg-purple-900/50 border border-purple-500 text-purple-200 text-[10px] px-2 py-0.5 rounded font-[family-name:var(--font-dotgothic)] uppercase">
                                    {wrestler.fighting_style.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                        <span className="font-[family-name:var(--font-dotgothic)] text-xs text-gray-400">
                            {wrestler.xp} XP
                        </span>
                    </div>
                    {/* XP BAR */}
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                        {(() => {
                            const curRank = WRESTLER_RANKS.findIndex(r => r.name === wrestler.rank_name) || 0;
                            const nextRank = WRESTLER_RANKS[curRank + 1];
                            const curRankXp = WRESTLER_RANKS[curRank]?.xp || 0;
                            const nextRankXp = nextRank?.xp || curRankXp * 1.5; // Fallback
                            const progress = Math.min(100, Math.max(0, ((wrestler.xp || 0) - curRankXp) / (nextRankXp - curRankXp) * 100));
                            return <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        })()}
                    </div>
                </div>
            )}

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
                {/* TRAINING BENEFITS EXPLANATION */}
                <div className="bg-[#1a1428] p-4 rounded-xl border border-gray-700/50">
                    <h3 className="font-[family-name:var(--font-dotgothic)] text-sm text-[var(--gold)] mb-2">Why Train?</h3>
                    <p className="font-[family-name:var(--font-dotgothic)] text-xs text-gray-400 leading-relaxed">
                        Unlocking skills passively boosts your wrestler's stats (Strength/Tech/Speed).
                        <br />
                        <br />
                        Additionally, skills have a <span className="text-[var(--jade)]">25% chance</span> to trigger special moves in combat:
                        <ul className="list-disc ml-4 mt-1 space-y-1">
                            <li><span className="text-red-400">Strength:</span> Critical Pushes (1.5x - 2.0x Force)</li>
                            <li><span className="text-blue-400">Technique:</span> Stamina Drain (Tire out opponent)</li>
                            <li><span className="text-green-400">Speed:</span> Double Strikes</li>
                        </ul>
                    </p>
                </div>

                {Object.entries(skillTree).map(([key, branch]) => {
                    const formatColor = (c: string) => c.includes(',') ? `rgb(${c})` : c;
                    const safeColor = formatColor(branch.color);

                    // Group skills by Tier
                    const tier1 = branch.skills.filter(s => s.tier === 1);
                    const tier2 = branch.skills.filter(s => s.tier === 2);

                    return (
                        <div key={key} className="bg-[#1e1e24] rounded-xl p-4 border border-gray-700 shadow-md">
                            {/* Branch Header */}
                            <div className="flex items-center gap-3 mb-4 border-b border-gray-700 pb-2">
                                <div
                                    className="w-5 h-5 rounded border-2 border-white/40"
                                    style={{ backgroundColor: safeColor }}
                                />
                                <div className="flex-1">
                                    <h3 className="font-[family-name:var(--font-dotgothic)] text-lg text-white tracking-widest">
                                        {branch.name.toUpperCase()}
                                    </h3>
                                    <p className="font-[family-name:var(--font-dotgothic)] text-xs text-gray-400">
                                        {branch.description}
                                    </p>
                                </div>
                            </div>

                            {/* TIER 1 ROW */}
                            <div className="mb-6">
                                <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-gray-500 mb-2 uppercase tracking-wide">
                                    Tier 1 • Novice
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    {tier1.map((skill) => {
                                        const lockReason = getLockReason(skill, key);
                                        return (
                                            <SkillNode
                                                key={skill.id}
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
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Connector Line (Visual) */}
                            {tier2.length > 0 && (
                                <div className="flex justify-center -mt-4 mb-2">
                                    <div className="w-0.5 h-4 bg-gray-700"></div>
                                </div>
                            )}

                            {/* TIER 2 ROW */}
                            {tier2.length > 0 && (
                                <div>
                                    <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[var(--gold)]/70 mb-2 uppercase tracking-wide">
                                        Tier 2 • Master
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {tier2.map((skill) => {
                                            const lockReason = getLockReason(skill, key);
                                            return (
                                                <SkillNode
                                                    key={skill.id}
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
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Skill Detail Panel - More readable */}
            {
                selectedSkill && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#0d0a14] border-t-4 border-[var(--gold)] p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] z-50 animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-[family-name:var(--font-dotgothic)] text-xl text-[var(--gold)]">
                                    {selectedSkill.name.toUpperCase()}
                                </h3>
                                <p className="font-[family-name:var(--font-dotgothic)] text-sm text-gray-400 mt-1">
                                    {selectedSkill.jp} • Tier {selectedSkill.tier}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSkill(null)}
                                className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="font-[family-name:var(--font-dotgothic)] text-base text-gray-200 mb-4 leading-relaxed">
                            {selectedSkill.desc}
                        </p>

                        {/* Effects - Larger and clearer */}
                        <div className="flex flex-wrap gap-3 mb-5">
                            {Object.entries(selectedSkill.effect).map(([stat, value]) => (
                                <div key={stat} className="bg-[#2a1f3d] px-3 py-2 rounded-lg border border-[var(--jade)]/50">
                                    <span className="font-[family-name:var(--font-dotgothic)] text-sm text-[var(--jade)]">
                                        +{Math.round(Number(value) * 100)}% {stat.toUpperCase()}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Action Button Area */}
                        <div>
                            {isSkillUnlocked(selectedSkill.id) ? (
                                <div className="bg-[var(--gold)]/20 border-2 border-[var(--gold)] rounded-lg p-3 text-center">
                                    <span className="font-[family-name:var(--font-dotgothic)] text-base text-[var(--gold)]">
                                        ✓ TECHNIQUE MASTERED
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(() => {
                                        // Safe access with null check
                                        const lockReason = getLockReason(selectedSkill, selectedBranch);
                                        const canAfford = wrestlerSkills && wrestlerSkills.skill_points >= selectedSkill.cost;

                                        if (lockReason && lockReason.includes("REQUIRES")) {
                                            // Hard Lock: Prereq missing
                                            return (
                                                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-center flex flex-col gap-1">
                                                    <span className="font-[family-name:var(--font-dotgothic)] text-red-300 text-sm">⛔ LOCKED</span>
                                                    <span className="font-[family-name:var(--font-dotgothic)] text-red-200 text-xs">{lockReason}</span>
                                                </div>
                                            );
                                        } else if (!canAfford) {
                                            // Soft Lock: Not enough SP
                                            return (
                                                <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-3 text-center flex flex-col gap-1 opacity-80">
                                                    <span className="font-[family-name:var(--font-dotgothic)] text-gray-400 text-sm">need more SP</span>
                                                    <span className="font-[family-name:var(--font-dotgothic)] text-gray-300 text-xs">
                                                        Cost: {selectedSkill.cost} SP (Have: {wrestlerSkills?.skill_points})
                                                    </span>
                                                </div>
                                            );
                                        } else {
                                            // Available to buy!
                                            return (
                                                <button
                                                    onClick={handleUnlock}
                                                    disabled={unlocking}
                                                    className="w-full bg-[var(--jade)] hover:bg-[#00a86b] active:scale-[0.98] transition-all
                                                         font-[family-name:var(--font-dotgothic)] text-black text-lg py-4 rounded-lg
                                                         shadow-[0_4px_0_#004d30] active:shadow-none active:translate-y-[4px]"
                                                >
                                                    {unlocking ? "TRAINING..." : `LEARN TECHNIQUE (${selectedSkill.cost} SP)`}
                                                </button>
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
