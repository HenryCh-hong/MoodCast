// components/layout/Navbar.tsx
import Link from 'next/link';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { SpotifyConnectButton } from '@/components/ui/SpotifyConnectButton';
import { NavDJController } from '@/components/layout/NavDJController';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-mc-surface border-b border-mc-border">
      <div className="max-w-6xl mx-auto px-6 h-11 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-bold text-sm text-mc-hi tracking-tight">
            mood<span className="text-mc-lav">cast</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <OnAirDot />
            <span className="text-[9px] font-mono font-semibold tracking-[0.18em] uppercase text-mc-onair">
              On Air
            </span>
          </div>
          <span className="text-[9px] font-mono text-mc-lo tracking-[0.1em]">FM 88.7</span>
          <NavDJController />
        </div>
        <nav className="flex items-center gap-5 text-[10px] tracking-[0.1em] uppercase text-mc-lo">
          <Link href="/builder" className="hover:text-mc-mid transition-colors">New Session</Link>
          <Link href="/saved" className="hover:text-mc-mid transition-colors">Saved</Link>
          <SpotifyConnectButton />
          <a
            href="https://github.com/your-org/moodcast"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-mc-mid transition-colors"
          >
            GitHub ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
