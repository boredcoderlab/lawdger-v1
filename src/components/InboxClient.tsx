"use client";

import { useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon, Inbox as InboxIcon, MoreHorizontal, CheckCircle2 } from "lucide-react";

export default function InboxClient({ initialDocuments, userName }: { initialDocuments: Record<string, unknown>[], userName: string }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file drop logic here
  };

  return (
    <div className="relative flex flex-col flex-1 p-8 lg:p-12 min-h-screen bg-transparent text-foreground font-sans z-0">
      
      {/* Background Shapes Specific to Inbox */}
      <div className="absolute top-[10%] right-[-5%] w-[60%] h-[70%] bg-primary/10 rounded-full blur-[140px] -z-10 pointer-events-none" />

      <div className="flex items-center gap-6 mb-8 z-10">
        <h1 className="font-serif text-[2.8rem] font-bold tracking-tight text-foreground leading-none">
          Document Intake
        </h1>
        <div className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[13px] font-bold shadow-inner">
          {initialDocuments.length} Unsorted
        </div>
      </div>

      {/* ── OVERLAPPING PANES LAYOUT ────────────────────────────────────────── */}
      <div className="relative mt-4 lg:w-[95%] xl:w-[85%] flex z-20">
        
        {/* Left: The Massive Dark Background Card (Dropzone) */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-[65%] rounded-[2.5rem] p-12 shadow-2xl min-h-[550px] flex flex-col transition-all duration-300 ${
            isDragging 
              ? "bg-[#3a2c20] dark:bg-[#2a2a2a] border-2 border-primary scale-[1.01]" 
              : "bg-gradient-to-b from-[#3a2c23] to-[#291e16] border border-transparent dark:border-white/5"
          }`}
        >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[1.8rem] font-serif font-bold text-[#f4efe8] dark:text-white">Secure Dropzone</h2>
              <button className="text-[#f4efe8]/50 hover:text-white transition-colors">
                 <MoreHorizontal className="w-6 h-6" />
              </button>
            </div>

            <div className={`flex-1 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed transition-colors ${
               isDragging ? "border-primary bg-primary/5" : "border-white/20 dark:border-white/10"
            }`}>
               <div className="w-24 h-24 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <UploadCloud className="w-10 h-10 text-primary relative z-10" />
               </div>
               <h3 className="text-[1.4rem] font-bold text-[#f4efe8] dark:text-white mb-2">Initialize Upload</h3>
               <p className="text-[14px] text-[#f4efe8]/60 dark:text-white/50 text-center max-w-[280px]">
                 Drag & drop case files, evidence, or emails here to securely enqueue them for sorting.
               </p>
               <button className="mt-8 px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-[13px] hover:shadow-[0_0_20px_rgba(200,150,62,0.4)] transition-all uppercase tracking-widest">
                 Browse System
               </button>
            </div>
        </div>

        {/* Right: The Frosted Glass Unsorted List overlapping on the right */}
        <div className="absolute right-0 top-12 w-[45%] rounded-[2rem] bg-white/95 dark:bg-card/80 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_80px_rgba(0,0,0,0.4)] p-8 min-h-[500px] flex flex-col z-30">
          
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-primary/10">
            <h3 className="text-[1.6rem] font-serif font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                 <InboxIcon className="w-5 h-5" />
              </div>
              Needs Sorting
            </h3>
            <button className="text-[12px] font-bold uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">
              Sort All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
            {initialDocuments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                   <CheckCircle2 className="w-12 h-12 mb-4 text-primary" />
                   <p className="text-[14px] font-bold">All caught up.</p>
                   <p className="text-[12px]">No documents waiting to be sorted.</p>
                </div>
            ) : (
              initialDocuments.map((doc, i) => (
                <div key={i} className="group relative flex items-center justify-between p-5 rounded-2xl bg-white/95 dark:bg-white/5 hover:bg-white dark:hover:bg-white/40 border border-white/50 dark:border-white/5 transition-all shadow-sm hover:shadow-md cursor-pointer overflow-hidden">
                  {/* Hover Accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                      {doc.title.includes('png') || doc.title.includes('jpeg') ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0 pr-4">
                      <h4 className="text-[15px] font-bold text-foreground truncate">{doc.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{doc.size}</span>
                          <span className="text-[12px] text-muted-foreground">• {doc.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider rounded-full shadow-md hover:scale-105 transition-all shrink-0">
                    Assign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
