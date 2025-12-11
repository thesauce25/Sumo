import { useMemo } from 'react';

interface Props {
    seed?: number;
    color: string;
    size?: number;
    className?: string;
}

// 32-bit GBA-quality avatar with enhanced detail
const SHADOW_DARK = "rgba(0,0,0,0.35)";
const SHADOW_MED = "rgba(0,0,0,0.2)";
const HIGHLIGHT = "rgba(255,255,255,0.25)";

export function PixelSumo({ seed = 0, color, size = 64, className }: Props) {
    const seededRandom = (s: number) => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };

    const art = useMemo(() => {
        const rng = (offset: number) => seededRandom(seed + offset);

        // === TRAITS ===
        const skinTones = ["#FFD5B8", "#E8B896", "#C69C6D", "#A67B5B", "#FFE0C0"];
        const skinBase = skinTones[Math.floor(rng(0) * skinTones.length)];

        const hairStyles = ["TOPKNOT", "WILD", "BALD", "OICHO", "SAMURAI"];
        const hairType = hairStyles[Math.floor(rng(1) * hairStyles.length)];

        const bodyBuild = 0.5 + rng(2) * 0.5; // 0.5 to 1.0 (bulkiness)

        // === 32x32 PIXEL GRID ===
        // 0=transparent, 1=skin, 2=skin_shadow, 3=skin_highlight
        // 10=belt, 11=belt_shadow, 12=belt_highlight
        // 20=hair_dark, 21=hair_light
        // 30=eye_white, 31=pupil
        const grid: number[][] = Array(32).fill(0).map(() => Array(32).fill(0));

        const rect = (x: number, y: number, w: number, h: number, v: number) => {
            for (let i = Math.floor(x); i < Math.floor(x + w); i++)
                for (let j = Math.floor(y); j < Math.floor(y + h); j++)
                    if (i >= 0 && i < 32 && j >= 0 && j < 32) grid[j][i] = v;
        };

        // === BODY (Enhanced for 32-bit) ===
        const centerX = 16;
        const torsoWidth = Math.floor(12 + bodyBuild * 6); // 12-18 px
        const torsoX = centerX - Math.floor(torsoWidth / 2);

        // Legs/Thighs
        rect(torsoX + 1, 22, Math.floor(torsoWidth / 2) - 2, 8, 1);
        rect(torsoX + Math.floor(torsoWidth / 2) + 1, 22, Math.floor(torsoWidth / 2) - 2, 8, 1);

        // Torso body (rounder belly)
        rect(torsoX, 10, torsoWidth, 14, 1);

        // Rounded shoulders
        rect(torsoX - 1, 11, 1, 12, 1);
        rect(torsoX + torsoWidth, 11, 1, 12, 1);

        // Chest definition (pectoral shadows)
        rect(centerX - 4, 13, 3, 1, 2);
        rect(centerX + 1, 13, 3, 1, 2);

        // Belly button
        rect(centerX, 18, 1, 1, 2);

        // Belly curvature shadow
        rect(torsoX + 1, 20, torsoWidth - 2, 1, 2);

        // === HEAD (Larger for 32-bit) ===
        const headWidth = 10;
        const headX = centerX - 5;

        // Main head
        rect(headX, 4, headWidth, 7, 1);

        // Jaw (rounder)
        rect(headX + 1, 11, headWidth - 2, 1, 1);
        rect(headX + 2, 12, headWidth - 4, 1, 1);

        // Cheeks (rounded)
        rect(headX - 1, 6, 1, 4, 1);
        rect(headX + headWidth, 6, 1, 4, 1);

        // === FACE ===
        // Eyes (larger, more expressive)
        rect(headX + 2, 7, 2, 2, 30);  // Left white
        rect(headX + 3, 7, 1, 2, 31);  // Left pupil
        rect(headX + 6, 7, 2, 2, 30);  // Right white
        rect(headX + 6, 7, 1, 2, 31);  // Right pupil

        // Eyebrows (thicker)
        rect(headX + 1, 6, 3, 1, 20);
        rect(headX + 6, 6, 3, 1, 20);

        // Nose shadow
        rect(centerX - 1, 9, 2, 2, 2);

        // Subtle mouth
        rect(centerX - 1, 11, 2, 1, 2);

        // === HAIR STYLES ===
        if (hairType === "BALD") {
            // Sideburns only
            rect(headX, 6, 1, 3, 20);
            rect(headX + headWidth - 1, 6, 1, 3, 20);
            // Shine on bald head
            rect(headX + 3, 4, 2, 1, 3);
        } else if (hairType === "TOPKNOT") {
            // Traditional topknot (mage)
            rect(headX, 3, headWidth, 2, 20);
            rect(centerX - 1, 1, 3, 2, 20);  // Knot
            rect(centerX, 0, 1, 1, 20);       // Top of knot
            rect(headX, 4, 1, 4, 20);         // Side
            rect(headX + headWidth - 1, 4, 1, 4, 20);
        } else if (hairType === "WILD") {
            // Unruly hair
            rect(headX - 1, 1, headWidth + 2, 4, 20);
            rect(headX - 2, 3, 1, 5, 20);
            rect(headX + headWidth + 1, 3, 1, 5, 20);
            // Spiky bits
            rect(headX + 2, 0, 1, 2, 20);
            rect(headX + 7, 0, 1, 2, 20);
        } else if (hairType === "OICHO") {
            // Traditional sumo oicho-mage (ginkgo leaf shape)
            rect(headX, 2, headWidth, 3, 20);
            rect(centerX - 2, 0, 4, 3, 20);   // Fan top
            rect(centerX - 1, -1, 2, 1, 20);   // Peak
            rect(headX - 1, 4, 1, 4, 20);
            rect(headX + headWidth, 4, 1, 4, 20);
        } else if (hairType === "SAMURAI") {
            // Slicked back with knot
            rect(headX + 1, 2, headWidth - 2, 2, 20);
            rect(centerX, 1, 1, 2, 20);      // Small knot
            rect(headX - 1, 4, 1, 5, 20);    // Long sides
            rect(headX + headWidth, 4, 1, 5, 20);
        }

        // === MAWASHI (Belt) - Enhanced ===
        const beltY = 18;
        rect(torsoX - 1, beltY, torsoWidth + 2, 5, 10);

        // Belt knot hanging down
        rect(centerX - 2, beltY + 1, 4, 7, 10);
        rect(centerX - 1, beltY + 7, 2, 2, 10);

        // Belt shading
        rect(torsoX - 1, beltY + 4, torsoWidth + 2, 1, 11);
        rect(centerX - 2, beltY + 6, 4, 1, 11);

        // Belt highlight
        rect(torsoX, beltY, torsoWidth, 1, 12);

        // === ARMS (More detailed) ===
        // Left arm
        rect(torsoX - 4, 11, 4, 9, 1);
        rect(torsoX - 4, 19, 3, 2, 1); // Hand
        rect(torsoX - 4, 11, 1, 8, 3); // Highlight

        // Right arm
        rect(torsoX + torsoWidth, 11, 4, 9, 1);
        rect(torsoX + torsoWidth + 1, 19, 3, 2, 1); // Hand
        rect(torsoX + torsoWidth + 3, 11, 1, 8, 2); // Shadow

        // === LIGHTING (Top-left light source) ===
        // Right side body shadow
        rect(torsoX + torsoWidth - 2, 11, 2, 11, 2);

        // Left side highlight
        rect(torsoX, 11, 2, 8, 3);

        // Head shine
        rect(headX + 2, 4, 2, 2, 3);

        // Under-chin shadow
        rect(headX + 1, 12, headWidth - 2, 1, 2);

        return { grid, skinBase };
    }, [seed]);

    // Render SVG with crisp pixels
    return (
        <svg
            viewBox="0 0 32 32"
            width={size}
            height={size}
            className={className}
            shapeRendering="crispEdges"
        >
            {art.grid.map((row, y) => row.map((val, x) => {
                if (val === 0) return null;

                let fill = "transparent";

                // Skin
                if (val === 1) fill = art.skinBase;
                if (val === 2) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={art.skinBase} overlay={SHADOW_MED} />;
                if (val === 3) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={art.skinBase} overlay={HIGHLIGHT} />;

                // Belt
                if (val === 10) fill = `rgb(${color})`;
                if (val === 11) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={`rgb(${color})`} overlay={SHADOW_DARK} />;
                if (val === 12) return <PixelStack key={`${x}-${y}`} x={x} y={y} base={`rgb(${color})`} overlay={HIGHLIGHT} />;

                // Hair
                if (val === 20) fill = "#1a1a1a";
                if (val === 21) fill = "#3a3a3a";

                // Face
                if (val === 30) fill = "#ffffff";
                if (val === 31) fill = "#000000";

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
    );
}
