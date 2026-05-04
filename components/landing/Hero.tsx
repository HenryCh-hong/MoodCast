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
      <span className="font-mono text-[7px] text-mc-lo leading-none whitespace-nowrap">{label}</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative px-6 pt-12 pb-16 max-w-6xl mx-auto overflow-visible">

      {/* Ambient glow — upper right, behind the console */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '-10%',
          right: '-8%',
          width: '60%',
          height: '80%',
          background:
            'radial-gradient(ellipse at 65% 25%, rgba(184,160,216,0.08) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: '0',
          left: '30%',
          width: '40%',
          height: '50%',
          background:
            'radial-gradient(ellipse at 50% 80%, rgba(212,133,106,0.04) 0%, transparent 60%)',
          zIndex: 0,
        }}
      />

      {/* System eyebrow bar */}
      <div className="relative z-10 flex items-center gap-2 sm:gap-3 font-mono text-[9px] text-mc-lo tracking-[0.16em] uppercase mb-10 border-b border-mc-border pb-4">
        <span className="text-mc-mid">Moodcast</span>
        <span className="text-mc-dim">·</span>
        <span>v0.1.0</span>
        <span className="text-mc-dim">·</span>
        <span className="flex items-center gap-1.5">
          <OnAirDot className="w-1.5 h-1.5" />
          <span className="text-mc-onair">On Air</span>
        </span>
        <span className="text-mc-dim">·</span>
        <span>FM 88.7</span>
        <span className="flex-1" />
        <span className="text-mc-dim hidden sm:inline">demo session active</span>
      </div>

      {/* Main grid: fixed-width left + flexible right */}
      <div className="relative z-10 grid lg:grid-cols-[360px_1fr] gap-10 xl:gap-14 items-start">

        {/* ── Left column ────────────────────────────────── */}
        <div className="flex flex-col gap-7">
          <h1 className="text-[clamp(2rem,3.6vw,2.9rem)] font-extrabold tracking-[-0.03em] leading-[1.08]">
            Turn the feeling<br />
            into a signal.
          </h1>

          <p className="text-mc-mid text-[15px] leading-relaxed">
            Open-source AI radio sessions, tuned to your mood. An AI DJ writes
            the opening monologue, curates the queue, and connects every track.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 bg-mc-lav text-[#1a1228] font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Create a Session
            </Link>
            <Link
              href="/session/demo-debugging"
              className="inline-flex items-center gap-2 border border-mc-border text-mc-mid font-mono text-[10px] tracking-[0.06em] px-5 py-2.5 rounded-lg hover:border-mc-lav hover:text-mc-lav transition-colors"
            >
              ⟳ Demo Mode
            </Link>
          </div>

          {/* System terminal status */}
          <div className="bg-mc-elevated border border-mc-border rounded-lg p-3.5 font-mono text-[10px] space-y-1.5 text-mc-mid">
            <p className="font-mono text-[8px] tracking-[0.16em] uppercase text-mc-lo mb-2.5">
              System
            </p>
            <p><span className="text-mc-sage">●</span> AI DJ voice ready</p>
            <p><span className="text-mc-lav">●</span> demo mode active</p>
            <p>
              <span className="text-mc-lo">○</span>{' '}
              <span className="text-mc-lo">ANTHROPIC_API_KEY not set</span>
            </p>
            <p className="text-mc-lo text-[9px] pt-1.5 mt-0.5 border-t border-mc-border">
              No key? Runs in demo mode automatically.
            </p>
          </div>
        </div>

        {/* ── Right column: broadcast console ─────────────── */}
        <div className="relative">

          {/* Depth layer: offset terminal card peeking behind */}
          <div
            className="absolute inset-0 bg-mc-elevated border border-mc-border rounded-xl font-mono text-[10px] text-mc-lo overflow-hidden"
            style={{ transform: 'translate(8px, 8px)', zIndex: 0 }}
          >
            {/* Only visible at right/bottom edges — sets depth context */}
            <div className="p-4 space-y-1 opacity-60">
              <p><span className="text-mc-mid">$</span> moodcast start</p>
              <p><span className="text-mc-sage">●</span> session profile loaded</p>
              <p><span className="text-mc-sage">●</span> AI DJ voice ready</p>
              <p className="text-mc-coral">Broadcast ready.</p>
            </div>
          </div>

          {/* Main broadcast console card with gradient border */}
          <div
            className="relative rounded-xl p-px"
            style={{
              zIndex: 10,
              background:
                'linear-gradient(135deg, rgba(184,160,216,0.28) 0%, rgba(33,29,43,0.6) 45%, rgba(212,133,106,0.18) 100%)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            <div className="bg-mc-surface rounded-[11px] overflow-hidden">

              {/* Header: ON AIR + session name + waveform + FM */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border bg-mc-elevated">
                <div className="flex items-center gap-3 min-w-0">
                  <OnAirDot />
                  <span className="font-mono text-[9px] font-semibold tracking-[0.18em] uppercase text-mc-onair shrink-0">
                    On Air
                  </span>
                  <span className="text-mc-dim font-mono text-[9px]">·</span>
                  <span className="text-sm font-semibold text-mc-hi truncate">
                    Late Night Debugging FM
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <WaveformStrip />
                  <span className="font-mono text-[9px] text-mc-lo">FM 88.7</span>
                </div>
              </div>

              {/* Body: two columns — monologue left, queue right */}
              <div className="grid sm:grid-cols-[1.05fr_1fr] divide-y sm:divide-y-0 sm:divide-x divide-mc-border">

                {/* AI DJ Opening */}
                <div className="p-4 lg:p-5">
                  <p className="font-mono text-[9px] text-mc-lo tracking-[0.14em] uppercase mb-3">
                    AI DJ · Opening
                  </p>
                  <p className="text-[13px] text-mc-mid italic leading-[1.7] mb-4">
                    &ldquo;It&rsquo;s late. The screen is still too bright, and
                    you&rsquo;ve got one more thing to finish — the kind of
                    thing that keeps you up not because it has to, but because
                    you need it to feel right before you can sleep.&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['tired', 'melancholic', 'coding', '45 min'].map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[8px] tracking-[0.06em] px-2 py-0.5 border border-mc-border rounded text-mc-lo"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Track Queue */}
                <div className="p-4 lg:p-5">
                  <p className="font-mono text-[9px] text-mc-lo tracking-[0.14em] uppercase mb-3">
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
                          <p className="text-[13px] font-semibold text-mc-hi leading-tight">Holocene</p>
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
                        <p className="text-[13px] font-semibold text-mc-hi leading-tight">Night Owl</p>
                        <p className="font-mono text-[9px] text-mc-lo">Khruangbin</p>
                      </div>
                    </div>

                    {/* CUE 3 */}
                    <div className="flex items-start gap-2 opacity-35">
                      <span className="font-mono text-[9px] text-mc-mid font-bold w-9 shrink-0 pt-px">
                        CUE 3
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-mc-hi leading-tight truncate max-w-[140px]">
                          Motion Picture Soundtrack
                        </p>
                        <p className="font-mono text-[9px] text-mc-lo">Radiohead</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Footer: session arc */}
              <div className="px-4 lg:px-5 py-3 border-t border-mc-border bg-mc-elevated">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[9px] text-mc-lo tracking-[0.08em] shrink-0 mt-[3px]">
                    arc
                  </span>
                  <div className="flex items-start flex-1 gap-0">
                    <ArcNode label="Opening" active />
                    <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1" />
                    <ArcNode label="Focus Zone" />
                    <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1" />
                    <ArcNode label="Peak" />
                    <span className="flex-1 h-px bg-mc-border mt-[3px] mx-1" />
                    <ArcNode label="Landing" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
