"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Send } from "lucide-react";

export default function VoiceFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={fabRef} className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-lawdger-border/15 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-[13px] font-medium text-lawdger-espresso leading-snug">
            Hey, I&apos;m your AI assistant.
            <span className="block opacity-70 font-normal text-[11px] mt-0.5">Mention me for quick tasks.</span>
          </p>
          <div className="relative w-full mt-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message…"
              className="w-full bg-lawdger-cream border border-lawdger-border/15 rounded-full pl-4 pr-11 py-2.5 text-[13px] text-lawdger-espresso placeholder:text-lawdger-espresso/40 focus:outline-none focus:ring-2 focus:ring-lawdger-espresso/20 transition-all"
            />
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-lawdger-espresso rounded-full flex items-center justify-center hover:bg-lawdger-border/10 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open AI assistant"
        className="w-14 h-14 bg-lawdger-espresso rounded-full shadow-xl flex items-center justify-center cursor-pointer hover:bg-lawdger-espresso/90 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <Mic className="h-5 w-5 text-lawdger-cream" />
      </button>
    </div>
  );
}
