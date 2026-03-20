'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-base font-extrabold tracking-tight text-gray-900">
          OliveYoung Tracker
        </span>
        <div className="flex gap-1">
          {[
            { href: '/dashboard', label: '대시보드' },
            { href: '/admin', label: '어드민' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-[#6366F1] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
