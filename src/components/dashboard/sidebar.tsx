'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, BookOpen } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: 'https://github.com/DisruptionEngineer/med-attest#partner-integration',
    label: 'Integration guide',
    icon: BookOpen,
    external: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-[#111118] border-r border-[#2a2a38] flex flex-col min-h-screen text-[#e8e8ed]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="w-4 h-4"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </div>
        <span className="text-base font-extrabold tracking-tight">med-attest</span>
      </div>

      <nav className="flex-1 py-2">
        <div className="px-3 space-y-1">
          {navItems.map((item) => {
            const active = !item.external && pathname === item.href;
            const Icon = item.icon;
            const className = `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-indigo-500/10 text-indigo-300'
                : 'text-[#8888a0] hover:bg-[#1a1a24] hover:text-[#e8e8ed]'
            }`;
            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={className}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            }
            return (
              <Link key={item.label} href={item.href} className={className}>
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[#2a2a38] px-5 py-4 flex items-center justify-between">
        <UserButton afterSwitchSessionUrl="/dashboard" />
        <span className="text-[10px] text-[#555568]">pilot research preview</span>
      </div>
    </aside>
  );
}
