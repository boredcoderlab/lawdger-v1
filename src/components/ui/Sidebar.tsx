"use client";

import type { ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  LayoutGrid,
  Calendar as CalIcon,
  CheckSquare,
  Settings,
  Moon,
  LogOut,
  Wallet,
  Brain,
} from "lucide-react";
import { signOut } from "next-auth/react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ElementType;
  alert?: boolean;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard",   href: "/dashboard",  icon: Home },
  { id: "inbox",     label: "Inbox",       href: "/inbox",      icon: Inbox, alert: true },
  { id: "cases",     label: "Cases",       href: "/cases",      icon: LayoutGrid },
  { id: "calendar",  label: "Calendar",    href: "/calendar",   icon: CalIcon },
  { id: "tasks",     label: "Tasks",       href: "/tasks",      icon: CheckSquare },
  { id: "finances",  label: "Finances",    href: "/finances",   icon: Wallet },
  { id: "chat",      label: "Legal Brain", href: "/chat",       icon: Brain },
  { id: "settings",  label: "Settings",    href: "/settings",   icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <aside className="w-24 h-[calc(100vh-3rem)] bg-lawdger-espresso rounded-[2.5rem] flex flex-col items-center py-6 relative z-50 shadow-[0_20px_60px_rgba(44,36,32,0.12)] border border-white/5 my-6 ml-6 shrink-0">
      
      {/* Brand Anchor */}
      <Link
        href="/dashboard"
        className="w-12 h-12 bg-lawdger-base rounded-[14px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.9)] mb-10 hover:scale-105 transition-transform duration-300 relative z-20"
      >
        <Image
          src="/lawdger-logo-transparent.png"
          alt="Lawdger Logo"
          width={34}
          height={34}
          className="object-contain w-auto h-auto drop-shadow-md"
          priority
        />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col w-full relative items-center">
          {activeIndex >= 0 && (
            <div
              className="absolute w-14 h-14 bg-lawdger-base rounded-[14px] transition-transform duration-500 ease-out z-0 shadow-[0_8px_16px_rgba(0,0,0,0.2)]"
              style={{ transform: `translateY(${activeIndex * 72}px)` }}
            />
          )}

          {navItems.map((item, index) => {
            const isActive = activeIndex === index;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className="relative z-10 w-full h-14 flex items-center justify-center cursor-pointer group mb-4 last:mb-0"
              >
                <item.icon
                  size={22}
                  className={`transition-all duration-500 ${
                    isActive
                      ? "text-lawdger-espresso scale-110 drop-shadow-sm"
                      : "text-[#8A8078] group-hover:text-[#D4C9C0] group-hover:scale-110"
                  }`}
                />
                {item.alert && (
                  <span
                    className={`absolute top-3 right-5 w-2.5 h-2.5 bg-destructive rounded-full border-[2.5px] transition-colors duration-500 ${
                      isActive ? "border-lawdger-base" : "border-lawdger-espresso"
                    }`}
                  />
                )}
              </Link>
            );
          })}
      </nav>

      {/* Bottom Utility */}
      <div className="flex flex-col gap-6 w-full items-center mt-auto relative z-20">
        <Moon strokeWidth={1.5} size={22} className="text-[#8A8078]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-[#8A8078] hover:text-[#D4C9C0] transition-colors cursor-pointer"
          aria-label="Sign out"
        >
          <LogOut strokeWidth={1.5} size={22} />
        </button>
        <div className="w-10 h-10 rounded-full bg-[#1A1512] flex items-center justify-center text-lawdger-base text-sm font-bold shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border border-[#3D332D] mt-2 cursor-pointer hover:ring-2 hover:ring-white/10 transition-all">
          SJ
        </div>
      </div>
    </aside>
  );
}