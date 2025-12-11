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

    // We toggle this to prevent the Link click when we are just dragging/swiping
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnd = (event: Event, info: PanInfo) => {
        setIsDragging(false);
        if (info.offset.x < -100) {
            // Snap open
            controls.start({ x: -80 });
        } else {
            // Snap back
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
        controls.start({ x: 0 }); // Close the swipe
    };

    return (
        <>
            <div className="relative mb-2 overflow-hidden rounded-lg">
                {/* Background (Delete Action) */}
                <div className="absolute inset-0 bg-red-900 flex justify-end items-center pr-6 rounded-lg pointer-events-auto">
                    <button onClick={handleDeleteCheck} className="flex items-center gap-2 text-white font-arcade text-xs">
                        <Trash2 className="h-5 w-5" />
                        DELETE
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
                    className="bg-neutral-900"
                >
                    <div onClick={(e) => { if (isDragging) e.preventDefault(); }}>
                        <Link href={`/profiles/${wrestler.id}`} onClick={(e) => { if (x.get() < -10) e.preventDefault(); }}>
                            <Card className="bg-neutral-900 border-neutral-800 overflow-hidden hover:border-neutral-700 transition-colors rounded-lg">
                                <div className="flex h-full py-4 pr-4 pl-4 items-center gap-4">
                                    <PixelSumo seed={wrestler.avatar_seed} color={wrestler.color} size={48} className="shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-arcade text-sm leading-none mb-1" style={{ color: `rgb(${wrestler.color})` }}>
                                                    {wrestler.custom_name ? wrestler.custom_name.toUpperCase() : wrestler.name.toUpperCase()}
                                                </h3>
                                                {wrestler.custom_name && (
                                                    <div className="text-[10px] text-neutral-500 font-bold">({wrestler.name})</div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-arcade text-lg leading-none text-white">{wrestler.wins}</div>
                                                <div className="text-[8px] text-neutral-600 tracking-wider">WINS</div>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex gap-3 text-[10px] text-neutral-500 font-mono">
                                            <div className="bg-neutral-800/50 px-1.5 py-0.5 rounded">
                                                H:{wrestler.height}cm
                                            </div>
                                            <div className="bg-neutral-800/50 px-1.5 py-0.5 rounded">
                                                W:{wrestler.weight}kg
                                            </div>
                                            <div className="bg-neutral-800/50 px-1.5 py-0.5 rounded">
                                                {wrestler.matches} BOUTS
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
                <AlertDialogContent className="bg-neutral-900 border-neutral-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-arcade text-red-500">RETIRE WRESTLER?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            Are you sure you want to delete {wrestler.custom_name || wrestler.name}? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelDelete} className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700 hover:text-white font-arcade text-xs">CANCEL</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 font-arcade text-xs text-white">DELETE</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
