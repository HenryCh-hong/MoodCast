'use client';

// Singleton purple "on-air" ambient layer rendered behind the entire app.
//
// Reads MoodcastContext + preferences once per render, derives a LightingState
// (via lib/ambient/lightingState.ts), and paints two layered radial gradients
// that pulse on a slow heartbeat. Pointer-events-none + fixed inset, so it
// never affects layout, scrolling, or click targets.
//
// Visual rules:
//   • Always tasteful — capped at sensible alpha values, no saturated RGB.
//   • Speaking phase nudges the intensity up briefly without flashing.
//   • Honors prefers-reduced-motion (the keyframe is disabled in CSS).
//   • If the user disables ambient lighting in settings, this renders nothing.
//
// Future hardware bridge (Hue / Nanoleaf / HomeKit / RGB) would subscribe to
// the same `deriveLightingState()` output via a parallel mount point.

import { useEffect, useState } from 'react';
import { useMoodcast } from '@/lib/context/MoodcastContext';
import { readPreferences } from '@/lib/storage/preferencesClient';
import {
  deriveLightingState,
  type LightingState,
} from '@/lib/ambient/lightingState';
import type { AmbientIntensity } from '@/lib/types/preferences';

const KEY = 'moodcast:preferences';

interface AmbientPrefSnapshot {
  enabled: boolean;
  intensity: AmbientIntensity;
}

function readAmbientPrefs(): AmbientPrefSnapshot {
  const p = readPreferences();
  return { enabled: p.ambientLightingEnabled, intensity: p.ambientIntensity };
}

export function AmbientStage() {
  const { currentSession, playerState, isMoocSpeaking } = useMoodcast();

  // Track preferences in state so the panel can flip ambient on/off without
  // a full page reload. We read once on mount, then re-read on the
  // 'storage' event (cross-tab) and on a custom local event whenever the
  // settings panel writes (see writePreferences below).
  const [prefs, setPrefs] = useState<AmbientPrefSnapshot>({
    enabled: true,
    intensity: 'medium',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setPrefs(readAmbientPrefs());
    })();

    // Cross-tab + same-tab updates via the standard storage event.
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key !== KEY) return;
      setPrefs(readAmbientPrefs());
    };
    window.addEventListener('storage', onStorage);

    // Same-tab updates: re-poll on a short cadence. Cheap (one localStorage
    // read), keeps us in sync with the settings panel without coupling.
    const interval = window.setInterval(() => {
      const next = readAmbientPrefs();
      setPrefs((curr) =>
        curr.enabled === next.enabled && curr.intensity === next.intensity ? curr : next,
      );
    }, 1000);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  const state: LightingState = deriveLightingState({
    hasSession: !!currentSession,
    hasPlayer: !!playerState,
    isPaused: playerState?.paused ?? false,
    isMoocSpeaking,
    enabled: prefs.enabled,
    intensityPref: prefs.intensity,
  });

  if (!prefs.enabled || state.intensity <= 0) return null;

  // Two stacked radial gradients give the room dimensional depth without
  // relying on filters. Lavender hue → soft warm corner → vignette.
  const max = Math.min(0.9, state.intensity);
  const min = Math.max(0.18, max * 0.55);
  const period = `${Math.round(state.pulseMs)}ms`;
  const lav = '184, 160, 216';     // --mc-lav
  const coral = '212, 133, 106';   // --mc-coral, used as a tiny warm balance

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        // Inline CSS vars consumed by globals.css `.mc-ambient-pulse` rule.
        ['--mc-ambient-min' as string]: String(min),
        ['--mc-ambient-max' as string]: String(max),
        ['--mc-ambient-period' as string]: period,
      }}
    >
      <div
        className="absolute inset-0 mc-ambient-pulse"
        style={{
          background: `
            radial-gradient(60% 50% at 18% 18%, rgba(${lav}, 0.45) 0%, rgba(${lav}, 0) 70%),
            radial-gradient(55% 45% at 88% 12%, rgba(${lav}, 0.32) 0%, rgba(${lav}, 0) 65%),
            radial-gradient(70% 60% at 50% 95%, rgba(${coral}, 0.18) 0%, rgba(${coral}, 0) 70%)
          `,
        }}
      />
      {/* Vignette to keep edges from going chalky. Always present so the
          glow grounds against bg even when the pulse is at its peak. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </div>
  );
}
