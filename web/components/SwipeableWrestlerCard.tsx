"use client";

import { motion, useAnimation, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import { Wrestler } from "@/lib/api";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface Props {
    wrestler: Wrestler;
    onDelete: (id: number) => void;
}

export function SwipeableWrestlerCard({ wrestler, onDelete }: Props) {
    const x = useMotionValue(0);
    const controls = useAnimation();

    // Transform x into opacity/color for the background revealing
    const bgOpacity = useTransform(x, [0, -100], [0, 1]);

    const handleDragEnd = (event: Event, info: PanInfo) => {
        if (info.offset.x < -100) {
            // Snap open
            controls.start({ x: -80 });
        } else {
            // Snap back
            controls.start({ x: 0 });
        }
    };

    const handleDeleteClick = () => {
        // User already swiped, so this is the explicit click
        if (confirm(`Delete ${wrestler.custom_name || wrestler.name}?`)) {
            onDelete(wrestler.id);
        } else {
            controls.start({ x: 0 }); // Close
        }
    };

    return (
        <div className="relative mb-2 overflow-hidden rounded-lg">
            {/* Background (Delete Action) */}
            <div className="absolute inset-0 bg-red-900 flex justify-end items-center pr-6 rounded-lg pointer-events-auto">
                <button onClick={handleDeleteClick} className="flex items-center gap-2 text-white font-arcade text-xs">
                    <Trash2 className="h-5 w-5" />
                    DELETE
                </button>
            </div>

            {/* Foreground (Card) */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x, zIndex: 10, position: 'relative' }}
                className="bg-neutral-900"
            >
                <Link href={`/profiles/${wrestler.id}`}>
                    <Card className="bg-neutral-900 border-neutral-800 overflow-hidden hover:border-neutral-700 transition-colors rounded-lg">
                        <div className="flex h-full py-4 pr-4">
                            <div className="w-1.5 self-stretch mr-4 rounded-r" style={{ backgroundColor: `rgb(${wrestler.color})` }} />
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
            </motion.div>
        </div>
    );
}
