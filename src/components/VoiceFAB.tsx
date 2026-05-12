'use client';
import { useState, useEffect } from 'react';
import { Mic, X, Check, Loader2 } from 'lucide-react';

export default function VoiceFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{caseName: string; cleanNote: string; category: string; date?: string} | null>(null);
  
  // Mock waveform animation
  const [bars, setBars] = useState<number[]>(Array(10).fill(10));
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let tm: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setBars(Array(10).fill(0).map(() => Math.floor(Math.random() * 40) + 10));
      }, 100);
    } else {
      tm = setTimeout(() => setBars(Array(10).fill(10)), 0);
    }
    return () => {
        clearInterval(interval);
        clearTimeout(tm);
    };
  }, [isRecording]);

  const handleRecordToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      
      // Mock API call
      try {
        const res = await fetch('/api/voice/process', { method: 'POST' });
        const data = await res.json();
        setResult(data);
      } catch (error) {
        console.error("Error processing voice", error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsRecording(true);
      setResult(null);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setIsRecording(false);
    setIsProcessing(false);
    setResult(null);
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-40">
        <button 
          onClick={() => setIsOpen(true)}
          className="group flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(41,151,255,0.4)] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        >
          <Mic className="h-7 w-7 group-hover:animate-pulse" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative overflow-hidden">
            <button onClick={closeModal} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            
            <div className="mt-4 flex flex-col items-center">
              <div className="mb-8 text-center">
                <h2 className="text-xl font-semibold mb-2">
                  {isRecording ? "Listening..." : isProcessing ? "Processing..." : result ? "Processed" : "Ready to Record"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isRecording ? "Your Legal Brain is listening." : "Tap to dictate a case note, task, or hearing date."}
                </p>
              </div>

              {!result && (
                <div className="relative mb-8 flex h-32 w-full items-center justify-center">
                  <div className="flex items-center gap-1 h-16">
                    {bars.map((height, i) => (
                      <div 
                        key={i} 
                        className={`w-2 rounded-full bg-accent transition-all duration-100 ${isRecording ? 'opacity-100' : 'opacity-30'}`}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <div className="mb-8 w-full rounded-xl bg-muted p-4 text-sm border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-green-500">Success</span>
                  </div>
                  <p className="font-medium text-foreground mb-1">{result.caseName}</p>
                  <p className="text-muted-foreground">{result.cleanNote}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {result.category}
                    </span>
                    {result.date && (
                      <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
                        {result.date}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!result && (
                <button
                  onClick={handleRecordToggle}
                  disabled={isProcessing}
                  className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.5)]' 
                      : 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_rgba(41,151,255,0.4)]'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isProcessing ? <Loader2 className="h-8 w-8 animate-spin" /> : isRecording ? <div className="h-6 w-6 rounded-sm bg-white" /> : <Mic className="h-8 w-8" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
