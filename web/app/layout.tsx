import type { Metadata } from "next";
import { Inter, DotGothic16 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic"
});

export const metadata: Metadata = {
  title: "SUMO SMASH | 大相撲スマッシュ",
  description: "The Official Sumo Smash Championship Companion App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${dotGothic.variable} antialiased min-h-[100dvh] overflow-x-hidden selection:bg-[var(--gold)] selection:text-black`}>
        {/* LCD Scanline Overlay - subtle GBA effect */}
        <div className="fixed inset-0 pointer-events-none z-50 lcd-overlay opacity-15" aria-hidden="true" />

        {/* Main Content */}
        {children}
      </body>
    </html>
  );
}
