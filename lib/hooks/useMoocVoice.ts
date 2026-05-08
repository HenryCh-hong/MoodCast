'use client';

// Glue between the cue stream (MoodcastContext.djCue) and the browser TTS
// engine (useDJVoice). Owns the gating rules so individual UI components
// stay simple:
//
//   • Voice fires only when prefs.voiceEnabled && prefs.voiceMode !== 'off'.
//   • Voice fires only when there's an active session AND playback is not paused
//     (we don't shout into a silent room when the user opens a session page
//     without playing anything).
//   • Same cue text is never spoken twice in a row (dedupe by content).
//   • A new cue cancels the in-progress utterance — so rapid track skips
//     don't queue stale lines.
//   • isMoocSpeaking on context mirrors the TTS engine state.
//
// PRIVACY: the cue text is the same `transitionLine` already shown on screen.
// No audio is uploaded — speechSynthesis renders locally.

import { useEffect, useRef } from 'react';
import { useMoodcast } from '@/lib/context/MoodcastContext';
import { useDJVoice } from './useDJVoice';
import { readPreferences } from '@/lib/storage/preferencesClient';
import type { MoodcastPreferences } from '@/lib/types/preferences';

function readVoicePrefs(): Pick<
  MoodcastPreferences,
  'voiceEnabled' | 'voiceMode' | 'voiceVolume' | 'voiceRate' | 'preferredVoiceName'
> {
  const p = readPreferences();
  return {
    voiceEnabled: p.voiceEnabled,
    voiceMode: p.voiceMode,
    voiceVolume: p.voiceVolume,
    voiceRate: p.voiceRate,
    preferredVoiceName: p.preferredVoiceName,
  };
}

export function useMoocVoice(): void {
  const { djCue, currentSession, playerState, setIsMoocSpeaking } = useMoodcast();
  const voice = useDJVoice();

  // Track the last cue we *spoke* so we don't repeat on re-renders or when
  // the cue card gets dismissed and re-set.
  const lastSpokenRef = useRef<string | null>(null);
  // Track the active session identity so we reset dedupe on session swap.
  const lastSessionRef = useRef<string | null>(null);

  // Reset dedupe when the session changes.
  useEffect(() => {
    const id = currentSession?.sessionTitle ?? null;
    if (id !== lastSessionRef.current) {
      lastSessionRef.current = id;
      lastSpokenRef.current = null;
      voice.cancel();
    }
  }, [currentSession?.sessionTitle, voice]);

  // Mirror TTS state into context so the UI can show a speaking indicator.
  useEffect(() => {
    setIsMoocSpeaking(voice.isSpeaking);
  }, [voice.isSpeaking, setIsMoocSpeaking]);

  // Drive speech from cue updates.
  useEffect(() => {
    if (!djCue) return;
    if (!voice.isAvailable) return;
    if (!currentSession) return;

    // Don't speak when playback isn't actually rolling.
    if (!playerState || playerState.paused) return;

    const prefs = readVoicePrefs();
    if (!prefs.voiceEnabled || prefs.voiceMode === 'off') return;

    // The 'transitions' and 'welcome+transitions' modes both speak a cue
    // here — the only difference today is the welcome variant, which we
    // wire from the session page once playback first starts. Both still
    // speak track-transition cues.
    const text = djCue.trim();
    if (!text) return;
    if (text === lastSpokenRef.current) return;

    const ok = voice.speak(text, {
      volume: prefs.voiceVolume,
      rate: prefs.voiceRate,
      voiceName: prefs.preferredVoiceName,
      lang: 'en',
    });
    if (ok) lastSpokenRef.current = text;
  }, [djCue, voice, currentSession, playerState]);

  // If the user pauses mid-utterance, stop talking — don't keep narrating
  // over silence.
  useEffect(() => {
    if (playerState?.paused && voice.isSpeaking) {
      voice.cancel();
    }
  }, [playerState?.paused, voice]);
}
