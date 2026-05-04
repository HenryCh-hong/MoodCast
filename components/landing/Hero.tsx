// components/landing/Hero.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { WaveformStrip } from '@/components/ui/WaveformStrip';

function ArcNode({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          active ? 'bg-mc-lav' : 'border border-mc-lo'
        )}
      />
      <span className="font-mono text-[7px] text-mc-lo leading-none">{label}</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative px-6 pt-10 pb-16 max-w-6xl mx-auto">

      {/* Atmospheric glow — behind the console, not part of it */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '-5%',
          right: '-6%',
          width: '55%',
          height: '80%',
          background:
            'radial-gradient(ellipse at 70% 20%, rgba(184,160,216,0.07) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: '5%',
          left: '10%',
          width: '40%',
          height: '40%',
          background:
            'radial-gradient(ellipse at 40% 80%, rgba(212,133,106,0.04) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />

      {/* ═══════════════════════════════════════════════
          THE UNIFIED CONSOLE — one object, all sections
          ═══════════════════════════════════════════════ */}
      <div
        className="relative rounded-2xl p-px"
        style={{
          zIndex: 10,
          background:
            'linear-gradient(135deg, rgba(184,160,216,0.22) 0%, rgba(33,29,43,0.55) 48%, rgba(212,133,106,0.14) 100%)',
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(184,160,216,0.05)',
        }}
      >
        <div className="bg-mc-surface rounded-[15px] overflow-hidden">

          {/* ── Header bar ────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-mc-border bg-mc-elevated font-mono text-[9px] tracking-[0.14em] uppercase">
            <OnAirDot className="w-1.5 h-1.5" />
            <span className="text-mc-onair">On Air</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-mid font-semibold">Moodcast</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-lo">v0.1.0</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-lo">FM 88.7</span>
            <span className="flex-1" />
            <span className="text-mc-dim hidden sm:inline">demo session active</span>
          </div>

          {/* ── Body: editorial left + session right ──────── */}
          <div className="grid lg:grid-cols-[2fr_3fr] divide-y lg:divide-y-0 lg:divide-x divide-mc-border">

            {/* Left: headline + copy + CTAs */}
            <div className="px-7 py-8 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <h1 className="text-4xl xl:text-[2.75rem] font-extrabold tracking-[-0.03em] leading-[1.07]">
                  Turn the feeling<br />
                  into a signal.
                </h1>
                <p className="text-mc-mid text-[15px] leading-relaxed">
                  Open-source AI radio sessions, tuned to your mood.
                  An AI DJ writes the opening, curates the queue, and
                  connects every track.
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/builder"
                    className="inline-flex items-center gap-2 bg-mc-lav text-[#1a1228] font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Create a Session
                  </Link>
                  <Link
                    href="/session/demo-debugging"
                    className="inline-flex items-center border border-mc-border text-mc-mid font-mono text-[10px] tracking-[0.06em] px-4 py-2.5 rounded-lg hover:border-mc-lav hover:text-mc-lav transition-colors"
                  >
                    ⟳ Demo Mode
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-mc-lo tracking-[0.1em] uppercase">
                  <span>No Streaming</span>
                  <span className="text-mc-dim">·</span>
                  <span>BYOK</span>
                  <span className="text-mc-dim">·</span>
                  <span>Open Source</span>
                </div>
              </div>
            </div>

            {/* Right: AI DJ session content */}
            <div className="divide-y divide-mc-border">

              {/* Monologue panel */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[9px] text-mc-lo tracking-[0.14em] uppercase">
                    AI DJ · Opening
                  </p>
                  <WaveformStrip />
                </div>
                <p className="text-[13px] text-mc-mid italic leading-[1.72]">
                  &ldquo;It&rsquo;s late. The screen is still too bright, and
                  you&rsquo;ve got one more thing to finish — the kind of thing
                  that keeps you up not because it has to, but because you need
                  it to feel right before you can sleep.&rdquo;
                </p>
              </div>

              {/* Track queue panel */}
              <div className="px-6 py-5">
                <p className="font-mono text-[9px] text-mc-lo tracking-[0.14em] uppercase mb-4">
                  Track Queue
                </p>
                <div className="space-y-3.5">

                  {/* NOW */}
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[9px] text-mc-lav font-bold w-9 shrink-0 pt-px">
                        NOW
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-mc-hi leading-tight">
                          Holocene
                        </p>
                        <p className="font-mono text-[9px] text-mc-lo">Bon Iver</p>
                      </div>
                    </div>
                    <p className="font-mono text-[9px] text-mc-lo mt-1.5 pl-11 leading-snug">
                      ↳ The next one keeps the stillness going.
                    </p>
                  </div>

                  {/* NEXT */}
                  <div className="flex items-start gap-2 opacity-65">
                    <span className="font-mono text-[9px] text-mc-mid font-bold w-9 shrink-0 pt-px">
                      NEXT
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-mc-hi leading-tight">
                        Night Owl
                      </p>
                      <p className="font-mono text-[9px] text-mc-lo">Khruangbin</p>
                    </div>
                  </div>

                  {/* CUE 3 */}
                  <div className="flex items-start gap-2 opacity-35">
                    <span className="font-mono text-[9px] text-mc-mid font-bold w-9 shrink-0 pt-px">
                      CUE 3
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-mc-hi leading-tight truncate max-w-[180px]">
                        Motion Picture Soundtrack
                      </p>
                      <p className="font-mono text-[9px] text-mc-lo">Radiohead</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────── */}
          <div className="border-t border-mc-border bg-mc-elevated divide-y divide-mc-border">

            {/* Session arc strip */}
            <div className="px-5 py-3 flex items-start gap-4">
              <span className="font-mono text-[9px] text-mc-lo tracking-[0.08em] shrink-0 mt-[3px]">
                arc
              </span>
              <div className="flex items-start flex-1">
                <ArcNode label="Opening" active />
                <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1.5" />
                <ArcNode label="Focus Zone" />
                <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1.5" />
                <ArcNode label="Peak" />
                <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1.5" />
                <ArcNode label="Landing" />
              </div>
            </div>

            {/* System status line */}
            <div className="px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[9px] text-mc-lo">
              <span>
                <span className="text-mc-sage">●</span> session profile loaded
              </span>
              <span>
                <span className="text-mc-sage">●</span> AI DJ voice ready
              </span>
              <span>
                <span className="text-mc-lav">●</span> demo mode active
              </span>
              <span className="ml-auto">
                <span className="text-mc-dim">○</span>{' '}
                <span className="text-mc-dim">ANTHROPIC_API_KEY not set</span>
              </span>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
