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
    branchColor
}: {
    skill: Skill;
    isUnlocked: boolean;
    canUnlock: boolean;
    onSelect: () => void;
    branchColor: string;
}) {
    // Larger nodes for better tappability and readability
    const baseClasses = "w-16 h-16 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative";

    let stateClasses = "";
    let bgStyle: React.CSSProperties = {};
    let textColorClass = "text-white";

    if (isUnlocked) {
        // Unlocked: Full color with gold border glow
        stateClasses = "border-2 border-[var(--gold)] shadow-[0_0_12px_rgba(255,215,0,0.6)]";
        bgStyle = { backgroundColor: branchColor };
        textColorClass = "text-white";
    } else if (canUnlock) {
        // Available: Pulsing border, semi-transparent
        stateClasses = "border-2 border-[var(--jade)] hover:scale-105 hover:shadow-lg";
        bgStyle = { backgroundColor: branchColor, opacity: 0.7 };
        textColorClass = "text-white";
    } else {
        // Locked: Grayed out
        stateClasses = "border-2 border-gray-700";
        bgStyle = { backgroundColor: '#2a2a2a' };
        textColorClass = "text-gray-500";
    }

    return (

        <button
            onClick={onSelect}
            className={`${baseClasses} ${stateClasses} p-1`}
            style={bgStyle}
        >
            {/* Skill Name - Wrapped text for better readability */}
            <span className={`font-[family-name:var(--font-dotgothic)] text-[9px] ${textColorClass} text-center leading-3 px-0.5 drop-shadow-[1px_1px_0_#000] break-words w-full`}>
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
            {/* Lock Icon for locked */}
            {!canUnlock && !isUnlocked && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-600 px-1 py-0.5 rounded text-[8px] text-white/80 font-bold whitespace-nowrap">
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
        try {
            const [tree, skills, wData] = await Promise.all([
                api.getSkillTree(),
                api.getWrestlerSkills(wrestlerId),
                api.getWrestler(wrestlerId)
            ]);
            setSkillTree(tree);
            setWrestlerSkills(skills);
            setWrestler(wData);
            setLoading(false);
        } catch {
            setError("Failed to load skill tree");
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [wrestlerId]);

    const isSkillUnlocked = (skillId: string) => {
        return wrestlerSkills?.unlocked_skills.some(s => s.id === skillId) ?? false;
    };

    const canUnlockSkill = (skill: Skill, branchKey: string) => {
        if (isSkillUnlocked(skill.id)) return false;
        if (!wrestlerSkills || wrestlerSkills.skill_points < skill.cost) return false;

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
            setSelectedSkill(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to unlock");
        } finally {
            setUnlocking(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
                <div className="font-[family-name:var(--font-dotgothic)] text-xl text-[var(--gold)] animate-pulse">
                    LOADING KEIKO...
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0d0a14] flex flex-col z-50 overflow-hidden">
            {/* Header - More prominent */}
            <div className="bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] p-4 flex items-center justify-between shadow-lg">
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
                        className="font-[family-name:var(--font-dotgothic)] text-white hover:text-[var(--gold)] text-2xl w-10 h-10 flex items-center justify-center bg-black/30 rounded-lg"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* PROGRESSION HEADER */}
            {wrestler && (
                <div className="bg-[#151020] px-4 py-3 border-b border-gray-800">
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

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/80 text-red-100 text-center py-3 font-[family-name:var(--font-dotgothic)] text-sm">
                    {error}
                </div>
            )}

            {/* Skill Branches - Better spacing and legibility */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {Object.entries(skillTree).map(([key, branch]) => (
                    <div key={key} className="bg-[#1a1428] rounded-xl p-4 border border-gray-800">
                        {/* Branch Header - Larger and clearer */}
                        <div className="flex items-center gap-3 mb-4">
                            <div
                                className="w-5 h-5 rounded border-2 border-white/40"
                                style={{ backgroundColor: branch.color }}
                            />
                            <div>
                                <h3 className="font-[family-name:var(--font-dotgothic)] text-lg" style={{ color: branch.color }}>
                                    {branch.name.toUpperCase()}
                                </h3>
                                <p className="font-[family-name:var(--font-dotgothic)] text-xs text-gray-400 mt-0.5">
                                    {branch.jp} • {branch.description}
                                </p>
                            </div>
                        </div>

                        {/* Skill Grid - 3x2 layout for 6 skills */}
                        <div className="grid grid-cols-3 gap-3 px-1">
                            {branch.skills.map((skill) => (
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
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Skill Detail Panel - More readable */}
            {selectedSkill && (
                <div className="absolute bottom-0 left-0 right-0 bg-[#1a1428] border-t-4 border-[var(--gold)] p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
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
                            className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center"
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

                    {/* Action Buttons - Larger tap targets */}
                    {isSkillUnlocked(selectedSkill.id) ? (
                        <div className="bg-[var(--gold)]/20 border-2 border-[var(--gold)] rounded-lg p-3 text-center">
                            <span className="font-[family-name:var(--font-dotgothic)] text-base text-[var(--gold)]">
                                ✓ MASTERED
                            </span>
                        </div>
                    ) : canUnlockSkill(selectedSkill, selectedBranch!) ? (
                        <button
                            onClick={handleUnlock}
                            disabled={unlocking}
                            className="w-full gba-btn font-[family-name:var(--font-dotgothic)] text-base py-3 rounded-lg"
                        >
                            {unlocking ? "TRAINING..." : `LEARN TECHNIQUE (${selectedSkill.cost} SP)`}
                        </button>
                    ) : (
                        <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-3 text-center">
                            <span className="font-[family-name:var(--font-dotgothic)] text-sm text-gray-400">
                                {wrestlerSkills && wrestlerSkills.skill_points < selectedSkill.cost
                                    ? `NEED ${selectedSkill.cost} SP TO UNLOCK`
                                    : "UNLOCK PREVIOUS TIER FIRST"}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Stat Bonuses Footer - If any skills unlocked */}
            {wrestlerSkills && Object.values(wrestlerSkills.total_bonuses).some(v => v > 0) && !selectedSkill && (
                <div className="bg-[#1a1428] border-t border-gray-700 p-3 flex flex-wrap justify-center gap-4">
                    <span className="font-[family-name:var(--font-dotgothic)] text-xs text-gray-500 mr-2">BONUSES:</span>
                    {Object.entries(wrestlerSkills.total_bonuses).map(([stat, value]) => (
                        value > 0 && (
                            <span key={stat} className="font-[family-name:var(--font-dotgothic)] text-sm text-[var(--jade)]">
                                +{Math.round(value * 100)}% {stat.toUpperCase()}
                            </span>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}
