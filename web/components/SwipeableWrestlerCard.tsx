"use client";

import { motion, useAnimation, useMotionValue, PanInfo } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { Wrestler } from "@/lib/api";
import Link from "next/link";
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
import { useState } from "react";
import { PixelSumo } from "@/components/PixelSumo";

interface Props {
    wrestler: Wrestler;
    onDelete: (id: string) => void;
}

export function SwipeableWrestlerCard({ wrestler, onDelete }: Props) {
    const x = useMotionValue(0);
    const controls = useAnimation();
    const [showAlert, setShowAlert] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnd = (event: Event, info: PanInfo) => {
        setIsDragging(false);
        if (info.offset.x < -100) {
            controls.start({ x: -80 });
        } else {
            controls.start({ x: 0 });
        }
    };

    const handleDeleteCheck = () => {
        setShowAlert(true);
    };

    const confirmDelete = () => {
        onDelete(wrestler.id);
        setShowAlert(false);
    };

    const cancelDelete = () => {
        setShowAlert(false);
        controls.start({ x: 0 });
    };

    return (
        <>
            <div className="relative mb-2 overflow-hidden">
                {/* Background (Delete Action) */}
                <div className="absolute inset-0 bg-[var(--crimson)] flex justify-end items-center pr-6 pointer-events-auto">
                    <button onClick={handleDeleteCheck} className="flex items-center gap-2 text-white font-[family-name:var(--font-dotgothic)] text-xs">
                        <Trash2 className="h-5 w-5" />
                        INTAI
                    </button>
                </div>

                {/* Foreground (Card) */}
                <motion.div
                    drag="x"
                    dragConstraints={{ left: -100, right: 0 }}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    animate={controls}
                    style={{ x, zIndex: 10, position: 'relative' }}
                >
                    <div className="relative">
                        <Link href={`/profiles/${wrestler.id}`} className="block" onClick={(e) => {
                            // Only prevent navigation if we've dragged significantly to reveal delete
                            if (x.get() < -10) e.preventDefault();
                        }}>
                            <Card className="gba-panel overflow-hidden active:scale-95 transition-transform">
                                <div className="flex h-full py-3 px-4 items-center gap-3">
                                    <div className="bg-black/30 p-1 border border-[var(--border)]">
                                        <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={40} className="shrink-0" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h3 className="font-[family-name:var(--font-dotgothic)] text-sm leading-none truncate" style={{ color: `rgb(${wrestler.color})` }}>
                                                    {(wrestler.custom_name || wrestler.name || "Unknown")?.toUpperCase()}
                                                </h3>
                                                <div className="flex gap-2 items-center text-[10px] text-muted-foreground mt-1">
                                                    <span>{wrestler.stable}-BEYA</span>
                                                    {wrestler.rank_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-[var(--gold)]">{wrestler.rank_name.toUpperCase()}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {wrestler.fighting_style && (
                                                    <div className="text-[9px] text-purple-400 font-[family-name:var(--font-dotgothic)] mt-0.5">
                                                        {wrestler.fighting_style.replace(/_/g, ' ').toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-3 shrink-0 ml-2">
                                                {/* Skill Points Badge */}
                                                {(wrestler.skill_points ?? 0) > 0 && (
                                                    <div className="text-center">
                                                        <div className="font-[family-name:var(--font-dotgothic)] text-sm leading-none text-[var(--jade)]">{wrestler.skill_points}</div>
                                                        <div className="text-[8px] text-muted-foreground tracking-wider">SP</div>
                                                    </div>
                                                )}
                                                {/* Wins Counter */}
                                                <div className="text-right">
                                                    <div className="font-[family-name:var(--font-dotgothic)] text-lg leading-none text-[var(--gold)]">{wrestler.wins}</div>
                                                    <div className="text-[8px] text-muted-foreground tracking-wider">WIN</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    </div>
                </motion.div>
            </div>

            <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
                <AlertDialogContent className="gba-panel border-2 text-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-[family-name:var(--font-dotgothic)] text-[var(--crimson)]">INTAI (引退)?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Retire {wrestler.custom_name || wrestler.name} from the dohyo? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelDelete} className="gba-panel text-foreground border-[var(--border)] hover:bg-[var(--muted)] font-[family-name:var(--font-dotgothic)] text-xs">
                            CANCEL
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-[var(--crimson)] hover:bg-[var(--crimson)]/80 font-[family-name:var(--font-dotgothic)] text-xs text-white">
                            RETIRE
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
