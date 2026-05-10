"use client";

import React, { useState } from "react";
import { Filter } from "lucide-react";

export default function PageActionHeader() {
  const [activeTab, setActiveTab] = useState("All");
  const tabs = ["All", "Active", "Pending", "Closed"];

  return (
    <div className="flex items-center justify-between w-full mb-10 z-20 relative">
      
      {/* Left Column: Page Title & Meta */}
      <div>
        <h2 className="font-serif text-[3rem] font-bold text-[#2C2420] tracking-tight leading-none">
          Matters
        </h2>
        <p className="text-[#8A8078] text-[11px] font-bold uppercase tracking-[0.2em] mt-3">
          14 Active • 2 Pending
        </p>
      </div>

      {/* Right Column: Apple-Style Toggle & Filters */}
      <div className="flex items-center gap-4 mt-2">
        
        {/* Apple-Style Segmented Control */}
        <div className="bg-[#2C2420]/5 p-1 rounded-full flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-[#2C2420]/5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
                activeTab === tab
                  ? "bg-white text-[#2C2420] shadow-[0_4px_12px_rgba(44,36,32,0.08)] border border-white/80"
                  : "text-[#8A8078] hover:text-[#2C2420] border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter Trigger Button */}
        <button className="flex items-center gap-2 bg-white/60 hover:bg-white border border-[#2C2420]/10 hover:border-[#D4AF37]/40 text-[#2C2420] px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm group">
          <Filter size={16} className="text-[#8A8078] group-hover:text-[#D4AF37] transition-colors" />
          <span>Filters</span>
        </button>

      </div>
    </div>
  );
}