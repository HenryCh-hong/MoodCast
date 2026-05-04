// components/landing/Hero.tsx
import Link from 'next/link';
import { OnAirDot } from '@/components/ui/OnAirDot';

export function Hero() {
  return (
    <section className="px-6 pt-16 pb-12 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 items-start">

        {/* Left: text content */}
        <div className="pt-2">
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-mc-lo mb-8 flex items-center gap-2">
            <span>Moodcast Radio Engine</span>
            <span className="text-mc-dim">·</span>
            <span>v0.1.0</span>
          </div>

          <h1 className="text-[clamp(2.6rem,5vw,3.8rem)] font-extrabold tracking-[-0.03em] leading-[1.06] mb-6">
            Your mood.<br />
            Your session.<br />
            <em className="text-mc-lav not-italic">Your signal.</em>
          </h1>

          <p className="text-mc-mid text-base leading-relaxed max-w-sm mb-9">
            Moodcast is an open-source AI DJ. Tell it how you feel — get an opening
            monologue, a curated queue, and transition lines between every track.
            No streaming. Bring your own API key.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 bg-mc-lav text-[#1a1228] font-bold text-sm px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Create a Session
            </Link>
            <Link
              href="/session/demo-debugging"
              className="inline-flex items-center gap-2 border border-mc-border text-mc-mid font-mono text-xs px-6 py-3 rounded-lg hover:border-mc-lav hover:text-mc-lav transition-colors"
            >
              ⟳ Try Demo Mode
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-mc-lo tracking-[0.12em] uppercase">
            <span className="flex items-center gap-1.5">
              <OnAirDot />
              <span className="text-mc-onair">On Air</span>
            </span>
            <span className="text-mc-dim">·</span>
            <span>FM 88.7</span>
            <span className="text-mc-dim">·</span>
            <span>No Streaming</span>
            <span className="text-mc-dim">·</span>
            <span>BYOK</span>
          </div>
        </div>

        {/* Right: broadcast terminal panel */}
        <div
          className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden font-mono text-xs"
          style={{ boxShadow: '0 0 40px rgba(184,160,216,0.04)' }}
        >
          {/* Terminal chrome */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-mc-border bg-mc-elevated">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-mc-lo" />
              <span className="w-2.5 h-2.5 rounded-full bg-mc-lo" />
              <span className="w-2.5 h-2.5 rounded-full bg-mc-lo" />
            </div>
            <span className="text-mc-lo text-[9px] tracking-[0.1em]">moodcast — radio engine</span>
          </div>

          {/* Terminal body */}
          <div className="p-5 space-y-px leading-[1.7]">
            <p>
              <span className="text-mc-lo">$</span>{' '}
              <span className="text-mc-hi">moodcast start</span>
            </p>

            <div className="h-2" />

            <p className="text-mc-lav font-semibold">Moodcast Radio Engine</p>
            <p className="text-mc-lo">listening on :3001</p>

            <div className="h-1" />

            <p>
              <span className="text-mc-sage">●</span>{' '}
              <span className="text-mc-mid">session profile loaded</span>
            </p>
            <p>
              <span className="text-mc-sage">●</span>{' '}
              <span className="text-mc-mid">AI DJ voice ready</span>
            </p>
            <p>
              <span className="text-mc-lav">●</span>{' '}
              <span className="text-mc-mid">demo mode active</span>
            </p>
            <p>
              <span className="text-mc-sage">●</span>{' '}
              <span className="text-mc-mid">local memory ready</span>
            </p>

            <div className="h-2" />

            <p className="text-mc-hi">Now tuning...</p>
            <p>
              <span className="text-mc-lo">mood:</span>{' '}
              <span className="text-mc-mid">tired / focused / not fully settled</span>
            </p>
            <p>
              <span className="text-mc-lo">activity:</span>{' '}
              <span className="text-mc-mid">coding</span>
            </p>
            <p>
              <span className="text-mc-lo">signal:</span>{' '}
              <span className="text-mc-mid">medium-low</span>
            </p>
            <p>
              <span className="text-mc-lo">arc:</span>{' '}
              <span className="text-mc-mid">opening → focus → peak → landing</span>
            </p>

            <div className="h-2" />

            <p className="text-mc-mid">
              Generating opening monologue
              <span className="text-mc-lo">...</span>
            </p>
            <p className="text-mc-mid">Queue seeded.</p>

            <div className="h-2" />

            <p className="text-mc-coral font-semibold">Broadcast ready.</p>

            <div className="h-1" />

            <p className="flex items-center gap-1.5">
              <OnAirDot className="w-1.5 h-1.5" />
              <span className="text-mc-onair font-semibold tracking-[0.14em]">ON AIR</span>
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
