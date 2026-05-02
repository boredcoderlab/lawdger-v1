"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Scale, ArrowRight, Mic, Zap, CheckCircle2, Loader2, Zap as ZapIcon, Shield, Globe } from "lucide-react";

const STEPS = [
  { n:"01", icon:Mic,          color:"#2dd4bf", bg:"rgba(45,212,191,.09)", border:"rgba(45,212,191,.2)",
    title:"Speak naturally", desc:"Open Lawdger, tap the mic, and talk. Case name, hearing date, task. No commands, no format required.",
    eg:'"Anil Gupta vs IDA is listed Monday. I need to file a reply."',
  },
  { n:"02", icon:Zap,          color:"#f97316", bg:"rgba(249,115,22,.09)", border:"rgba(249,115,22,.2)",
    title:"Gemini classifies", desc:"The AI reads your intent, extracts the case name, date, and action — and decides exactly where each piece of information belongs.",
    eg:"→ Case matched · Hearing extracted · Task identified",
  },
  { n:"03", icon:CheckCircle2, color:"#818cf8", bg:"rgba(129,140,248,.09)", border:"rgba(129,140,248,.2)",
    title:"Your case updates", desc:"In under 10 seconds, your case page has a new hearing, a queued task, and a full transcript. Filed, tagged, searchable.",
    eg:"0 seconds of typing. 0 manual entries.",
  },
];

const VALUES = [
  { icon:ZapIcon, color:"#2dd4bf", title:"10 seconds", desc:"From spoken note to filed, tagged, searchable case entry." },
  { icon:Shield,  color:"#f97316", title:"Private by design", desc:"Audio never leaves your device. Only the transcript is processed." },
  { icon:Globe,   color:"#818cf8", title:"Multilingual", desc:"English, Hindi, or Hinglish — Lawdger handles all three." },
];

export default function LandingStepsAndCTA() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.1 }
    );
    ref.current?.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ background:"#0a0a0a", padding:"120px 0", borderTop:"1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 40px" }}>

          <div className="lp-reveal" style={{ textAlign:"center", marginBottom:72 }}>
            <div style={{
              display:"inline-block", fontSize:10, fontWeight:800, letterSpacing:".1em",
              textTransform:"uppercase", color:"#2dd4bf", background:"rgba(45,212,191,.08)",
              border:"1px solid rgba(45,212,191,.2)", borderRadius:99, padding:"5px 14px", marginBottom:20,
            }}>
              Simple by design
            </div>
            <h2 className="font-serif" style={{
              fontSize:"clamp(2rem,4vw,3rem)", fontWeight:600, color:"#F6F6F6",
              lineHeight:1.12, letterSpacing:"-.02em", marginBottom:14,
            }}>
              From voice to filed — in 10 seconds
            </h2>
            <p style={{ fontSize:17, color:"#4a4a50", fontWeight:300, maxWidth:420, margin:"0 auto" }}>
              No form to fill. No category to pick. Just speak.
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24, position:"relative" }}>
            {/* Connector lines */}
            <div style={{
              position:"absolute", top:40, left:"calc(33% - 10px)", right:"calc(33% - 10px)", height:1,
              background:"linear-gradient(90deg, rgba(45,212,191,.3), rgba(249,115,22,.3))",
            }} />

            {STEPS.map((s, i) => (
              <div key={s.n} className="lp-reveal" style={{ transitionDelay:`${i * 110}ms` }}>
                {/* Circle */}
                <div style={{ position:"relative", marginBottom:28 }}>
                  <div style={{
                    width:80, height:80, borderRadius:"50%",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:s.bg, border:`1.5px solid ${s.border}`,
                    boxShadow:`0 0 30px ${s.bg}`,
                  }}>
                    <s.icon style={{ width:28, height:28, color:s.color }} />
                  </div>
                  <div style={{
                    position:"absolute", top:-6, right:-6,
                    width:24, height:24, borderRadius:"50%",
                    background:s.color, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:"#070707",
                  }}>
                    {i+1}
                  </div>
                </div>

                <div style={{
                  background:"rgba(18,18,18,.7)", border:"1px solid rgba(255,255,255,.06)",
                  borderRadius:18, padding:"26px 24px",
                }}>
                  <div style={{ fontSize:10, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", color:s.color, marginBottom:10 }}>
                    Step {s.n}
                  </div>
                  <h3 className="font-serif" style={{ fontSize:"1.3rem", fontWeight:600, color:"#F6F6F6", lineHeight:1.2, marginBottom:12 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize:14, color:"#525258", fontWeight:300, lineHeight:1.75, marginBottom:16 }}>
                    {s.desc}
                  </p>
                  <div style={{
                    fontSize:12, fontFamily:"monospace", color:s.color,
                    background:s.bg, border:`1px solid ${s.border}`,
                    borderRadius:8, padding:"8px 12px", lineHeight:1.5,
                  }}>
                    {s.eg}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value strip ── */}
      <section style={{ background:"#0c0c0c", padding:"72px 0", borderTop:"1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 40px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {VALUES.map((v, i) => (
            <div key={v.title} className="lp-reveal" style={{
              transitionDelay:`${i*80}ms`,
              display:"flex", alignItems:"flex-start", gap:16,
              background:"rgba(18,18,18,.6)", border:"1px solid rgba(255,255,255,.05)",
              borderRadius:16, padding:"24px",
            }}>
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:`${v.color}14`, border:`1px solid ${v.color}30`,
              }}>
                <v.icon style={{ width:19, height:19, color:v.color }} />
              </div>
              <div>
                <h3 style={{ fontSize:15, fontWeight:600, color:"#F6F6F6", marginBottom:5 }}>{v.title}</h3>
                <p style={{ fontSize:13, color:"#4a4a50", fontWeight:300, lineHeight:1.65 }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{
        background:"#070707", padding:"140px 0 100px",
        borderTop:"1px solid rgba(255,255,255,.04)",
        position:"relative", overflow:"hidden",
      }}>
        <div className="lp-orb-a" style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:700, height:700, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(243,225,215,.06) 0%, rgba(45,212,191,.03) 40%, transparent 70%)",
          filter:"blur(60px)", pointerEvents:"none",
        }} />

        <div className="lp-reveal" style={{ maxWidth:720, margin:"0 auto", padding:"0 40px", textAlign:"center" }}>
          <div className="lp-fl-a" style={{
            width:90, height:90, borderRadius:"50%", margin:"0 auto 36px",
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(243,225,215,.06)",
            border:"1px solid rgba(243,225,215,.14)",
            boxShadow:"0 0 50px rgba(243,225,215,.1)",
          }}>
            <Scale style={{ width:38, height:38, color:"#F3E1D7", filter:"drop-shadow(0 0 12px rgba(243,225,215,.6))" }} />
          </div>

          <h2 className="font-serif" style={{
            fontSize:"clamp(2.4rem,5vw,4.5rem)", fontWeight:600,
            color:"#F6F6F6", lineHeight:1.08, letterSpacing:"-.025em", marginBottom:22,
          }}>
            The advocate who{" "}
            <span className="lp-shimmer">documents more</span>
            {" "}wins more.
          </h2>
          <p style={{ fontSize:18, color:"#4a4a50", fontWeight:300, maxWidth:480, margin:"0 auto 44px", lineHeight:1.65 }}>
            Join advocates using Lawdger to run a sharper, faster, better-organised practice.
          </p>
          <Link
            href="/dashboard"
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 0 60px rgba(243,225,215,.5)";
              el.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 0 30px rgba(243,225,215,.22)";
              el.style.transform = "";
            }}
            style={{
              display:"inline-flex", alignItems:"center", gap:10,
              background:"#F3E1D7", color:"#070707",
              fontWeight:700, fontSize:16,
              padding:"17px 38px", borderRadius:99,
              textDecoration:"none",
              boxShadow:"0 0 30px rgba(243,225,215,.22)",
              transition:"box-shadow .25s, transform .25s",
            }}
          >
            Open Lawdger — it&apos;s free
            <ArrowRight style={{ width:18, height:18 }} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background:"#050505", borderTop:"1px solid rgba(255,255,255,.05)",
        padding:"32px 0",
      }}>
        <div style={{
          maxWidth:1280, margin:"0 auto", padding:"0 40px",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(243,225,215,.08)", border:"1px solid rgba(243,225,215,.12)",
            }}>
              <Scale style={{ width:13, height:13, color:"#F3E1D7" }} />
            </div>
            <span className="font-serif" style={{ fontSize:16, fontWeight:600, color:"#F6F6F6" }}>Lawdger</span>
            <span style={{ fontSize:13, color:"#2a2a2f", fontWeight:300, marginLeft:6 }}>Legal Second Brain for Indian Advocates</span>
          </div>
          <p style={{ fontSize:12, color:"#2a2a2f", fontWeight:300 }}>
            © {new Date().getFullYear()} Lawdger. Built with ♥ for the Indian Bar.
          </p>
        </div>
      </footer>
    </div>
  );
}
