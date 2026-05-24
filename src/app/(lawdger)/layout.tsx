"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import VoiceFAB from "@/components/VoiceFAB";

export default function LawdgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showFAB = pathname !== '/dashboard' && pathname !== '/chat';

  return (
    <div className="h-screen flex bg-background text-foreground font-sans relative overflow-hidden">
      {/* Global Background Ambience — Phase 4c-3a.
          Dark-only: warm radial glow + film grain + vignette painted via
          .app-atmosphere pseudo-elements in globals.css. Light mode = no-op. */}
      <div className="app-atmosphere absolute inset-0 pointer-events-none z-0" aria-hidden="true" />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden z-10">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      {showFAB && <VoiceFAB />}
    </div>
  );
}
