"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic, Calendar, CheckCircle2, FileText, Loader2, Scale } from "lucide-react";

// Waveform bar heights (normalized 0–1)
const BARS = [0.3,0.7,1,0.5,0.8,0.4,0.9,0.6,1,0.5,0.7,0.3,0.9,0.6,0.8,0.4,1,0.7,0.5,0.9,0.3,0.6];
const WV_CLS = ["lp-wv0","lp-wv1","lp-wv2","lp-wv3"];

const RESULTS = [
  { icon: Scale,       color: "#818cf8", bg: "rgba(129,140,248,.12)", label: "CASE",    text: "Anil Gupta vs IDA — matched & opened" },
  { icon: Calendar,    color: "#f97316", bg: "rgba(249,115,22,.12)",  label: "HEARING", text: "Monday, Apr 28 — added to calendar" },
  { icon: CheckCircle2,color: "#2dd4bf", bg: "rgba(45,212,191,.12)",  label: "TASK",    text: "File reply affidavit — queued" },
];

// Stages: 0=recording 1=processing 2=result0 3=result1 4=result2 5=done (pause) → back to 0
const STAGE_TIMES = [2800, 4000, 5000, 6000, 7200, 9500];

export default function LiveDemo() {
  const [stage, setStage] = useState(0);

  const advance = useCallback(() => {
    setStage((s) => (s >= 5 ? 0 : s + 1));
  }, []);

  useEffect(() => {
    const delay = stage === 0 ? STAGE_TIMES[0] : STAGE_TIMES[stage] - STAGE_TIMES[stage - 1];
    const t = setTimeout(advance, delay);
    return () => clearTimeout(t);
  }, [stage, advance]);

  const isRecording = stage === 0;
  const isProcessing = stage === 1;
  const resultCount = Math.max(0, stage - 1);

  return (
    <div
      className="lp-demo-tilt"
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 20,
        background: "rgba(14,14,14,.92)",
        border: "1px solid rgba(255,255,255,.09)",
        boxShadow: "0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.07)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.06)",
        background: "rgba(255,255,255,.025)",
      }}>
        <div style={{ display:"flex", gap:6 }}>
          {["#ff5f57","#febc2e","#28c840"].map((c) => (
            <div key={c} style={{ width:10, height:10, borderRadius:"50%", background:c, opacity:.7 }} />
          ))}
        </div>
        <span style={{ fontSize:12, color:"#4a4a50", fontWeight:500, letterSpacing:".06em", marginLeft:6 }}>
          LAWDGER — VOICE INPUT
        </span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <div
            className={isRecording ? "lp-rec" : ""}
            style={{
              width:7, height:7, borderRadius:"50%",
              background: isRecording ? "#ef4444" : "#22c55e",
              boxShadow: isRecording ? "0 0 8px rgba(239,68,68,.8)" : "0 0 8px rgba(34,197,94,.6)",
            }}
          />
          <span style={{ fontSize:11, color: isRecording ? "#ef4444" : "#22c55e", fontWeight:600 }}>
            {isRecording ? "REC" : "DONE"}
          </span>
        </div>
      </div>

      {/* Voice section */}
      <div style={{ padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <div style={{
            width:32, height:32, borderRadius:"50%", flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background: isRecording ? "rgba(239,68,68,.12)" : "rgba(45,212,191,.12)",
            border: `1px solid ${isRecording ? "rgba(239,68,68,.25)" : "rgba(45,212,191,.25)"}`,
          }}>
            <Mic style={{ width:15, height:15, color: isRecording ? "#ef4444" : "#2dd4bf" }} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase",
              color: isRecording ? "#ef4444" : "#2dd4bf" }}>
              {isRecording ? "Recording…" : "Processed"}
            </div>
            <div style={{ fontSize:11, color:"#3a3a3f", fontWeight:300, marginTop:1 }}>
              Lawdger AI · Gemini 2.5 Flash
            </div>
          </div>
        </div>

        {/* Waveform */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:3, height:44, padding:"4px 8px",
          background:"rgba(255,255,255,.02)", borderRadius:10, marginBottom:14,
        }}>
          {BARS.map((h, i) => (
            <div
              key={i}
              className={isRecording ? WV_CLS[i % 4] : ""}
              style={{
                width:4, borderRadius:99, transformOrigin:"center",
                height: isRecording ? `${h * 34}px` : "4px",
                background: isRecording
                  ? `rgba(45,212,191,${0.45 + h * 0.55})`
                  : "rgba(255,255,255,.1)",
                transition: isRecording ? "none" : "height .6s ease, background .6s ease",
                animationDelay: isRecording ? `${i * 0.06}s` : "0s",
              }}
            />
          ))}
        </div>

        {/* Transcript */}
        <div style={{
          borderRadius:10, padding:"12px 14px", marginBottom:16,
          background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.05)",
        }}>
          <div style={{ fontSize:10, color:"#3a3a3f", fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>
            Transcript
          </div>
          <p style={{ fontSize:13, color:"#c0c0c5", fontWeight:300, lineHeight:1.65, margin:0 }}>
            &ldquo;The case of{" "}
            <span style={{ color:"#F6F6F6", fontWeight:500 }}>Anil Gupta vs IDA</span>
            {" "}is listed on{" "}
            <span style={{ color:"#f97316", fontWeight:500 }}>Monday</span>
            . I need to{" "}
            <span style={{ color:"#2dd4bf", fontWeight:500 }}>file a reply</span>
            .&rdquo;
          </p>
        </div>
      </div>

      {/* Results section */}
      <div style={{
        borderTop:"1px solid rgba(255,255,255,.06)",
        padding:"14px 20px 18px",
        minHeight:120,
      }}>
        {stage < 1 ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#3a3a3f", fontSize:12, fontWeight:300 }}>
            <div style={{
              width:16, height:16, borderRadius:"50%",
              border:"1.5px dashed rgba(255,255,255,.12)",
            }} />
            Awaiting processing…
          </div>
        ) : (
          <>
            {/* Processing header */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              {isProcessing ? (
                <Loader2 style={{ width:14, height:14, color:"#2dd4bf" }} className="lp-spin" />
              ) : (
                <div style={{
                  width:14, height:14, borderRadius:"50%",
                  background:"rgba(45,212,191,.15)", display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#2dd4bf" }} />
                </div>
              )}
              <span style={{ fontSize:11, fontWeight:600, color:"#2dd4bf", letterSpacing:".06em", textTransform:"uppercase" }}>
                {isProcessing ? "Processing with Gemini…" : `${resultCount} item${resultCount !== 1 ? "s" : ""} filed`}
              </span>
            </div>

            {/* Result items */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {RESULTS.slice(0, resultCount).map((r, i) => (
                <div
                  key={i}
                  className="lp-slide-in"
                  style={{ display:"flex", alignItems:"center", gap:10 }}
                >
                  {/* Check */}
                  <div className="lp-check" style={{
                    width:20, height:20, borderRadius:"50%", flexShrink:0,
                    background: r.bg, border:`1px solid ${r.color}33`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <r.icon style={{ width:10, height:10, color:r.color }} />
                  </div>
                  {/* Label + text */}
                  <div style={{ display:"flex", alignItems:"baseline", gap:7, flex:1, minWidth:0 }}>
                    <span style={{
                      fontSize:9, fontWeight:800, letterSpacing:".1em",
                      color:r.color, textTransform:"uppercase", flexShrink:0,
                      background:r.bg, border:`1px solid ${r.color}33`,
                      borderRadius:99, padding:"1px 6px",
                    }}>
                      {r.label}
                    </span>
                    <span style={{ fontSize:12, color:"#c0c0c5", fontWeight:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
