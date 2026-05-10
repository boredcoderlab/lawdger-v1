"use client";

import React, { useState } from "react";
import PageActionHeader from "@/components/ui/PageActionHeader";
import TaskRow from "@/components/ui/TaskRow";
import { Folder, Search } from "lucide-react";

export default function SandboxPage() {
  const [activeMatter, setActiveMatter] = useState("reliance");

  return (
    <div className="flex-1 p-10 lg:p-14 overflow-y-hidden h-full flex flex-col">
      
      {/* ── THE TRUE PAGE CANVAS ── */}
      <div 
        className="w-full h-full rounded-[2.5rem] flex flex-col relative p-8 lg:p-10 overflow-hidden"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px rgba(44,36,32,0.03), inset 0 0 0 1px rgba(255,255,255,0.6)'
        }}
      >
        {/* We reuse the header, but in a real app you'd pass "Tasks" as a prop */}
        <div className="shrink-0">
            <PageActionHeader />
        </div>

        {/* ── SPLIT PANE ARCHITECTURE ── */}
        <div className="flex-1 flex overflow-hidden border-t border-[#2C2420]/10 pt-6 mt-[-1rem]">
            
            {/* LEFT PANE: MATTER FOLDERS (1/3 Width) */}
            <div className="w-[35%] border-r border-[#2C2420]/10 pr-6 flex flex-col h-full">
                
                {/* Local Search */}
                <div className="relative group mb-6 shrink-0">
                    <Search className="absolute left-3 top-2.5 text-[#2C2420]/40 group-focus-within:text-[#2C2420] transition-colors" size={14} />
                    <input
                        type="text"
                        placeholder="Filter matters..."
                        className="bg-white/50 border border-[#2C2420]/10 rounded-xl py-2 pl-9 pr-4 w-full text-xs font-medium focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]/50 transition-all outline-none placeholder:text-[#2C2420]/40"
                    />
                </div>

                {/* Folder List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 pb-10">
                    <MatterFolder 
                        title="Reliance vs. Future Retail" 
                        count={4} 
                        isActive={activeMatter === "reliance"} 
                        onClick={() => setActiveMatter("reliance")} 
                    />
                    <MatterFolder 
                        title="Sharma Associates Dissolution" 
                        count={2} 
                        isActive={activeMatter === "sharma"} 
                        onClick={() => setActiveMatter("sharma")} 
                    />
                    <MatterFolder 
                        title="TechCorp IP Infringement" 
                        count={7} 
                        isActive={activeMatter === "techcorp"} 
                        onClick={() => setActiveMatter("techcorp")} 
                    />
                    <MatterFolder 
                        title="State Bank vs. Aggarwal" 
                        count={0} 
                        isActive={activeMatter === "sbi"} 
                        onClick={() => setActiveMatter("sbi")} 
                    />
                </div>
            </div>

            {/* RIGHT PANE: TASK ROWS (2/3 Width) */}
            <div className="flex-1 pl-8 flex flex-col h-full overflow-y-auto pb-10 pr-4">
                
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <h3 className="font-serif text-2xl font-bold text-[#2C2420]">Active Tasks</h3>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full">
                        {activeMatter === "reliance" ? "4 Remaining" : "2 Remaining"}
                    </span>
                </div>

                {/* Task Groups */}
                <div className="space-y-8">
                    {/* Group: Today */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8078] mb-3 ml-2 border-b border-[#2C2420]/5 pb-2">Due Today</h4>
                        <div className="space-y-1">
                            <TaskRow 
                                title="Draft counter-affidavit for High Court"
                                matter="Reliance vs. Future Retail"
                                dueDate="Today, 2:00 PM"
                                urgency="Today"
                            />
                            <TaskRow 
                                title="Review final settlement terms"
                                matter="Reliance vs. Future Retail"
                                dueDate="Today, 5:00 PM"
                                urgency="Today"
                            />
                        </div>
                    </div>

                    {/* Group: Upcoming */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8078] mb-3 ml-2 border-b border-[#2C2420]/5 pb-2">Upcoming</h4>
                        <div className="space-y-1">
                            <TaskRow 
                                title="Schedule prep meeting with expert witness"
                                matter="Reliance vs. Future Retail"
                                dueDate="Oct 26"
                                urgency="Upcoming"
                            />
                            <TaskRow 
                                title="Compile evidence annexures"
                                matter="Reliance vs. Future Retail"
                                dueDate="Oct 28"
                                urgency="Upcoming"
                            />
                        </div>
                    </div>
                </div>

            </div>

        </div>
      </div>
    </div>
  );
}

// Sub-component for the Left Pane Folders
function MatterFolder({ title, count, isActive, onClick }: { title: string, count: number, isActive: boolean, onClick: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                isActive 
                    ? "bg-white border-[#2C2420]/10 shadow-[0_4px_12px_rgba(44,36,32,0.05)]" 
                    : "border-transparent hover:bg-white/50 hover:border-[#2C2420]/5"
            }`}
        >
            <div className="flex items-center gap-3 truncate pr-4">
                <div className={`p-2 rounded-lg transition-colors ${isActive ? "bg-[#2C2420]/5 text-[#2C2420]" : "bg-transparent text-[#8A8078]"}`}>
                    <Folder size={16} fill={isActive ? "currentColor" : "none"} />
                </div>
                <span className={`text-sm font-bold truncate transition-colors ${isActive ? "text-[#2C2420]" : "text-[#8A8078]"}`}>
                    {title}
                </span>
            </div>
            {count > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors ${
                    isActive ? "bg-[#E05243] text-white shadow-sm" : "bg-[#2C2420]/10 text-[#2C2420]/60"
                }`}>
                    {count}
                </span>
            )}
        </div>
    );
}