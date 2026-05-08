'use client';

import { useEffect } from 'react';

// Minimal type for the SDK — only what we use
interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: { name: string; images: Array<{ url: string }> };
    };
    next_tracks: Array<{
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: { name: string; images: Array<{ url: string }> };
    }>;
  };
}

interface SpotifyPlayerProps {
  onReady: (deviceId: string) => void;
  onNotReady: () => void;
  onStateChange: (state: SpotifyPlayerState | null) => void;
  onError: (message: string) => void;
}

export function SpotifyPlayer({ onReady, onNotReady, onStateChange, onError }: SpotifyPlayerProps) {
  useEffect(() => {
    type SpotifySDKWindow = Window & { Spotify: { Player: new (options: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume: number;
    }) => {
      connect: () => Promise<boolean>;
      addListener: (event: string, cb: (data: unknown) => void) => void;
      disconnect: () => void;
    } } };

    let playerInstance: { disconnect: () => void } | null = null;

    async function initPlayer() {
      const sdkWindow = window as unknown as SpotifySDKWindow;

      const player = new sdkWindow.Spotify.Player({
        name: 'Moodcast',
        // Always fetch a fresh token — the SDK calls this on reconnect and token expiry.
        // Capturing a single token at init causes 404s after ~1 hour when the token expires.
        getOAuthToken: async (cb) => {
          try {
            const res = await fetch('/api/auth/spotify/token');
            if (!res.ok) { onError('Not authenticated with Spotify'); return; }
            const data = await res.json() as { token?: string };
            if (!data.token) { onError('Not authenticated with Spotify'); return; }
            cb(data.token);
          } catch {
            onError('Could not reach Spotify — check your connection and reload.');
          }
        },
        volume: 0.8,
      });

      player.addListener('ready', (data) => {
        const { device_id } = data as { device_id: string };
        onReady(device_id);
      });

      // Device went offline — clear stale device_id so UI doesn't allow transfer attempts
      player.addListener('not_ready', () => {
        onNotReady();
      });

      player.addListener('player_state_changed', (state) => {
        onStateChange(state as SpotifyPlayerState | null);
      });

      player.addListener('initialization_error', (e) => {
        onError((e as { message: string }).message);
      });
      player.addListener('authentication_error', (e) => {
        onError((e as { message: string }).message);
        // Auth failure invalidates the device — clear it so UI reflects the broken state
        onNotReady();
      });
      player.addListener('account_error', () => {
        onError('Spotify Premium is required for playback');
      });
      player.addListener('playback_error', (e) => {
        onError((e as { message: string }).message ?? 'Spotify playback error');
      });

      playerInstance = player;
      const connected = await player.connect();
      if (!connected) {
        onError('Spotify player failed to connect. Check your network or Spotify app.');
      }
    }

    const sdkWindow = window as unknown as SpotifySDKWindow & { onSpotifyWebPlaybackSDKReady?: () => void };

    // If the SDK script already ran (e.g. navigated back to this page), window.Spotify
    // is already defined and onSpotifyWebPlaybackSDKReady won't fire again — call directly.
    if (sdkWindow.Spotify) {
      void initPlayer();
    } else {
      sdkWindow.onSpotifyWebPlaybackSDKReady = () => { void initPlayer(); };
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      playerInstance?.disconnect();
      delete (window as unknown as { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady;
    };
  }, [onReady, onNotReady, onStateChange, onError]);

  return null; // renders nothing — purely behavioral
}
