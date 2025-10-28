'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'SQL Console' },
  { href: '/procedures', label: 'Stored Procedures' },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
