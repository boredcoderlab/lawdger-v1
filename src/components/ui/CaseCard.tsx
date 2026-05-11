import React from "react";
import { ChevronRight, Calendar, Scale, Hash } from "lucide-react";

export interface CaseCardProps {
  title: string;
  caseNumber: string;
  status: "Active" | "Pending" | "Urgent" | "Closed";
  nextHearing: string;
  court: string;
}

export default function CaseCard({ title, caseNumber, status, nextHearing, court }: CaseCardProps) {
  // Dynamic styling for the status badge
  const statusStyles = {
    Active: "bg-lawdger-gold/10 text-[#B38D1D] border-lawdger-gold/30",
    Pending: "bg-[#8A8078]/10 text-[#8A8078] border-[#8A8078]/30",
    Urgent: "bg-destructive/10 text-destructive border-destructive/30",
    Closed: "bg-lawdger-espresso/5 text-lawdger-espresso/40 border-lawdger-espresso/10",
  };

  return (
    <div className="bg-white rounded-[1.5rem] border border-lawdger-espresso/10 p-6 flex flex-col relative overflow-hidden shadow-[0_8px_30px_rgba(44,36,32,0.04)] hover:shadow-[0_20px_50px_rgba(44,36,32,0.08)] hover:border-lawdger-gold/40 hover:-translate-y-1 transition-all duration-500 cursor-pointer group">
      
      {/* Top Row: Title & Badge */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <h3 className="font-serif text-2xl font-bold text-lawdger-espresso leading-tight line-clamp-2">
          {title}
        </h3>
        <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-full border shadow-sm shrink-0 mt-1 ${statusStyles[status]}`}>
          {status}
        </span>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[#8A8078] mb-1">
            <Hash size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Matter ID</span>
          </div>
          <span className="text-sm font-semibold text-lawdger-espresso">{caseNumber}</span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[#8A8078] mb-1">
            <Calendar size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Next Hearing</span>
          </div>
          <span className="text-sm font-semibold text-lawdger-espresso">{nextHearing}</span>
        </div>

        <div className="flex flex-col col-span-2">
          <div className="flex items-center gap-1.5 text-[#8A8078] mb-1">
            <Scale size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Forum / Court</span>
          </div>
          <span className="text-sm font-semibold text-lawdger-espresso truncate">{court}</span>
        </div>
      </div>

      {/* Footer Action Strip */}
      <div className="mt-auto pt-4 border-t border-lawdger-espresso/5 flex items-center justify-between">
        <span className="text-xs font-bold text-lawdger-espresso tracking-wide">Open Case File</span>
        <div className="w-8 h-8 rounded-full bg-lawdger-espresso/5 flex items-center justify-center group-hover:bg-lawdger-espresso transition-colors duration-300">
          <ChevronRight size={14} strokeWidth={3} className="text-lawdger-espresso group-hover:text-lawdger-base group-hover:translate-x-0.5 transition-all duration-300" />
        </div>
      </div>
      
    </div>
  );
}