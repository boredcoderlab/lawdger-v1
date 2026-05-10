"use client";

import React, { useState } from "react";
import { 
  Search, Bell, Briefcase, Receipt, Calendar as CalIcon, CheckCircle2,
  ChevronDown, Wallet, MessageSquare, ChevronRight
} from "lucide-react";

export default function Header() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-10 py-5 border-b border-[#2C2420]/5 relative z-30 bg-[#F4EFE6]/70 backdrop-blur-3xl">
        <div className="flex items-center gap-8">
            <div className="flex flex-col">
                <h1 className="font-serif text-3xl text-[#2C2420] tracking-tight leading-none">Web Dashboard</h1>
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[#2C2420]/40 mt-1.5">Verified Session</span>
            </div>

            <nav className="flex items-center gap-1.5 p-1 bg-white/40 border border-white/80 rounded-[14px] shadow-sm">
                <ModeLink label="Finance" icon={<Wallet size={14}/>} />
                <ModeLink label="Legal Brain AI" icon={<MessageSquare size={14}/>} isNew />
            </nav>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="relative group">
                <Search className="absolute left-4 top-2.5 text-[#2C2420]/40 group-focus-within:text-[#2C2420] transition-colors" size={16} />
                <input type="text" placeholder="Search cases or filings..." className="bg-white/50 border border-[#2C2420]/10 rounded-full py-2 pl-10 pr-5 w-60 text-xs font-medium focus:ring-2 focus:ring-[#2C2420]/5 transition-all outline-none placeholder:text-[#2C2420]/40" />
            </div>

            <div className="p-2.5 bg-white/50 rounded-full border border-white/80 text-[#2C2420] cursor-pointer hover:scale-110 transition-all relative group shadow-sm">
                <Bell size={18} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#E05243] rounded-full border-2 border-[#F4EFE6] shadow-[0_0_10px_rgba(224,82,67,0.4)]"></span>
            </div>

            <div className="relative">
                <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="flex items-center gap-2 bg-[#2C2420] text-[#F4EFE6] pl-5 pr-3 py-2.5 rounded-full font-bold shadow-md hover:bg-[#1A1512] transition-all border border-white/10">
                    <span className="text-xs tracking-wide">Quick Add</span>
                    <ChevronDown size={14} className={`transition-transform duration-500 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAddMenuOpen && (
                    <div className="absolute top-12 right-0 w-64 bg-[#F4EFE6]/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <QuickAddItem icon={<Briefcase size={16}/>} label="New Case Matter" description="Create foundation" />
                        <QuickAddItem icon={<Receipt size={16}/>} label="Finance Entry" description="Log fees & invoices" />
                        <QuickAddItem icon={<CalIcon size={16}/>} label="Schedule Hearing" description="Pin a new court date" />
                        <QuickAddItem icon={<CheckCircle2 size={16}/>} label="Create New Task" description="Add actionable to-dos" />
                    </div>
                )}
            </div>
        </div>
    </header>
  );
}

function ModeLink({ label, icon, isNew = false }: { label: string, icon: React.ReactNode, isNew?: boolean }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] cursor-pointer transition-all duration-300 group relative overflow-hidden">
            <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 text-[#2C2420]/40 group-hover:text-[#2C2420] transition-colors duration-300">{icon}</span>
            <span className="relative z-10 text-xs font-bold tracking-tight text-[#2C2420]/60 group-hover:text-[#2C2420] transition-colors duration-300">{label}</span>
            {isNew && <span className="relative z-10 ml-1 bg-gradient-to-tr from-[#D4AF37] to-[#B38D1D] text-[7px] font-black text-white px-1.5 py-0.5 rounded-sm shadow-sm border border-white/40">AI</span>}
        </div>
    );
}

function QuickAddItem({ icon, label, description }: { icon: React.ReactNode, label: string, description: string }) {
    return (
        <div className="flex items-center gap-3 p-2.5 hover:bg-white/60 rounded-xl transition-all cursor-pointer group">
            <div className="p-2 bg-[#2C2420]/5 text-[#2C2420] group-hover:bg-[#2C2420] group-hover:text-[#F4EFE6] rounded-lg transition-all shadow-sm">{icon}</div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-[#2C2420] tracking-tight">{label}</span>
                <span className="text-[9px] text-[#8A8078] font-medium leading-tight mt-0.5">{description}</span>
            </div>
            <ChevronRight size={12} className="ml-auto text-[#2C2420]/20 group-hover:translate-x-1 group-hover:text-[#2C2420] transition-all" />
        </div>
    );
}