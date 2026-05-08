'use client';

// SpotifyPlayerHost mounts the Spotify Web Playback SDK exactly once for
// the lifetime of the app and writes its state into MoodcastContext. It
// lives in the root layout (above the page tree), so navigating between
// /session/<A> and /session/<B> does NOT remount the SDK.
//
// Before this hoist, the SDK was rendered inline on each session page.
// Every navigation:
//   1. unmounted SpotifyPlayer → disconnected the SDK
//   2. cleared deviceId/playerState
//   3. waited 1–2s for the new mount to reconnect and emit `ready`
//
// During that window, Start Playback could fail with "Spotify device was
// not found" — which read to users as "you've lost your Spotify auth",
// even though the access token was still valid. Hoisting fixes this:
// the SDK stays connected across navigation and deviceId persists.

import { useCallback } from 'react';
import { SpotifyPlayer } from '@/components/player/SpotifyPlayer';
import { useMoodcast, type PlayerState } from '@/lib/context/MoodcastContext';

export function SpotifyPlayerHost() {
  const { spotifyProfile, setDeviceId, setPlayerState } = useMoodcast();

  const handleReady = useCallback(
    (id: string) => {
      setDeviceId(id || null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[player-host] sdk ready · deviceId=(present)');
      }
    },
    [setDeviceId],
  );

  const handleNotReady = useCallback(() => {
    setDeviceId(null);
    if (process.env.NODE_ENV === 'development') {
      console.log('[player-host] sdk not_ready · deviceId cleared');
    }
  }, [setDeviceId]);

  const handleStateChange = useCallback(
    (state: PlayerState | null) => {
      setPlayerState(state);
    },
    [setPlayerState],
  );

  const handleError = useCallback((msg: string) => {
    // Errors are surfaced to whichever page is rendering the session UI
    // via console; we deliberately don't write them to a context slot
    // because per-page error banners do that already (and conflating
    // them across pages would be confusing).
    if (process.env.NODE_ENV === 'development') {
      console.warn('[player-host] sdk error:', msg);
    }
  }, []);

  // Only mount the SDK when we know the user is connected with Premium —
  // matches the prior gating in the session page. The SDK requires a
  // Premium account to do anything useful, and trying to mount it without
  // a token spams `Not authenticated with Spotify` into the console.
  const shouldMount =
    Boolean(spotifyProfile?.connected) && Boolean(spotifyProfile?.isPremium);

  if (!shouldMount) return null;

  return (
    <SpotifyPlayer
      onReady={handleReady}
      onNotReady={handleNotReady}
      onStateChange={handleStateChange}
      onError={handleError}
    />
  );
}
