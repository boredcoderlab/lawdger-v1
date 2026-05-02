"use client";

import { useEffect, useRef } from "react";
import { Mic, Calendar, Briefcase } from "lucide-react";

const FEATURES = [
  {
    icon: Mic, color:"#2dd4bf", bg:"rgba(45,212,191,.09)", border:"rgba(45,212,191,.2)",
    tag:"Voice Intelligence", title:"Speak. It's done.",
    desc:"Dictate in English or Hindi — mid-argument, between hearings, from the parking lot. Gemini transcribes, classifies, and routes every word to the right case and the right field.",
    pills:["Auto-transcription","Case matching","Hindi + English"],
  },
  {
    icon: Calendar, color:"#f97316", bg:"rgba(249,115,22,.09)", border:"rgba(249,115,22,.2)",
    tag:"Smart Calendar", title:"Never miss a hearing.",
    desc:"Court dates mentioned in your voice notes are extracted and added to your calendar in seconds. See today, this week, every upcoming date — one view, always current.",
    pills:["Auto date extraction","Hearing timeline","Conflict detection"],
  },
  {
    icon: Briefcase, color:"#818cf8", bg:"rgba(129,140,248,.09)", border:"rgba(129,140,248,.2)",
    tag:"Case Intelligence", title:"Every case. In one place.",
    desc:"Tasks, notes, payments, and timelines — all linked to the right case. Your entire practice, organised without a single manual entry. Open any case and see everything, instantly.",
    pills:["Task tracking","Fee ledger","Full history"],
  },
];

function useReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.1 }
    );
    ref.current?.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref]);
}

export default function LandingFeatures() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <section id="features" ref={ref} style={{
      background:"#0c0c0c", padding:"120px 0",
      borderTop:"1px solid rgba(255,255,255,.04)",
    }}>
      <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 40px" }}>

        {/* Header */}
        <div className="lp-reveal" style={{ textAlign:"center", marginBottom:72 }}>
          <div style={{
            display:"inline-block", fontSize:10, fontWeight:800,
            letterSpacing:".1em", textTransform:"uppercase",
            color:"#2dd4bf", background:"rgba(45,212,191,.08)",
            border:"1px solid rgba(45,212,191,.2)",
            borderRadius:99, padding:"5px 14px", marginBottom:20,
          }}>
            Everything you need
          </div>
          <h2 className="font-serif" style={{
            fontSize:"clamp(2rem,4vw,3rem)", fontWeight:600,
            color:"#F6F6F6", lineHeight:1.12, letterSpacing:"-.02em",
            marginBottom:14,
          }}>
            A second brain for your practice
          </h2>
          <p style={{ fontSize:17, color:"#4a4a50", fontWeight:300, maxWidth:460, margin:"0 auto" }}>
            Built around how Indian advocates actually work — in court, on the move, between hearings.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.tag}
              className="lp-reveal"
              style={{
                transitionDelay:`${i * 110}ms`,
                position:"relative", overflow:"hidden",
                background:"rgba(18,18,18,.8)",
                border:"1px solid rgba(255,255,255,.06)",
                borderRadius:22, padding:"36px 32px 30px",
                cursor:"default",
                transition:"border-color .3s, transform .3s, box-shadow .3s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = f.border;
                el.style.transform = "translateY(-5px)";
                el.style.boxShadow = `0 24px 60px rgba(0,0,0,.5), 0 0 50px ${f.bg}`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(255,255,255,.06)";
                el.style.transform = "";
                el.style.boxShadow = "";
              }}
            >
              {/* Corner glow */}
              <div style={{
                position:"absolute", top:0, left:0,
                width:200, height:200, borderRadius:"50%",
                background:`radial-gradient(circle, ${f.bg} 0%, transparent 70%)`,
                transform:"translate(-40%,-40%)", pointerEvents:"none",
              }} />

              <div style={{
                width:52, height:52, borderRadius:14,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:f.bg, border:`1px solid ${f.border}`,
                marginBottom:24, position:"relative",
              }}>
                <f.icon style={{ width:22, height:22, color:f.color }} />
              </div>

              <div style={{
                fontSize:10, fontWeight:800, letterSpacing:".1em",
                textTransform:"uppercase", color:f.color, marginBottom:10,
              }}>
                {f.tag}
              </div>
              <h3 className="font-serif" style={{
                fontSize:"1.5rem", fontWeight:600, color:"#F6F6F6",
                lineHeight:1.2, marginBottom:14,
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize:14, color:"#525258", fontWeight:300,
                lineHeight:1.75, marginBottom:24,
              }}>
                {f.desc}
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {f.pills.map((p) => (
                  <span key={p} style={{
                    fontSize:11, fontWeight:600, color:f.color,
                    background:f.bg, border:`1px solid ${f.border}`,
                    borderRadius:99, padding:"3px 10px",
                  }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
