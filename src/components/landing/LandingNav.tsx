"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";

export default function LandingNav() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      navRef.current?.classList.toggle("lp-nav-scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={navRef} style={{
      position:"fixed", top:0, left:0, right:0, zIndex:50,
      transition:"background .3s, border-color .3s, backdrop-filter .3s",
    }}>
      <div style={{
        maxWidth:1280, margin:"0 auto",
        padding:"0 40px", height:64,
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <Link href="/" style={{
          display:"flex", alignItems:"center", gap:10, textDecoration:"none",
        }}>
          <div style={{
            width:32, height:32, borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(243,225,215,.1)", border:"1px solid rgba(243,225,215,.18)",
          }}>
            <Scale style={{ width:16, height:16, color:"#F3E1D7" }} />
          </div>
          <span className="font-serif" style={{ fontSize:18, fontWeight:600, color:"#F6F6F6", letterSpacing:"-.01em" }}>
            Lawdger
          </span>
        </Link>

        <nav style={{ display:"flex", alignItems:"center", gap:32 }}>
          {[["Features","#features"],["How it works","#how-it-works"]].map(([label,href]) => (
            <a key={label} href={href} style={{
              fontSize:14, color:"#6b6b70", fontWeight:400,
              textDecoration:"none", letterSpacing:".01em",
              transition:"color .2s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#F6F6F6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#6b6b70"; }}
            >{label}</a>
          ))}
        </nav>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Link href="/dashboard" style={{
            fontSize:14, color:"#6b6b70", fontWeight:400,
            textDecoration:"none", padding:"8px 16px", borderRadius:99,
            transition:"color .2s, background .2s",
          }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "#F6F6F6"; el.style.background = "rgba(255,255,255,.05)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "#6b6b70"; el.style.background = "";
            }}
          >
            Sign in
          </Link>
          <Link href="/dashboard"
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 0 30px rgba(243,225,215,.4)";
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 0 16px rgba(243,225,215,.15)";
              el.style.transform = "";
            }}
            style={{
              fontSize:14, fontWeight:700, color:"#070707",
              background:"#F3E1D7", padding:"9px 20px", borderRadius:99,
              textDecoration:"none",
              boxShadow:"0 0 16px rgba(243,225,215,.15)",
              transition:"box-shadow .25s, transform .25s",
            }}
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}
