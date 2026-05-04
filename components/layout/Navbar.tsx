// components/layout/Navbar.tsx
import Link from 'next/link';
import { OnAirDot } from '@/components/ui/OnAirDot';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-mc-surface border-b border-mc-border">
      <div className="max-w-6xl mx-auto px-6 h-11 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-mc-hi tracking-wide">
            mood<span className="text-mc-lav">cast</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <OnAirDot />
            <span className="text-[10px] font-mono font-semibold tracking-[0.14em] uppercase text-mc-onair">
              On Air
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-[11px] font-mono tracking-[0.06em] text-mc-lo">
          <Link href="/builder" className="hover:text-mc-mid transition-colors">New Session</Link>
          <Link href="/saved" className="hover:text-mc-mid transition-colors">Saved</Link>
          <a
            href="https://github.com/your-org/moodcast"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-mc-mid transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
