// Phase 3 — User preference toggles for context sources.
// Same shape used by browser localStorage and CLI/server file storage.

import type { DiscoveryDial } from './momentContext';

export type LocationMode = 'off' | 'manual' | 'ip' | 'browser';
export type TuningMode = 'ask' | 'auto' | 'manual';
export type VoiceMode = 'off' | 'transitions' | 'welcome+transitions';
export type AmbientIntensity = 'low' | 'medium' | 'high';

export interface MoodcastPreferences {
  weatherEnabled: boolean;
  calendarEnabled: boolean;
  locationMode: LocationMode;
  manualCity: string | null;
  countryCode: string | null;       // optional ISO 3166-1 alpha-2 hint for manual mode
  discoveryDial: DiscoveryDial;
  tuningMode: TuningMode;

  // ── Voice transitions (browser TTS, web only) ──────────────────────────
  voiceEnabled: boolean;
  voiceMode: VoiceMode;
  voiceVolume: number;               // 0..100
  voiceRate: number;                 // 0.8..1.2
  preferredVoiceName: string | null; // SpeechSynthesisVoice.name when chosen by user

  // ── Purple on-air ambient (web only) ───────────────────────────────────
  ambientLightingEnabled: boolean;
  ambientIntensity: AmbientIntensity;
}

export const DEFAULT_PREFERENCES: MoodcastPreferences = {
  weatherEnabled: true,
  calendarEnabled: false,           // user must opt in (Apple OAuth-equivalent)
  locationMode: 'ip',               // sane default; user can flip to off / manual / browser
  manualCity: null,
  countryCode: null,
  discoveryDial: 'balanced',
  tuningMode: 'ask',

  voiceEnabled: true,
  voiceMode: 'transitions',
  voiceVolume: 70,
  voiceRate: 0.95,
  preferredVoiceName: null,

  ambientLightingEnabled: true,
  ambientIntensity: 'medium',
};
