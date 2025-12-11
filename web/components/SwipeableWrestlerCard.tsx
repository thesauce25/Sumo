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
    onDelete: (id: number) => void;
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
                    <div onClick={(e) => { if (isDragging) e.preventDefault(); }}>
                        <Link href={`/profiles/${wrestler.id}`} onClick={(e) => { if (x.get() < -10) e.preventDefault(); }}>
                            <Card className="gba-panel overflow-hidden">
                                <div className="flex h-full py-3 px-4 items-center gap-3">
                                    <div className="bg-black/30 p-1 border border-[var(--border)]">
                                        <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={40} className="shrink-0" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h3 className="font-[family-name:var(--font-dotgothic)] text-sm leading-none truncate" style={{ color: `rgb(${wrestler.color})` }}>
                                                    {wrestler.custom_name ? wrestler.custom_name.toUpperCase() : wrestler.name.toUpperCase()}
                                                </h3>
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    {wrestler.stable}-BEYA
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <div className="font-[family-name:var(--font-dotgothic)] text-lg leading-none text-[var(--gold)]">{wrestler.wins}</div>
                                                <div className="text-[8px] text-muted-foreground tracking-wider">勝</div>
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
