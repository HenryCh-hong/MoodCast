'use client';

// Collapsible settings tray inside the FloatingDJCompanion footer.
// Replaces the old "voice cues are coming later" stub with real controls
// for browser TTS voice transitions and the purple ambient stage.
//
// Keeps a low UI footprint when collapsed (one row); expands inline.
// Reads/writes via lib/storage/preferencesClient (localStorage).

import { useEffect, useMemo, useState } from 'react';
import { useDJVoice } from '@/lib/hooks/useDJVoice';
import { readPreferences, writePreferences } from '@/lib/storage/preferencesClient';
import type {
  MoodcastPreferences,
  VoiceMode,
  AmbientIntensity,
} from '@/lib/types/preferences';

const VOICE_MODES: Array<{ id: VoiceMode; label: string }> = [
  { id: 'off', label: 'off' },
  { id: 'transitions', label: 'transitions' },
  { id: 'welcome+transitions', label: 'welcome + transitions' },
];

const AMBIENT_INTENSITIES: Array<{ id: AmbientIntensity; label: string }> = [
  { id: 'low', label: 'low' },
  { id: 'medium', label: 'med' },
  { id: 'high', label: 'high' },
];

const TEST_LINE = 'Voice check — keeping it close to your taste tonight.';

interface MoocSettingsPanelProps {
  /** Optional initial expansion state — defaults to collapsed. */
  defaultOpen?: boolean;
}

function loadPrefs(): MoodcastPreferences {
  return readPreferences();
}

export function MoocSettingsPanel({ defaultOpen = false }: MoocSettingsPanelProps) {
  const voice = useDJVoice();
  const [open, setOpen] = useState(defaultOpen);
  const [prefs, setPrefs] = useState<MoodcastPreferences | null>(null);

  // Hydrate prefs after mount so SSR HTML stays stable. The setState lives
  // inside an async callback so the React 19 set-state-in-effect rule passes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setPrefs(loadPrefs());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<MoodcastPreferences>) => {
    const merged = writePreferences(patch);
    setPrefs(merged);
  };

  const summaryLine = useMemo(() => {
    if (!prefs) return 'voice & ambient — loading';
    const v = !prefs.voiceEnabled || prefs.voiceMode === 'off'
      ? 'voice off'
      : `voice ${prefs.voiceMode === 'transitions' ? 'on' : 'on+welcome'} · vol ${prefs.voiceVolume}`;
    const a = prefs.ambientLightingEnabled
      ? `ambient ${prefs.ambientIntensity}`
      : 'ambient off';
    return `${v} · ${a}`;
  }, [prefs]);

  const handleTest = () => {
    if (!prefs) return;
    voice.speak(TEST_LINE, {
      volume: prefs.voiceVolume,
      rate: prefs.voiceRate,
      voiceName: prefs.preferredVoiceName,
      lang: 'en',
    });
  };

  return (
    <div className="px-4 pb-2.5 select-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[8px] font-mono text-mc-lo tracking-[0.12em] uppercase hover:text-mc-mid transition-colors"
        aria-expanded={open}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>voice & ambient</span>
        <span className="text-mc-dim normal-case tracking-tight">·</span>
        <span className="text-mc-dim normal-case tracking-tight">{summaryLine}</span>
      </button>

      {open && prefs && (
        <div className="mt-2 space-y-3 pt-2 border-t border-mc-border">
          {/* ── Voice ────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-mc-lo">
                MooC voice
              </span>
              <button
                onClick={() => update({ voiceEnabled: !prefs.voiceEnabled })}
                className={
                  'text-[9px] font-mono tracking-[0.12em] uppercase border rounded px-2 py-0.5 transition-colors ' +
                  (prefs.voiceEnabled
                    ? 'border-mc-lav text-mc-lav bg-[rgba(184,160,216,0.1)]'
                    : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                }
              >
                {prefs.voiceEnabled ? 'on' : 'off'}
              </button>
            </div>
            {!voice.isAvailable && (
              <p className="text-[9px] font-mono text-mc-onair/80 mb-1.5">
                speechSynthesis unavailable · text-only fallback
              </p>
            )}
            {/* Mode pills */}
            <div className="flex gap-1 mb-2">
              {VOICE_MODES.map((m) => {
                const active = prefs.voiceMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => update({ voiceMode: m.id })}
                    className={
                      'text-[9px] tracking-tight border rounded px-2 py-0.5 transition-colors ' +
                      (active
                        ? 'border-mc-lav text-mc-lav bg-[rgba(184,160,216,0.1)]'
                        : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {/* Volume + rate */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className="block">
                <span className="text-[8px] font-mono tracking-[0.18em] uppercase text-mc-lo block mb-0.5">
                  vol {prefs.voiceVolume}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={prefs.voiceVolume}
                  onChange={(e) => update({ voiceVolume: Number(e.target.value) })}
                  className="w-full accent-[#b8a0d8]"
                />
              </label>
              <label className="block">
                <span className="text-[8px] font-mono tracking-[0.18em] uppercase text-mc-lo block mb-0.5">
                  rate {prefs.voiceRate.toFixed(2)}
                </span>
                <input
                  type="range"
                  min={0.8}
                  max={1.2}
                  step={0.05}
                  value={prefs.voiceRate}
                  onChange={(e) => update({ voiceRate: Number(e.target.value) })}
                  className="w-full accent-[#b8a0d8]"
                />
              </label>
            </div>
            {/* Voice picker */}
            {voice.isAvailable && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[8px] font-mono tracking-[0.18em] uppercase text-mc-lo">voice</span>
                <select
                  value={prefs.preferredVoiceName ?? ''}
                  onChange={(e) => update({ preferredVoiceName: e.target.value || null })}
                  className="flex-1 bg-mc-surface border border-mc-border rounded px-1.5 py-0.5 text-[10px] text-mc-mid focus:outline-none focus:border-mc-lav"
                >
                  <option value="">(default)</option>
                  {voice.voices
                    .filter((v) => v.lang.toLowerCase().startsWith('en'))
                    .map((v) => (
                      <option key={`${v.name}-${v.lang}`} value={v.name}>
                        {v.name} · {v.lang}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleTest}
                  disabled={!voice.isAvailable || !prefs.voiceEnabled || prefs.voiceMode === 'off'}
                  className="text-[9px] tracking-tight border border-mc-border rounded px-2 py-0.5 text-mc-lo hover:border-mc-mid hover:text-mc-mid disabled:opacity-40 transition-colors"
                >
                  test
                </button>
              </div>
            )}
          </section>

          {/* ── Ambient ──────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-mc-lo">
                on-air ambient
              </span>
              <button
                onClick={() => update({ ambientLightingEnabled: !prefs.ambientLightingEnabled })}
                className={
                  'text-[9px] font-mono tracking-[0.12em] uppercase border rounded px-2 py-0.5 transition-colors ' +
                  (prefs.ambientLightingEnabled
                    ? 'border-mc-lav text-mc-lav bg-[rgba(184,160,216,0.1)]'
                    : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                }
              >
                {prefs.ambientLightingEnabled ? 'on' : 'off'}
              </button>
            </div>
            <div className="flex gap-1">
              {AMBIENT_INTENSITIES.map((i) => {
                const active = prefs.ambientIntensity === i.id;
                return (
                  <button
                    key={i.id}
                    onClick={() => update({ ambientIntensity: i.id })}
                    disabled={!prefs.ambientLightingEnabled}
                    className={
                      'text-[9px] tracking-tight border rounded px-2 py-0.5 transition-colors disabled:opacity-40 ' +
                      (active
                        ? 'border-mc-lav text-mc-lav bg-[rgba(184,160,216,0.1)]'
                        : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                    }
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
