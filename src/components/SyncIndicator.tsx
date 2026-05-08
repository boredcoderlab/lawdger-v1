"use client";

import { useState, useEffect } from "react";
import { CloudOff, CloudCog } from "lucide-react";

export default function SyncIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const tm = setTimeout(() => setMounted(true), 0);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    const tm2 = setTimeout(() => setIsOffline(!navigator.onLine), 0);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(tm);
      clearTimeout(tm2);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!mounted) return null;

  if (!isOffline) return null; // We only show it prominently when offline to keep UI clean

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-md text-white rounded-full shadow-lg border border-red-400">
      <CloudOff className="w-4 h-4" />
      <span className="text-[12px] font-bold uppercase tracking-wider">Offline Mode</span>
    </div>
  );
}
