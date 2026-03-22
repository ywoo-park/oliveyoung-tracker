'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-mood-feather/10 bg-mood-ice/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-mood-feather transition-opacity hover:opacity-90"
        >
          <Image
            src="/bm-insight-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
            priority
          />
          <span className="text-base font-extrabold tracking-tight">BM Insight Tracker</span>
        </Link>
        <div className="flex gap-1">
          {[
            { href: '/', label: '리뷰 인사이트' },
            { href: '/dashboard', label: '대시보드' },
            { href: '/admin', label: '어드민' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(href)
                  ? 'bg-mood-oasis text-mood-feather shadow-sm shadow-mood-oasis/30'
                  : 'text-mood-feather/60 hover:bg-mood-oasis/25 hover:text-mood-feather'
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
