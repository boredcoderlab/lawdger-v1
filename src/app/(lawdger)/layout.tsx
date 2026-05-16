"use client";

import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import VoiceFAB from "@/components/VoiceFAB";

export default function LawdgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex bg-background text-foreground font-sans relative overflow-hidden">
      {/* Global Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03] dark:opacity-10 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}></div>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden z-10">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <VoiceFAB />
    </div>
  );
}
