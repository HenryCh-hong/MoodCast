// components/landing/Hero.tsx
import Link from 'next/link';
import { OnAirDot } from '@/components/ui/OnAirDot';

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-16 max-w-6xl mx-auto">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 60% 0%, rgba(184,160,216,0.06) 0%, transparent 60%), radial-gradient(ellipse at 5% 80%, rgba(212,133,106,0.04) 0%, transparent 50%)',
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-6">
          <OnAirDot />
          <span className="text-[10px] font-mono font-semibold tracking-[0.16em] uppercase text-mc-onair">
            On Air
          </span>
          <span className="text-mc-dim font-mono text-[10px] ml-2">FM 88.7</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-[-0.03em] leading-[1.05] mb-5 max-w-2xl">
          Turn your mood into a{' '}
          <em className="text-mc-lav not-italic">personal radio</em> session.
        </h1>

        <p className="text-mc-mid text-lg leading-relaxed max-w-xl mb-10">
          Moodcast is an open-source AI DJ. Tell it how you feel. Get an opening
          monologue, a curated queue, and transition lines between every track.
          No streaming. No accounts. Bring your own API key.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 bg-mc-lav text-[#1a1228] font-bold text-sm px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Create a Session
          </Link>
          <Link
            href="/session/demo-debugging"
            className="inline-flex items-center gap-2 border border-mc-border text-mc-mid text-sm px-6 py-3 rounded-lg hover:border-mc-lav hover:text-mc-lav transition-colors"
          >
            Try Demo Mode
          </Link>
        </div>
      </div>
    </section>
  );
}
