import Link from "next/link";
import { Card } from "@/components/ui/card";

// GBA-Style Pixel Art Trophy
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} shapeRendering="crispEdges">
      {/* Trophy cup body */}
      <rect x="7" y="4" width="10" height="8" fill="#FFD700" />
      <rect x="6" y="5" width="1" height="6" fill="#FFD700" />
      <rect x="17" y="5" width="1" height="6" fill="#FFD700" />
      {/* Trophy handles */}
      <rect x="4" y="5" width="2" height="4" fill="#FFD700" />
      <rect x="18" y="5" width="2" height="4" fill="#FFD700" />
      {/* Trophy stem */}
      <rect x="10" y="12" width="4" height="3" fill="#FFD700" />
      {/* Trophy base */}
      <rect x="8" y="15" width="8" height="2" fill="#FFD700" />
      <rect x="6" y="17" width="12" height="3" fill="#FFD700" />
      {/* Highlights */}
      <rect x="8" y="5" width="2" height="4" fill="#FFF8DC" />
      <rect x="7" y="16" width="2" height="1" fill="#FFF8DC" />
      {/* Shadows */}
      <rect x="14" y="5" width="2" height="6" fill="#DAA520" />
      <rect x="16" y="6" width="1" height="4" fill="#B8860B" />
      <rect x="12" y="17" width="5" height="2" fill="#B8860B" />
    </svg>
  );
}

// GBA-Style Gunbai (Referee Fan)
function GunbaiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} shapeRendering="crispEdges">
      {/* Fan paddle */}
      <rect x="6" y="3" width="12" height="10" rx="0" fill="#FFD700" />
      <rect x="5" y="4" width="1" height="8" fill="#FFD700" />
      <rect x="18" y="4" width="1" height="8" fill="#FFD700" />
      {/* Fan decoration */}
      <rect x="8" y="5" width="8" height="6" fill="#FFF8DC" />
      <rect x="11" y="6" width="2" height="4" fill="#DC143C" />
      {/* Handle */}
      <rect x="10" y="13" width="4" height="8" fill="#8B4513" />
      <rect x="10" y="15" width="4" height="2" fill="#A0522D" />
      <rect x="10" y="19" width="4" height="1" fill="#A0522D" />
      {/* Handle highlight */}
      <rect x="10" y="13" width="1" height="7" fill="#CD853F" />
    </svg>
  );
}

// GBA-Style Scroll (Banzuke)
function ScrollIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} shapeRendering="crispEdges">
      {/* Scroll body */}
      <rect x="6" y="4" width="12" height="16" fill="#F5F5DC" />
      {/* Top roll */}
      <rect x="4" y="3" width="16" height="3" fill="#DEB887" />
      <rect x="5" y="4" width="14" height="1" fill="#F5F5DC" />
      {/* Bottom roll */}
      <rect x="4" y="18" width="16" height="3" fill="#D2B48C" />
      <rect x="5" y="18" width="14" height="1" fill="#DEB887" />
      {/* Wooden handles */}
      <rect x="3" y="2" width="2" height="4" fill="#8B4513" />
      <rect x="19" y="2" width="2" height="4" fill="#8B4513" />
      <rect x="3" y="18" width="2" height="4" fill="#8B4513" />
      <rect x="19" y="18" width="2" height="4" fill="#8B4513" />
      {/* Writing lines */}
      <rect x="8" y="7" width="8" height="1" fill="#333" />
      <rect x="8" y="10" width="6" height="1" fill="#333" />
      <rect x="8" y="13" width="8" height="1" fill="#333" />
    </svg>
  );
}

// GBA-Style Eye (Watch/Spectate)
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} shapeRendering="crispEdges">
      {/* Eye outline */}
      <rect x="4" y="9" width="16" height="6" fill="#FFD700" />
      <rect x="6" y="7" width="12" height="2" fill="#FFD700" />
      <rect x="6" y="15" width="12" height="2" fill="#FFD700" />
      <rect x="8" y="6" width="8" height="1" fill="#FFD700" />
      <rect x="8" y="17" width="8" height="1" fill="#FFD700" />
      {/* Eye white */}
      <rect x="6" y="9" width="12" height="6" fill="#F5F5DC" />
      {/* Pupil */}
      <rect x="10" y="10" width="4" height="4" fill="#1a1428" />
      {/* Pupil highlight */}
      <rect x="11" y="11" width="1" height="1" fill="#FFF" />
      {/* Eyelid shadows */}
      <rect x="6" y="9" width="12" height="1" fill="#DEB887" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-between p-4 max-w-md mx-auto bg-[#1a1428]">
      {/* GBA-Style Top Border */}
      <div className="w-full h-2 bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] -mx-4 -mt-4 mb-2" />
      <div className="w-full h-1 bg-[#5D3A1A] -mx-4 mb-4" />

      {/* Title Section */}
      <div className="text-center py-4">
        <h1 className="font-[family-name:var(--font-dotgothic)] text-4xl text-[#FFD700] tracking-wider leading-none drop-shadow-[2px_2px_0_#000] [text-shadow:_2px_2px_0_#B8860B,_-1px_-1px_0_#000]">
          SUMO
        </h1>
        <h1 className="font-[family-name:var(--font-dotgothic)] text-4xl text-[#FFD700] tracking-wider leading-none mt-1 drop-shadow-[2px_2px_0_#000] [text-shadow:_2px_2px_0_#B8860B,_-1px_-1px_0_#000]">
          SMASH
        </h1>
        <p className="font-[family-name:var(--font-dotgothic)] text-[#87CEEB] text-xs mt-3 tracking-widest">
          大相撲スマッシュ
        </p>
      </div>

      {/* Center - GBA Style Dohyo Arena */}
      <div className="relative flex items-center justify-center my-4">
        {/* Outer ring border */}
        <div className="w-40 h-40 rounded-full bg-gradient-to-b from-[#CD853F] to-[#8B4513] p-1 flex items-center justify-center shadow-[0_4px_0_#5D3A1A,inset_0_2px_0_#DEB887]">
          {/* Inner dohyo */}
          <div className="w-full h-full rounded-full bg-[#D2B48C] flex flex-col items-center justify-center relative overflow-hidden">
            {/* Tatami lines */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, #8B7355 4px, #8B7355 5px)'
            }} />

            {/* Trophy - Centered */}
            <TrophyIcon className="w-16 h-16 relative z-10 drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]" />

            {/* BASHO Text - High Contrast */}
            <div className="relative z-10 mt-2 bg-[#1a1428] px-3 py-1">
              <span className="font-[family-name:var(--font-dotgothic)] text-sm text-[#FFD700] tracking-[0.2em] [text-shadow:_1px_1px_0_#000]">
                BASHO
              </span>
            </div>
          </div>
        </div>

        {/* Corner decorations - Salt piles */}
        <div className="absolute -top-1 -left-1 w-4 h-3 bg-gradient-to-t from-[#E8E4D9] to-[#F5F5F5] rounded-t-full shadow-[1px_1px_0_rgba(0,0,0,0.3)]" />
        <div className="absolute -top-1 -right-1 w-4 h-3 bg-gradient-to-t from-[#E8E4D9] to-[#F5F5F5] rounded-t-full shadow-[-1px_1px_0_rgba(0,0,0,0.3)]" />
        <div className="absolute -bottom-1 -left-1 w-4 h-3 bg-gradient-to-t from-[#E8E4D9] to-[#F5F5F5] rounded-t-full shadow-[1px_1px_0_rgba(0,0,0,0.3)]" />
        <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-gradient-to-t from-[#E8E4D9] to-[#F5F5F5] rounded-t-full shadow-[-1px_1px_0_rgba(0,0,0,0.3)]" />
      </div>

      {/* GBA-Style Menu Buttons */}
      <div className="grid gap-3 w-full pb-2">
        {/* TACHIAI Button */}
        <Link href="/controller">
          <div className="gba-menu-btn group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2a1f3d] border-2 border-[#3d2d5c] flex items-center justify-center shadow-[inset_2px_2px_0_#1a1428]">
                <GunbaiIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-dotgothic)] text-lg text-[#FFD700] tracking-wide [text-shadow:_1px_1px_0_#000]">
                  TACHIAI
                </h2>
                <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[#87CEEB]">
                  START MATCH
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* BANZUKE Button */}
        <Link href="/profiles">
          <div className="gba-menu-btn group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2a1f3d] border-2 border-[#3d2d5c] flex items-center justify-center shadow-[inset_2px_2px_0_#1a1428]">
                <ScrollIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-dotgothic)] text-lg text-[#50C878] tracking-wide [text-shadow:_1px_1px_0_#000]">
                  BANZUKE
                </h2>
                <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[#87CEEB]">
                  RANKINGS
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* WATCH VIEW Button */}
        <Link href="/watch">
          <div className="gba-menu-btn group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2a1f3d] border-2 border-[#3d2d5c] flex items-center justify-center shadow-[inset_2px_2px_0_#1a1428]">
                <EyeIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-dotgothic)] text-lg text-[#DC143C] tracking-wide [text-shadow:_1px_1px_0_#000]">
                  WATCH VIEW
                </h2>
                <p className="font-[family-name:var(--font-dotgothic)] text-[10px] text-[#87CEEB]">
                  SPECTATE MATCH
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* GBA-Style Bottom Border */}
      <div className="w-full h-1 bg-[#5D3A1A] -mx-4 mt-2" />
      <div className="w-full h-2 bg-gradient-to-r from-[#8B4513] via-[#CD853F] to-[#8B4513] -mx-4 -mb-4" />
    </main>
  );
}
