'use client';

// Browser-side text-to-speech wrapper for DJ MOOC voice cues.
//
// First-class user data only flows here: the cue text the user already sees
// on screen. We do NOT send any audio off-device. window.speechSynthesis
// renders entirely in the browser's TTS engine.
//
// Returns a stable object so consumers can subscribe to:
//   isAvailable     — true if the runtime exposes speechSynthesis
//   isSpeaking      — true while an utterance from this hook is active
//   voices          — current list of installed voices (refreshed on
//                     'voiceschanged'); may be empty in some browsers
//                     until the first utterance.
//   speak(text, opts)  — speaks text. Cancels any in-progress utterance.
//   cancel()        — stops anything currently speaking.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakOptions {
  /** 0..100 (mapped to 0..1 internally) */
  volume?: number;
  /** Web Speech rate (1 = normal). We clamp 0.5..2.0 for safety. */
  rate?: number;
  /** Speech-synthesis voice name. Falls back to platform default if unmatched. */
  voiceName?: string | null;
  /** Lang hint for voice selection when no voiceName is given. */
  lang?: string;
}

export interface DJVoiceController {
  isAvailable: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, opts?: SpeakOptions) => boolean;
  cancel: () => void;
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  voiceName: string | null | undefined,
  lang: string | undefined,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  if (voiceName) {
    const exact = voices.find((v) => v.name === voiceName);
    if (exact) return exact;
  }
  if (lang) {
    const langMatch = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (langMatch) return langMatch;
  }
  // Prefer the platform default for the document language if available.
  return voices.find((v) => v.default) ?? voices[0];
}

export function useDJVoice(): DJVoiceController {
  const isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Currently speaking utterance — held so we can detach handlers / cancel.
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Populate voices and listen for voiceschanged.
  useEffect(() => {
    if (!isAvailable) return;
    const refresh = () => {
      try {
        setVoices(window.speechSynthesis.getVoices());
      } catch {
        setVoices([]);
      }
    };
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refresh);
    };
  }, [isAvailable]);

  // Cleanup on unmount: cancel any in-flight speech so we don't leak audio
  // across page navigations.
  useEffect(() => {
    if (!isAvailable) return;
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [isAvailable]);

  const cancel = useCallback(() => {
    if (!isAvailable) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    utterRef.current = null;
    setIsSpeaking(false);
  }, [isAvailable]);

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}): boolean => {
      if (!isAvailable) return false;
      const trimmed = text?.trim?.() ?? '';
      if (!trimmed) return false;

      // Always cancel a previous utterance before queuing a new one — keeps
      // rapid track skips from chaining cues.
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }

      const utter = new SpeechSynthesisUtterance(trimmed);
      const volume = Math.max(0, Math.min(1, (opts.volume ?? 70) / 100));
      const rate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
      utter.volume = volume;
      utter.rate = rate;
      utter.pitch = 1;
      const v = pickVoice(voices, opts.voiceName, opts.lang ?? 'en');
      if (v) {
        utter.voice = v;
        utter.lang = v.lang;
      } else if (opts.lang) {
        utter.lang = opts.lang;
      }

      utter.onstart = () => setIsSpeaking(true);
      const settle = () => {
        if (utterRef.current === utter) utterRef.current = null;
        setIsSpeaking(false);
      };
      utter.onend = settle;
      utter.onerror = settle;

      utterRef.current = utter;
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        settle();
        return false;
      }
      return true;
    },
    [isAvailable, voices],
  );

  return useMemo(
    () => ({ isAvailable, isSpeaking, voices, speak, cancel }),
    [isAvailable, isSpeaking, voices, speak, cancel],
  );
}
