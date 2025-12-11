import Link from "next/link";
import { Swords, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-8 max-w-md mx-auto">
      <div className="text-center space-y-4">
        <h1 className="font-arcade text-4xl text-yellow-400 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] leading-tight">
          SUMO<br />SMASH
        </h1>
        <p className="text-neutral-400 font-sans tracking-wide">OFFICIAL COMPANION APP</p>
      </div>

      <div className="grid gap-4 w-full">
        <Link href="/controller">
          <Card className="p-6 bg-neutral-900 border-neutral-700 hover:border-orange-500 transition-colors group cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-orange-500/20 rounded-none border border-orange-500/50">
                <Swords className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h2 className="font-arcade text-xl text-white">CONTROLLER</h2>
                <p className="text-sm text-neutral-400">Start new match</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/profiles">
          <Card className="p-6 bg-neutral-900 border-neutral-700 hover:border-blue-500 transition-colors group cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-blue-500/20 rounded-none border border-blue-500/50">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <h2 className="font-arcade text-xl text-white">SUMOVERSE</h2>
                <p className="text-sm text-neutral-400">Wrestlers & Stables</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </main>
  );
}
