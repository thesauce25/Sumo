import { useMemo } from 'react';

interface Props {
    seed?: number;
    color: string;
    size?: number;
    className?: string;
}

// Helper to darken/lighten hex/rgb would be nice, but we'll stick to simple logic or opacity layers
const SHADOW_LAYER = "rgba(0,0,0,0.2)";
const HIGHLIGHT_LAYER = "rgba(255,255,255,0.2)";

export function PixelSumo({ seed = 0, color, size = 64, className }: Props) {
    // Deterministic random helpers
    const seededRandom = (s: number) => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };

    const art = useMemo(() => {
        const rng = (offset: number) => seededRandom(seed + offset);

        // --- TRAITS ---
        const skinTones = ["#FFD0B0", "#E0AC69", "#8D5524", "#FFC3A0"];
        const skinBase = skinTones[Math.floor(rng(0) * skinTones.length)];

        const hairStyles = ["TOPKNOT", "WILD", "BALD", "SAMURAI"];
        const hairType = hairStyles[Math.floor(rng(1) * hairStyles.length)];

        const bodyFat = rng(2); // 0.0 to 1.0

        // --- PIXEL GRID (24x24) ---
        // 0=trans, 1=skin, 2=skin_shadow, 3=skin_highlight
        // 10=belt, 11=belt_shadow, 12=belt_highlight
        // 20=hair, 21=hair_highlight
        // 30=white (eyes), 31=pupil
        const grid: number[][] = Array(24).fill(0).map(() => Array(24).fill(0));

        // Draw helper
        const rect = (x: number, y: number, w: number, h: number, v: number) => {
            for (let i = Math.floor(x); i < Math.floor(x + w); i++)
                for (let j = Math.floor(y); j < Math.floor(y + h); j++)
                    if (i >= 0 && i < 24 && j >= 0 && j < 24) grid[j][i] = v;
        }

        // --- BODY SHAPE ---
        const cx = 12;
        const wTorso = 10 + Math.floor(bodyFat * 6); // 10 to 16 pixels wide
        const xTorso = cx - Math.floor(wTorso / 2);

        // Legs (Thighs)
        rect(xTorso, 16, Math.floor(wTorso / 2) - 1, 6, 1);
        rect(xTorso + Math.floor(wTorso / 2) + 1, 16, Math.floor(wTorso / 2) - 1, 6, 1);

        // Torso Body
        rect(xTorso, 8, wTorso, 10, 1);
        // Round the shoulders
        rect(xTorso - 1, 9, 1, 8, 1);
        rect(xTorso + wTorso, 9, 1, 8, 1);

        // Chest/Pecs shading
        rect(cx - 3, 10, 2, 1, 2); // Shadow line
        rect(cx + 1, 10, 2, 1, 2);

        // Belly Button / Abs hint
        rect(cx, 13, 1, 1, 2);

        // --- HEAD ---
        const wHead = 8;
        const xHead = cx - 4;
        rect(xHead, 4, wHead, 5, 1);
        // Jaw rounding
        rect(xHead + 1, 9, 6, 1, 1);

        // --- FACE ---
        // Eyes
        rect(xHead + 1, 6, 2, 1, 30); // White
        rect(xHead + 2, 6, 1, 1, 31); // Pupil
        rect(xHead + 5, 6, 2, 1, 30); // White
        rect(xHead + 5, 6, 1, 1, 31); // Pupil

        // Eyebrows
        rect(xHead + 1, 5, 2, 1, 20);
        rect(xHead + 5, 5, 2, 1, 20);

        // Cheeks/Nose
        rect(cx - 1, 7, 2, 1, 2); // Nose shadow

        // --- HAIR ---
        if (hairType === "BALD") {
            // maybe sideburns
            rect(xHead, 5, 1, 2, 20);
            rect(xHead + 7, 5, 1, 2, 20);
        } else if (hairType === "TOPKNOT") {
            rect(xHead, 3, 8, 2, 20); // Top
            rect(cx - 1, 1, 2, 2, 20); // Oicho
            rect(xHead, 4, 1, 3, 20); // Sides
            rect(xHead + 7, 4, 1, 3, 20);
        } else if (hairType === "WILD") {
            rect(xHead - 1, 2, 10, 3, 20);
            rect(xHead - 1, 3, 1, 5, 20);
            rect(xHead + 8, 3, 1, 5, 20);
        } else if (hairType === "SAMURAI") {
            rect(xHead + 1, 2, 6, 2, 20);
            rect(cx, 1, 1, 1, 20); // Knot
            rect(xHead - 1, 4, 1, 4, 20); // Long sides
            rect(xHead + 8, 4, 1, 4, 20);
        }

        // --- BELT (Mawashi) ---
        const beltY = 14;
        rect(xTorso - 1, beltY, wTorso + 2, 3, 10);
        // Knot / Tsuna
        rect(cx - 1, beltY + 1, 2, 4, 10); // Hang down

        // Belt Shading
        rect(xTorso - 1, beltY + 2, wTorso + 2, 1, 11); // Bottom shadow

        // --- ARMS ---
        // Left
        rect(xTorso - 3, 9, 3, 6, 1);
        rect(xTorso - 3, 14, 2, 1, 1); // Hand
        // Right
        rect(xTorso + wTorso, 9, 3, 6, 1);
        rect(xTorso + wTorso + 1, 14, 2, 1, 1); // Hand

        // --- GENERAL SHADING (Light source top-left) ---
        // Right side of body gets shadow
        rect(xTorso + wTorso - 1, 9, 1, 8, 2);

        // Left side gets highlight
        rect(xTorso, 9, 1, 5, 3);
        rect(xHead + 1, 4, 1, 2, 3); // Head Shine

        return { grid, skinBase };
    }, [seed]);

    // Render SVG
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            shapeRendering="crispEdges" // Keeps pixel art look even at high res
        >
            {art.grid.map((row, y) => row.map((val, x) => {
                if (val === 0) return null;

                let fill = "transparent";

                // Skin
                if (val === 1) fill = art.skinBase;
                if (val === 2) fill = SHADOW_LAYER; // Overlay shadow
                if (val === 3) fill = HIGHLIGHT_LAYER; // Overlay highlight

                // Belt
                if (val === 10) fill = `rgb(${color})`;
                if (val === 11) fill = "rgba(0,0,0,0.3)"; // Belt shadow
                if (val === 12) fill = "rgba(255,255,255,0.3)";

                // Hair
                if (val === 20) fill = "#1a1a1a";
                if (val === 21) fill = "#404040";

                // Face
                if (val === 30) fill = "#ffffff";
                if (val === 31) fill = "#000000";

                // Compositing: If it's a shadow/highlight, we render the base FIRST then the overlay?
                // Actually with SVG we can just render squares. 
                // BUT, my logic above put "2" pixels REPLACING "1" pixels logic. 
                // So "2" needs to be SkinBase w/ Shadow.

                // Let's refine the render logic for overlays
                if (val === 2) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={art.skinBase} overlay={SHADOW_LAYER} />
                if (val === 3) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={art.skinBase} overlay={HIGHLIGHT_LAYER} />
                if (val === 11) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={`rgb(${color})`} overlay="rgba(0,0,0,0.3)" />

                return (
                    <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
                );
            }))}
        </svg>
    );
}

function PixelStack({ x, y, base, overlay }: { x: number, y: number, base: string, overlay: string }) {
    return (
        <>
            <rect x={x} y={y} width={1} height={1} fill={base} />
            <rect x={x} y={y} width={1} height={1} fill={overlay} />
        </>
    )
}
