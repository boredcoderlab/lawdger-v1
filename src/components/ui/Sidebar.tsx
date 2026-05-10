"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Home, Inbox, LayoutGrid, Calendar as CalIcon, CheckSquare, Settings, Moon, LogOut } from "lucide-react";

export default function Sidebar() {
  const [activeIndex, setActiveIndex] = useState(2); 

  const navItems = [
    { id: "home", icon: Home },
    { id: "inbox", icon: Inbox, alert: true },
    { id: "grid", icon: LayoutGrid },
    { id: "calendar", icon: CalIcon },
    { id: "tasks", icon: CheckSquare },
    { id: "settings", icon: Settings },
  ];

  return (
    <aside className="w-24 h-[calc(100vh-3rem)] bg-[#2C2420] rounded-[2.5rem] flex flex-col items-center py-6 relative z-50 shadow-[0_20px_60px_rgba(44,36,32,0.12)] border border-white/5 my-6 ml-6 shrink-0">
      
      {/* Brand Anchor */}
      <div className="w-12 h-12 bg-[#F4EFE6] rounded-[14px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.9)] mb-10 cursor-pointer hover:scale-105 transition-transform duration-300 relative z-20">
         <Image src="/lawdger-logo-transparent.png" alt="Lawdger Logo" width={34} height={34} className="object-contain w-auto h-auto drop-shadow-md" priority />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col w-full relative items-center">
          <div 
              className="absolute w-14 h-14 bg-[#F4EFE6] rounded-[14px] transition-transform duration-500 ease-out z-0 shadow-[0_8px_16px_rgba(0,0,0,0.2)]"
              style={{ transform: `translateY(${activeIndex * 72}px)` }} 
          />

          {navItems.map((item, index) => {
              const isActive = activeIndex === index;
              return (
                  <div 
                      key={item.id}
                      onClick={() => setActiveIndex(index)}
                      className="relative z-10 w-full h-14 flex items-center justify-center cursor-pointer group mb-4 last:mb-0"
                  >
                      <item.icon 
                          size={22} 
                          className={`transition-all duration-500 ${
                              isActive ? "text-[#2C2420] scale-110 drop-shadow-sm" : "text-[#8A8078] group-hover:text-[#D4C9C0] group-hover:scale-110" 
                          }`} 
                      />
                      {item.alert && (
                          <span className={`absolute top-3 right-5 w-2.5 h-2.5 bg-[#E05243] rounded-full border-[2.5px] transition-colors duration-500 ${isActive ? "border-[#F4EFE6]" : "border-[#2C2420]"}`}></span>
                      )}
                  </div>
              );
          })}
      </nav>

      {/* Bottom Utility */}
      <div className="flex flex-col gap-6 w-full items-center mt-auto relative z-20">
        <Moon strokeWidth={1.5} size={22} className="text-[#8A8078] hover:text-[#D4C9C0] transition-colors cursor-pointer" />
        <LogOut strokeWidth={1.5} size={22} className="text-[#8A8078] hover:text-[#D4C9C0] transition-colors cursor-pointer" />
        <div className="w-10 h-10 rounded-full bg-[#1A1512] flex items-center justify-center text-[#F4EFE6] text-sm font-bold shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border border-[#3D332D] mt-2 cursor-pointer hover:ring-2 hover:ring-white/10 transition-all">
          SJ
        </div>
      </div>
    </aside>
  );
}