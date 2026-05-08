'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Home, LayoutGrid, Calendar, Users, Settings, LogOut, CheckSquare, Inbox, Sun, Moon } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Cases', href: '/cases', icon: LayoutGrid },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="sticky top-4 left-4 flex h-[calc(100vh-2rem)] w-[90px] shrink-0 flex-col items-center py-8 ml-4 my-4 z-40 bg-[#291e16]/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[15px_0_50px_rgba(0,0,0,0.15)] border border-white/10 transition-colors">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center justify-center mb-10 group">
        <div className="relative h-12 w-12 drop-shadow-lg group-hover:scale-105 transition-transform">
          <Image src="/lawdger-logo.png" alt="Lawdger Logo" fill className="object-contain filter brightness-125 contrast-125" priority />
        </div>
      </Link>

      {/* Nav Icons */}
      <nav className="flex flex-1 flex-col items-center space-y-5 w-full">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative group flex items-center justify-center w-full"
              title={item.name}
            >
              <div
                className={`flex h-[50px] w-[50px] items-center justify-center rounded-[1.2rem] transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_0_25px_rgba(200,150,62,0.35)] scale-105'
                    : 'bg-transparent text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                <item.icon
                  className={`h-[22px] w-[22px] transition-all ${
                    isActive ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.name === 'Inbox' && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-[#291e16]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col items-center space-y-4 w-full">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle Theme"
          className="group flex h-[50px] w-[50px] items-center justify-center rounded-[1.2rem] transition-all duration-300 bg-transparent text-white/50 hover:text-white hover:bg-white/10"
        >
          {theme === 'dark' ? (
            <Sun className="h-[22px] w-[22px] transition-all group-hover:scale-110" strokeWidth={2} />
          ) : (
            <Moon className="h-[22px] w-[22px] transition-all group-hover:scale-110" strokeWidth={2} />
          )}
        </button>
        
        <button
          onClick={handleSignOut}
          title="Sign Out"
          className="group flex h-[50px] w-[50px] items-center justify-center rounded-[1.2rem] transition-all duration-300 bg-transparent text-white/50 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-[22px] w-[22px] transition-all group-hover:scale-110" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
