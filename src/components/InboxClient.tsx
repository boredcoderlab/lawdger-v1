"use client";

import { useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon, Inbox as InboxIcon, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { PageLayout, DarkPaneHeaderTitle, ContentHeading } from "@/components/ui/LayoutShell";

interface InboxDocument { title: string; size: string; time: string; }
export default function InboxClient({ initialDocuments, userName }: { initialDocuments: InboxDocument[], userName: string }) {
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
    <PageLayout
      pageTitle="Document Intake"
      headerAction={
        <div className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[13px] font-bold shadow-inner">
          {initialDocuments.length} Unsorted
        </div>
      }
      darkPaneHeader={
        <DarkPaneHeaderTitle icon={UploadCloud} title="Secure Dropzone" subtitle="Upload & Processing" />
      }
      darkPaneContent={
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed transition-colors ${
             isDragging ? "border-primary bg-primary/5" : "border-white/20 dark:border-white/10"
          }`}
        >
           <div className="w-24 h-24 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <UploadCloud className="w-10 h-10 text-white relative z-10 group-hover:text-primary transition-colors" />
           </div>
           <h3 className="font-serif text-[1.4rem] font-bold text-[#f4efe8] dark:text-white mb-2">Initialize Upload</h3>
           <p className="text-[14px] text-[#f4efe8]/60 dark:text-white/50 text-center max-w-[280px]">
             Drag & drop case files, evidence, or emails here to securely enqueue them for sorting.
           </p>
           <button className="mt-8 px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-[13px] hover:shadow-[0_0_20px_rgba(200,150,62,0.4)] transition-all uppercase tracking-widest">
             Browse System
           </button>
        </div>
      }
      mainPaneHeader={
        <>
          <div className="flex items-center gap-3">
            <ContentHeading className="flex items-center gap-3 text-[1.4rem]">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                 <InboxIcon className="w-5 h-5" />
              </div>
              Needs Sorting
            </ContentHeading>
          </div>
          <button className="text-[12px] font-bold uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">
            Sort All
          </button>
        </>
      }
      mainPaneContent={
        <div className="p-8 h-full">
          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide h-full">
            {initialDocuments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60 min-h-[300px]">
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
      }
    />
  );
}
