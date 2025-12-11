import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic"  // Keep same CSS variable for compatibility
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} ${pressStart.variable} antialiased min-h-[100dvh] overflow-x-hidden selection:bg-[var(--gold)] selection:text-black`}>
        {/* LCD Scanline Overlay - subtle GBA effect */}
        <div className="fixed inset-0 pointer-events-none z-50 lcd-overlay opacity-15" aria-hidden="true" />

        {/* Main Content */}
        {children}
      </body>
    </html>
  );
}
