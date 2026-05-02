"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import LiveDemo from "./LiveDemo";

const TRUST = ["Free on solo plan", "No credit card needed", "Hindi + English support"];

export default function LandingHero() {
  return (
    <section style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      background: "#070707",
      overflow: "hidden",
      paddingTop: 64,
    }}>

      {/* ── Aurora orbs ─────────────────────────────── */}
      <div className="lp-orb-a" style={{
        position:"absolute", top:"-15%", right:"-5%",
        width:700, height:700, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(45,212,191,.13) 0%, transparent 70%)",
        filter:"blur(60px)", pointerEvents:"none",
      }} />
      <div className="lp-orb-b" style={{
        position:"absolute", bottom:"-20%", left:"-10%",
        width:600, height:600, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(243,225,215,.07) 0%, transparent 70%)",
        filter:"blur(80px)", pointerEvents:"none",
      }} />

      {/* ── Subtle grid ─────────────────────────────── */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)",
        backgroundSize:"52px 52px",
        maskImage:"radial-gradient(ellipse 80% 80% at 60% 40%, black 20%, transparent 75%)",
        WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 60% 40%, black 20%, transparent 75%)",
      }} />

      {/* ── Content ─────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10,
        maxWidth:1280, margin:"0 auto",
        padding:"60px 40px 80px",
        width:"100%",
        display:"grid",
        gridTemplateColumns:"55fr 45fr",
        gap:60,
        alignItems:"center",
      }}>

        {/* LEFT: Text */}
        <div>
          {/* Badge */}
          <div className="lp-1" style={{
            display:"inline-flex", alignItems:"center", gap:8,
            border:"1px solid rgba(45,212,191,.22)",
            background:"rgba(45,212,191,.06)",
            borderRadius:99, padding:"6px 14px",
            marginBottom:32,
          }}>
            <div className="lp-rec" style={{
              width:7, height:7, borderRadius:"50%",
              background:"#2dd4bf",
              boxShadow:"0 0 8px rgba(45,212,191,.9)",
            }} />
            <span style={{ fontSize:11, fontWeight:700, color:"#2dd4bf", letterSpacing:".07em", textTransform:"uppercase" }}>
              Built for Indian Advocates
            </span>
          </div>

          {/* H1 */}
          <h1 className="lp-2 font-serif" style={{
            fontSize:"clamp(3.2rem, 5.8vw, 5.5rem)",
            fontWeight:600, lineHeight:1.03,
            letterSpacing:"-.025em",
            color:"#F6F6F6",
            marginBottom:10,
          }}>
            Your practice,
          </h1>
          <h1 className="lp-2 font-serif lp-shimmer" style={{
            fontSize:"clamp(3.2rem, 5.8vw, 5.5rem)",
            fontWeight:600, lineHeight:1.03,
            letterSpacing:"-.025em",
            marginBottom:30,
            display:"block",
          }}>
            perfected.
          </h1>

          {/* Subtitle */}
          <p className="lp-3" style={{
            fontSize:"clamp(1rem, 1.6vw, 1.18rem)",
            color:"#6b6b70", fontWeight:300,
            lineHeight:1.72, maxWidth:460,
            marginBottom:44,
          }}>
            Dictate case notes in your own words. Lawdger&apos;s AI extracts
            hearings, tasks, and deadlines — and files them to the right case
            automatically. No typing. No forgetting.
          </p>

          {/* CTAs */}
          <div className="lp-4" style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:40 }}>
            <Link
              href="/dashboard"
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 0 50px rgba(243,225,215,.5), 0 6px 24px rgba(0,0,0,.5)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 0 28px rgba(243,225,215,.22), 0 6px 24px rgba(0,0,0,.5)";
                el.style.transform = "";
              }}
              style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"#F3E1D7", color:"#070707",
                fontWeight:700, fontSize:15,
                padding:"15px 30px", borderRadius:99,
                textDecoration:"none",
                boxShadow:"0 0 28px rgba(243,225,215,.22), 0 6px 24px rgba(0,0,0,.5)",
                transition:"box-shadow .25s, transform .25s",
              }}
            >
              Start for free
              <ArrowRight style={{ width:16, height:16 }} />
            </Link>

            <a
              href="#how-it-works"
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "rgba(255,255,255,.2)";
                el.style.color = "#F6F6F6";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "rgba(255,255,255,.1)";
                el.style.color = "#6b6b70";
              }}
              style={{
                display:"inline-flex", alignItems:"center", gap:8,
                border:"1px solid rgba(255,255,255,.1)", color:"#6b6b70",
                fontWeight:500, fontSize:14,
                padding:"14px 24px", borderRadius:99,
                textDecoration:"none",
                transition:"border-color .2s, color .2s",
              }}
            >
              See how it works
            </a>
          </div>

          {/* Trust strip */}
          <div className="lp-5" style={{ display:"flex", flexWrap:"wrap", gap:"10px 24px" }}>
            {TRUST.map((t) => (
              <div key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#3a3a3f", fontWeight:300 }}>
                <Check style={{ width:13, height:13, color:"#2dd4bf", flexShrink:0 }} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Live demo */}
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
          <LiveDemo />
        </div>
      </div>

      {/* Bottom fade */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:80, pointerEvents:"none",
        background:"linear-gradient(to bottom, transparent, #070707)",
      }} />
    </section>
  );
}
