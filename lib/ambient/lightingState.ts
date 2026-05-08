// LightingState — pure abstraction for "what should the room feel like?"
//
// The web AmbientStage component is the only consumer today, but the same
// shape is intentionally what a future Philips Hue / Nanoleaf / HomeKit
// adapter would subscribe to. Keeping the derivation pure means the bridge
// to a real lamp is a thin translator that maps LightingState → device API.
//
// No React, no DOM, no I/O.

import type { AmbientIntensity } from '@/lib/types/preferences';

export type LightingPhase =
  | 'disconnected'   // no session loaded
  | 'idle'           // session loaded, no playback yet
  | 'paused'         // session loaded, playback paused
  | 'playing'        // session loaded, playback rolling
  | 'speaking';      // MooC is talking; transient bump on top of playing

export interface LightingState {
  phase: LightingPhase;
  /** Headline tint — always purple in v1, but kept on the abstraction so a
   *  future "calm orange" or "rainy blue" theme can swap in without touching
   *  consumers. */
  hue: 'lavender' | 'rose' | 'sage' | 'coral';
  /** 0..1 — how strong the room glow should feel right now. */
  intensity: number;
  /** Slow pulse period in milliseconds. Lower → faster heartbeat. */
  pulseMs: number;
  /** True when the bridge should briefly emphasise (e.g. add a flash). */
  emphasis: boolean;
}

interface DeriveInput {
  hasSession: boolean;
  hasPlayer: boolean;
  isPaused: boolean;
  isMoocSpeaking: boolean;
  enabled: boolean;
  intensityPref: AmbientIntensity;
}

const PREF_TO_FACTOR: Record<AmbientIntensity, number> = {
  low: 0.55,
  medium: 1.0,
  high: 1.45,
};

const BASE_BY_PHASE: Record<LightingPhase, { intensity: number; pulseMs: number }> = {
  disconnected: { intensity: 0.0,  pulseMs: 12000 },
  idle:         { intensity: 0.18, pulseMs: 9000 },
  paused:       { intensity: 0.32, pulseMs: 7000 },
  playing:      { intensity: 0.6,  pulseMs: 5000 },
  speaking:     { intensity: 0.85, pulseMs: 3500 },
};

export function deriveLightingState(input: DeriveInput): LightingState {
  if (!input.enabled) {
    return { phase: 'disconnected', hue: 'lavender', intensity: 0, pulseMs: 12000, emphasis: false };
  }
  let phase: LightingPhase;
  if (!input.hasSession) phase = 'disconnected';
  else if (!input.hasPlayer) phase = 'idle';
  else if (input.isPaused) phase = 'paused';
  else if (input.isMoocSpeaking) phase = 'speaking';
  else phase = 'playing';

  const base = BASE_BY_PHASE[phase];
  const factor = PREF_TO_FACTOR[input.intensityPref];
  const intensity = Math.max(0, Math.min(1, base.intensity * factor));

  return {
    phase,
    hue: 'lavender',
    intensity,
    pulseMs: base.pulseMs,
    emphasis: phase === 'speaking',
  };
}
