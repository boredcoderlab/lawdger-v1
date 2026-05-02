'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Home, Briefcase, Calendar, CheckSquare, Settings, IndianRupee, Sparkles, Search, LogOut } from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Legal Brain', href: '/chat', icon: Sparkles },
  { name: 'Cases', href: '/cases', icon: Briefcase },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Finances', href: '/finances', icon: IndianRupee },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-card/60 backdrop-blur-xl z-20 shadow-[10px_0_30px_rgba(0,0,0,0.2)]">
      <div className="flex h-20 items-center px-6 border-b border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-12 w-12 rounded-xl overflow-hidden shadow-sm border border-white/10">
            <Image src="/lawdger-logo.png" alt="Lawdger" fill className="object-cover" priority />
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight text-foreground">Lawdger</span>
        </Link>
      </div>

      <div className="px-6 py-6 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-black/20 border border-white/5 rounded-full pl-10 pr-4 py-2.5 text-sm font-light focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pb-4">
        <nav className="flex-1 space-y-1.5 px-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_12px_rgba(243,225,215,0.08)]'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                    isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                  aria-hidden="true"
                />
                {item.name}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/5 px-4 py-4">
        <ThemeToggle placement="inline" />
        <button
          type="button"
          onClick={handleSignOut}
          className="group flex w-full items-center rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
        >
          <LogOut
            className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
          Sign Out
        </button>
      </div>
    </div>
  );
}
