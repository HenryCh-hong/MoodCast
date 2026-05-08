'use client';

// Tiny waveform-shaped indicator used inside the MOOC CUE card while the
// browser TTS engine is actively speaking. Pure CSS — no canvas, no audio
// peak metering — but it's enough to communicate "MooC speaking" without
// shouting. Falls back to a static dot when no animation can run.

interface SpeakingIndicatorProps {
  active: boolean;
  /** Optional label (defaults to "MooC speaking" when active). */
  label?: string;
}

const BAR_COUNT = 4;
// Stable per-bar delays so the bars never sync into a flat line.
const DELAYS = ['0s', '0.18s', '0.36s', '0.12s'];

export function SpeakingIndicator({ active, label }: SpeakingIndicatorProps) {
  const text = active ? (label ?? 'MooC speaking') : (label ?? 'MOOC CUE');

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-end gap-[2px] h-3" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className={
              'inline-block w-[2px] rounded-sm bg-mc-lav ' +
              (active ? 'animate-waveform' : 'opacity-30')
            }
            style={{
              animationDelay: active ? DELAYS[i % DELAYS.length] : undefined,
              height: active ? '100%' : '40%',
            }}
          />
        ))}
      </span>
      <span
        className={
          'text-[8px] font-mono tracking-[0.18em] uppercase ' +
          (active ? 'text-mc-lav' : 'text-mc-lo')
        }
      >
        {text}
      </span>
    </span>
  );
}
