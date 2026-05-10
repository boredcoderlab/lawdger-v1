"use client";

import React, { useState } from "react";
import { Check, Clock, MoreHorizontal, Briefcase } from "lucide-react";

export interface TaskRowProps {
  title: string;
  matter: string;
  dueDate: string;
  urgency: "Overdue" | "Today" | "Upcoming";
  defaultCompleted?: boolean;
}

export default function TaskRow({ title, matter, dueDate, urgency, defaultCompleted = false }: TaskRowProps) {
  const [isCompleted, setIsCompleted] = useState(defaultCompleted);

  // Dynamic styling based on how urgent the task is
  const urgencyStyles = {
    Overdue: "text-[#E05243] bg-[#E05243]/10",
    Today: "text-[#D4AF37] bg-[#D4AF37]/10",
    Upcoming: "text-[#8A8078] bg-[#2C2420]/5",
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border border-transparent transition-all duration-300 group cursor-pointer ${
      isCompleted 
        ? "opacity-50 hover:opacity-100" 
        : "hover:bg-white hover:border-[#2C2420]/10 hover:shadow-[0_8px_20px_rgba(44,36,32,0.03)]"
    }`}>
      
      {/* 1. Custom Interactive Checkbox */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setIsCompleted(!isCompleted);
        }}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
          isCompleted 
            ? "bg-[#2C2420] border-[#2C2420]" 
            : "border-[#2C2420]/20 group-hover:border-[#D4AF37]"
        }`}
      >
        <Check size={14} strokeWidth={3} className={`transition-all duration-300 ${isCompleted ? "text-white scale-100" : "text-transparent scale-50"}`} />
      </div>

      {/* 2. Core Data (Title & Matter Context) */}
      <div className="flex flex-col flex-1 min-w-0">
        <h4 className={`text-sm font-bold text-[#2C2420] truncate transition-all duration-300 ${isCompleted ? "line-through text-[#8A8078]" : ""}`}>
          {title}
        </h4>
        <div className="flex items-center gap-1.5 mt-1">
          <Briefcase size={12} className="text-[#8A8078]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8078] truncate">
            {matter}
          </span>
        </div>
      </div>

      {/* 3. Due Date Pill */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 ${urgencyStyles[urgency]}`}>
        <Clock size={12} strokeWidth={2.5} />
        <span className="text-[10px] font-black uppercase tracking-wider">
          {dueDate}
        </span>
      </div>

      {/* 4. Action Menu (Reveals on Hover) */}
      <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A8078] hover:bg-[#2C2420]/5 hover:text-[#2C2420] transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <MoreHorizontal size={16} />
      </button>

    </div>
  );
}