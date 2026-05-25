"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import VoiceFAB from "@/components/VoiceFAB";
import Atmosphere from "@/components/Atmosphere";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showFAB = pathname !== '/dashboard' && pathname !== '/chat';

  return (
    <div className="h-screen flex bg-background text-foreground font-sans relative overflow-hidden">
      <Atmosphere />
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
