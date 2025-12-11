import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-arcade"
});

export const metadata: Metadata = {
  title: "SUMO SMASH CHAMPIONSHIP",
  description: "The Official Sumo Smash Companion App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${pressStart.variable} bg-neutral-950 text-neutral-50 antialiased min-h-screen selection:bg-orange-500 selection:text-white overflow-x-hidden`}>
        <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />
        {children}
      </body>
    </html>
  );
}
