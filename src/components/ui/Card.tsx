import React from "react";
import { cn } from "@/lib/utils"; // Assuming you have standard tailwind merge utils, or we just use template literals

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "glass" | "solid" | "interactive";
}

export function Card({ children, className, variant = "solid", ...props }: CardProps) {
  const baseStyles = "rounded-[24px] border overflow-hidden transition-all duration-300";
  
  const variants = {
    // Crisp, solid card for dense data (like Finance or Cases)
    solid: "bg-white border-lawdger-espresso/10 shadow-[0_8px_30px_rgba(44,36,32,0.04)]",
    // Frosted, transparent card for high-level dashboard metrics
    glass: "bg-white/40 backdrop-blur-xl border-white/80 shadow-[0_8px_32px_rgba(44,36,32,0.04)]",
    // Hoverable card for clickable items (like Task items)
    interactive: "bg-white border-lawdger-espresso/10 shadow-sm hover:shadow-[0_20px_40px_rgba(44,36,32,0.08)] hover:-translate-y-1 hover:border-lawdger-gold/30 cursor-pointer"
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

// Sub-components to keep headers and footers mathematically consistent across all pages
export function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`px-6 py-5 border-b border-lawdger-espresso/5 flex items-center justify-between ${className || ""}`}>{children}</div>;
}

export function CardContent({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`p-6 ${className || ""}`}>{children}</div>;
}