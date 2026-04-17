import Link from 'next/link';
import { Home, Briefcase, Calendar, CheckSquare, Settings, IndianRupee, Sparkles } from 'lucide-react';

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
  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Lawdger
        </h1>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-6 pb-4">
        <nav className="flex-1 space-y-2 px-4">
          {navigation.map((item) => {
            return (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
