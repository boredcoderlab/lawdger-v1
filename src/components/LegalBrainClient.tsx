"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, Mic, MicOff, Loader2, Bot, User, Sparkles, Brain, Zap, Scale, ChevronLeft } from "lucide-react";
import { PageLayout, DarkPaneHeaderTitle, ContentHeading, DashboardLink } from "@/components/ui/LayoutShell";
import type { LLMMessage } from "@/lib/llm/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
};

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: Scale, text: "What's on my schedule today?" },
  { icon: Zap, text: "Show me all my active cases" },
  { icon: Brain, text: "What tasks are pending?" },
  { icon: Sparkles, text: "Add a new case: Sharma v. State, Delhi High Court" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LegalBrainClient() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Recording internals
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Waveform animation
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(12).fill(4));
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep LLM history
  const historyRef = useRef<LLMMessage[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInput("");

      const userMsg: DisplayMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      const llmUserMsg: LLMMessage = { role: "user", content: trimmed };
      historyRef.current = [...historyRef.current, llmUserMsg];

      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyRef.current }),
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = await res.json();
        const assistantContent: string = data.content ?? "Sorry, I couldn't process that.";
        const actions: string[] = data.actions ?? [];

        const assistantMsg: DisplayMessage = { role: "assistant", content: assistantContent, actions };

        setMessages((prev) => [...prev, assistantMsg]);
        historyRef.current = [...historyRef.current, { role: "assistant", content: assistantContent }];
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Voice recording ──────────────────────────────────────────────────────────

  const startWaveAnimation = () => {
    waveIntervalRef.current = setInterval(() => {
      setWaveHeights(Array.from({ length: 12 }, () => Math.floor(Math.random() * 24) + 4));
    }, 100);
  };

  const stopWaveAnimation = () => {
    if (waveIntervalRef.current) { clearInterval(waveIntervalRef.current); waveIntervalRef.current = null; }
    setWaveHeights(Array(12).fill(4));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stopWaveAnimation();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };
      recorder.start(200);
      setIsRecording(true);
      startWaveAnimation();
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  };

  const processAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      const transcript: string = data.transcript ?? "";
      if (transcript) await sendMessage(transcript);
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => { isRecording ? stopRecording() : startRecording(); };
  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <PageLayout
      pageTitle="Legal Brain"
      darkPaneHeader={
        <DarkPaneHeaderTitle icon={Sparkles} title="AI Assistant" subtitle="Capabilities & Status" />
      }
      darkPaneContent={
        <>
          {/* Description */}
          <p className="text-[14px] font-medium text-white/60 leading-relaxed mb-8 shrink-0">
            Your dedicated AI counsel. Ask anything about your cases, schedule tasks, draft documents, or get instant legal context.
          </p>

          {/* Capability Pills */}
          <div className="flex flex-col gap-3 mb-10 shrink-0">
            {[
              { icon: Scale, label: "Case Management", sub: "Query and manage active case files" },
              { icon: Brain, label: "Legal Research", sub: "Summarise precedents and statutes" },
              { icon: Zap, label: "Smart Actions", sub: "Create tasks, hearings, and notes" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-lawdger-cream">{label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recording waveform */}
          {isRecording && (
            <div className="shrink-0 flex items-end gap-[3px] h-12 mb-4 px-2">
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-red-400 rounded-full transition-all duration-100"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          )}

          {/* Transcribing status */}
          {isTranscribing && (
            <div className="flex items-center gap-2 text-[11px] text-primary shrink-0 mb-4">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="font-bold uppercase tracking-widest">Transcribing…</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-10 shrink-0">
            <div className="flex items-center gap-2 text-white/20">
              <Sparkles className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Powered by Gemini</span>
            </div>
          </div>
        </>
      }
      mainPaneHeader={
        <>
          <ContentHeading>Active Session</ContentHeading>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isLoading    ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
              : isRecording ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
              : "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
            }`} />
            <p className="text-[11px] text-muted-foreground font-medium">
              {isLoading ? "Thinking…" : isRecording ? "Listening…" : "Ready"} · {messages.length} messages
            </p>
          </div>
        </>
      }
      mainPaneContent={
        <div className="flex flex-col h-full">

          {/* Messages area
              Phase 3r: when empty (showSuggestions), the inner wrapper switches
              to a centered flex layout so the quick-action cards sit vertically
              centered in the available space rather than floating high with a
              dead band below. When messages exist, normal stacked scroll. */}
          <div className="flex-1 overflow-y-auto p-8 pb-4 scrollbar-hide">
            <div className={`max-w-2xl mx-auto ${showSuggestions ? 'h-full flex flex-col items-center justify-center' : 'space-y-6'}`}>

              {/* Suggested prompts */}
              {showSuggestions && (
                <div className="w-full">
                  <p className="text-[10px] text-lawdger-muted uppercase tracking-widest font-bold mb-5 text-center">
                    Start a conversation
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
                      <button
                        key={text}
                        onClick={() => sendMessage(text)}
                        className="text-left px-5 py-4 rounded-2xl border border-lawdger-border/15 bg-lawdger-cream/40 backdrop-blur-sm hover:border-lawdger-espresso/30 hover:bg-lawdger-cream/70 transition-all text-[13px] text-lawdger-espresso/80 font-medium group flex items-start gap-3 shadow-sm"
                      >
                        <Icon className="w-4 h-4 text-lawdger-espresso shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-sm ${
                    msg.role === "user"
                      ? "bg-lawdger-espresso dark:bg-white/40 border border-white/20"
                      : "bg-primary/20 border border-primary/30"
                  }`}>
                    {msg.role === "user"
                      ? <User className="h-4 w-4 text-lawdger-cream" />
                      : <Bot className="h-4 w-4 text-primary" />
                    }
                  </div>

                  <div className={`max-w-[80%] space-y-2 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-5 py-4 rounded-2xl text-[14px] leading-relaxed font-medium whitespace-pre-wrap shadow-sm ${
                      msg.role === "user"
                        ? "bg-lawdger-espresso dark:bg-white/40 border border-white/20 text-lawdger-cream rounded-tr-sm"
                        : "bg-white/70 dark:bg-card/80 border border-white/50 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {msg.actions.map((action, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 uppercase tracking-wider">
                            ✓ {action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-white/70 dark:bg-card/80 border border-white/50 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground text-[13px] font-medium">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Legal Brain is thinking…
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar — pinned to bottom (Phase 3r: themed glass treatment).
              Outer wrapper holds positioning only; the actual input bar is the
              inner glass container (bg-lawdger-cream/40 + blur + border) so it
              reads as cream glassmorphism rather than the prior flat grey. */}
          <div className="shrink-0 px-4 lg:px-8 pb-4 pt-2">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-end gap-2 bg-lawdger-cream/40 backdrop-blur-sm border border-lawdger-border/15 rounded-2xl shadow-sm px-3 py-2">

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or give a command… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  disabled={isLoading || isRecording || isTranscribing}
                  className="flex-1 bg-transparent px-3 py-2 text-[14px] text-lawdger-espresso placeholder:text-lawdger-muted font-medium outline-none resize-none disabled:opacity-50 leading-relaxed"
                />

                <button
                  onClick={toggleRecording}
                  disabled={isLoading || isTranscribing}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                    isRecording
                      ? "bg-red-500/15 border border-red-500/40 text-red-500 hover:bg-red-500/25"
                      : "bg-lawdger-base border border-lawdger-border/15 text-lawdger-muted hover:text-lawdger-espresso"
                  } disabled:opacity-40`}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading || isRecording || isTranscribing}
                  title="Send message"
                  className="w-10 h-10 rounded-full bg-lawdger-espresso text-lawdger-cream flex items-center justify-center hover:bg-lawdger-espresso/90 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-lawdger-muted/70 mt-3 text-center font-medium">
                Legal Brain can make mistakes — always verify important information with qualified counsel.
              </p>
            </div>
          </div>

        </div>
      }
    />
  );
}
