"use client";

import React from "react";
import { Activity, Plus, Search, CheckCircle2 } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="flex-1 p-8 lg:p-12 overflow-hidden h-full flex flex-col relative z-10">
      
      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0 mb-8">
        <h2 className="font-serif text-[3.5rem] font-bold text-lawdger-espresso tracking-tight leading-none">
          Tasks
        </h2>
        <button className="flex items-center gap-2 bg-lawdger-espresso text-lawdger-base px-5 py-2.5 rounded-full text-sm font-bold shadow-[0_8px_20px_rgba(44,36,32,0.15)] hover:bg-[#1A1512] transition-all">
          <Plus size={16} className="text-lawdger-gold" />
          <span>NEW TASK</span>
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="flex gap-6 flex-1 overflow-hidden h-full">
        
        {/* LEFT PANE: ORCHESTRATION */}
        <div className="w-[340px] bg-lawdger-espresso rounded-[2.5rem] p-8 flex flex-col shrink-0 shadow-xl overflow-y-auto custom-scrollbar">
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/80 border border-white/10 shadow-inner">
              <Activity size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-serif text-[1.7rem] text-lawdger-base leading-none mb-1">Orchestration</h3>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-lawdger-base/40">Metrics & Delegation</p>
            </div>
          </div>

          {/* Large Metric */}
          <div className="bg-[#E6DED1] rounded-3xl p-6 mb-4 shadow-inner">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8078] mb-2">Total Pending</p>
            <span className="font-serif text-5xl text-lawdger-espresso">3</span>
          </div>

          {/* Sub Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-[#1A1512] border border-white/5 rounded-3xl p-6 flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-lawdger-base/40 mb-2">Due Today</p>
              <span className="font-serif text-3xl text-lawdger-gold">0</span>
            </div>
            <div className="bg-[#1A1512] border border-white/5 rounded-3xl p-6 flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-lawdger-base/40 mb-2">Overdue</p>
              <span className="font-serif text-3xl text-destructive">3</span>
            </div>
          </div>

          {/* Overdue Preview List */}
          <div className="mt-auto space-y-3">
             <div className="bg-[#1A1512] border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-3">
                   <span className="bg-lawdger-base/10 text-lawdger-base text-[10px] px-2 py-1 rounded border border-white/10">Test Case</span>
                </div>
                <h4 className="text-lawdger-base text-sm font-bold mb-4">sdsds</h4>
                <div className="flex items-center gap-2 text-destructive">
                    <CheckCircle2 size={14} />
                    <span className="text-[9px] font-black tracking-widest border border-destructive/30 bg-destructive/10 px-2 py-0.5 rounded text-destructive">OVERDUE</span>
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT PANE: KANBAN BOARD */}
        <div className="flex-1 bg-lawdger-espresso rounded-[2.5rem] p-8 flex flex-col shadow-xl overflow-hidden relative">
          
          <div className="flex justify-end mb-6 shrink-0">
             <button className="flex items-center gap-2 bg-[#1A1512] border border-white/10 text-lawdger-base px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-white/5 transition-all">
                <Plus size={12} className="text-lawdger-gold" />
                New Assignment
             </button>
          </div>

          {/* Swimlanes */}
          <div className="flex-1 flex gap-6 overflow-x-auto custom-scrollbar pr-4">
            
            {/* Column 1: My Plate */}
            <div className="w-[280px] shrink-0 bg-[#E6DED1] rounded-[2rem] p-4 flex flex-col shadow-inner border border-white/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3 text-lawdger-espresso">
                    <div className="w-8 h-8 rounded-full bg-lawdger-espresso/10 flex items-center justify-center">
                        <Activity size={14} />
                    </div>
                    <h3 className="font-serif text-xl font-bold">My Plate</h3>
                </div>
                <span className="w-6 h-6 rounded-full bg-lawdger-espresso text-white flex items-center justify-center text-[10px] font-bold">1</span>
              </div>
              
              <div className="flex flex-col gap-3">
                 {/* Dark Card */}
                 <div className="bg-[#1A1512] rounded-[1.5rem] p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
                    <div className="mb-4">
                       <span className="bg-lawdger-base/10 text-lawdger-base text-[10px] px-2.5 py-1 rounded border border-white/10 font-medium">Test Case</span>
                    </div>
                    <h4 className="text-lawdger-base text-base font-bold mb-6">asdasdas</h4>
                    <div className="inline-flex items-center gap-1.5 border border-destructive/30 bg-destructive/10 px-2.5 py-1 rounded">
                        <CheckCircle2 size={12} className="text-destructive" />
                        <span className="text-[9px] font-black tracking-widest text-destructive uppercase">OVERDUE</span>
                    </div>
                 </div>
              </div>
            </div>

            {/* Column 2: Associates */}
            <div className="w-[280px] shrink-0 bg-[#E6DED1] opacity-70 rounded-[2rem] p-4 flex flex-col border border-white/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3 text-lawdger-espresso/60">
                    <div className="w-8 h-8 rounded-full bg-lawdger-espresso/5 flex items-center justify-center">
                        <Activity size={14} />
                    </div>
                    <h3 className="font-serif text-xl font-bold">Associates</h3>
                </div>
                <span className="w-6 h-6 rounded-full bg-lawdger-espresso/20 text-lawdger-espresso flex items-center justify-center text-[10px] font-bold">0</span>
              </div>
               <div className="flex-1 flex items-center justify-center border-2 border-dashed border-lawdger-espresso/10 rounded-2xl m-2">
                  <span className="text-[9px] font-black tracking-widest uppercase text-lawdger-espresso/30">Drop to Assign</span>
              </div>
            </div>

            {/* Column 3: Clerks & Filings */}
            <div className="w-[280px] shrink-0 bg-[#E6DED1] opacity-70 rounded-[2rem] p-4 flex flex-col border border-white/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3 text-lawdger-espresso/60">
                    <div className="w-8 h-8 rounded-full bg-lawdger-espresso/5 flex items-center justify-center">
                        <Activity size={14} />
                    </div>
                    <h3 className="font-serif text-xl font-bold leading-tight">Clerks &<br/>Filings</h3>
                </div>
                <span className="w-6 h-6 rounded-full bg-lawdger-espresso/20 text-lawdger-espresso flex items-center justify-center text-[10px] font-bold">0</span>
              </div>
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-lawdger-espresso/10 rounded-2xl m-2">
                  <span className="text-[9px] font-black tracking-widest uppercase text-lawdger-espresso/30">Drop to Assign</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}