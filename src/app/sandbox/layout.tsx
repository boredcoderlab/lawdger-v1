import React from "react";
// Import your actual Lego Blocks!
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";

export default function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div 
      className="min-h-screen flex overflow-hidden font-sans selection:bg-[#D4AF37]/30" 
      style={{ backgroundColor: '#F5F2EC', color: '#2A2320' }}
    >
      {/* 1. GLOBAL SIDEBAR INJECTED HERE */}
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* 2. GLOBAL HEADER INJECTED HERE */}
        <Header />

        {/* 3. THE PAGE CONTENT GOES HERE */}
        {children}
      </main>
    </div>
  );
}