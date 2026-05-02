"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2, Bot, User, Sparkles } from "lucide-react";
import type { LLMMessage } from "@/lib/llm/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
};

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What's on my schedule today?",
  "Show me all my active cases",
  "What tasks are pending?",
  "Add a new case: Sharma v. State, client Rajesh Sharma, Delhi High Court",
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

  // Keep LLM history (excludes display-only fields)
  const historyRef = useRef<LLMMessage[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
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

        if (!res.ok) {
          throw new Error(`Server error ${res.status}`);
        }

        const data = await res.json();
        const assistantContent: string = data.content ?? "Sorry, I couldn't process that.";
        const actions: string[] = data.actions ?? [];

        const assistantMsg: DisplayMessage = {
          role: "assistant",
          content: assistantContent,
          actions,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: assistantContent },
        ];
      } catch (err) {
        const errMsg: DisplayMessage = {
          role: "assistant",
          content: `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  // ── Keyboard handler ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Voice recording ─────────────────────────────────────────────────────────

  const startWaveAnimation = () => {
    waveIntervalRef.current = setInterval(() => {
      setWaveHeights(
        Array.from({ length: 12 }, () => Math.floor(Math.random() * 24) + 4)
      );
    }, 100);
  };

  const stopWaveAnimation = () => {
    if (waveIntervalRef.current) {
      clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = null;
    }
    setWaveHeights(Array(12).fill(4));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

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

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Transcription failed");

      const data = await res.json();
      const transcript: string = data.transcript ?? "";

      if (transcript) {
        // Auto-send the transcript
        await sendMessage(transcript);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <div className="flex items-end gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-1">
              Legal Brain
            </h1>
            <p className="text-muted-foreground text-lg font-light">
              Your AI legal assistant. Ask anything or give it a command.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Suggested prompts */}
          {showSuggestions && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-4 text-center">
                Try asking…
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left px-5 py-4 rounded-2xl border border-white/8 bg-card/40 backdrop-blur-sm hover:border-accent/30 hover:bg-card/60 transition-all text-sm text-muted-foreground hover:text-foreground font-light"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === "user"
                    ? "bg-white/10 border border-white/15"
                    : "bg-accent/10 border border-accent/20"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-accent" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[85%] space-y-2 ${
                  msg.role === "user" ? "items-end" : "items-start"
                } flex flex-col`}
              >
                <div
                  className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed font-light whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-accent/15 border border-accent/20 text-foreground rounded-tr-sm"
                      : "bg-card/80 border border-white/8 text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Action chips */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.actions.map((action, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400"
                      >
                        {action}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="px-5 py-3.5 rounded-2xl rounded-tl-sm bg-card/80 border border-white/8">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-light">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-white/5 bg-card/60 backdrop-blur-xl px-8 py-5 z-10">
        <div className="max-w-3xl mx-auto">
          {/* Transcribing indicator */}
          {isTranscribing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-light">
              <Loader2 className="h-3 w-3 animate-spin" />
              Transcribing audio…
            </div>
          )}

          {/* Recording waveform */}
          {isRecording && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-end gap-[3px] h-8">
                {waveHeights.map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full transition-all duration-100"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
              <span className="text-xs text-red-400 font-light animate-pulse">
                Recording — tap mic to stop
              </span>
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or give a command… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={isLoading || isRecording || isTranscribing}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 font-light focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30 transition-all resize-none disabled:opacity-50"
              />
            </div>

            {/* Mic button */}
            <button
              onClick={toggleRecording}
              disabled={isLoading || isTranscribing}
              title={isRecording ? "Stop recording" : "Start voice input"}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                isRecording
                  ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
                  : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
              } disabled:opacity-40`}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading || isRecording || isTranscribing}
              title="Send message"
              className="w-12 h-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground/40 mt-2 text-center font-light">
            Legal Brain can make mistakes — always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
