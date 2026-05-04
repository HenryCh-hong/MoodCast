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
  onStateChange: (state: SpotifyPlayerState | null) => void;
  onError: (message: string) => void;
}

export function SpotifyPlayer({ onReady, onStateChange, onError }: SpotifyPlayerProps) {
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

    // Assign SDK ready callback before loading the script
    (window as unknown as SpotifySDKWindow & { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady = async () => {
      const res = await fetch('/api/auth/spotify/token');
      if (!res.ok) {
        onError('Not authenticated with Spotify');
        return;
      }
      const { token } = await res.json() as { token: string };

      const player = new (window as unknown as SpotifySDKWindow).Spotify.Player({
        name: 'Moodcast',
        getOAuthToken: (cb) => cb(token),
        volume: 0.8,
      });

      player.addListener('ready', (data) => {
        const { device_id } = data as { device_id: string };
        onReady(device_id);
      });

      player.addListener('not_ready', () => onReady(''));

      player.addListener('player_state_changed', (state) => {
        onStateChange(state as SpotifyPlayerState | null);
      });

      player.addListener('initialization_error', (e) => {
        onError((e as { message: string }).message);
      });
      player.addListener('authentication_error', (e) => {
        onError((e as { message: string }).message);
      });
      player.addListener('account_error', () => {
        onError('Spotify Premium is required for playback');
      });

      playerInstance = player;
      await player.connect();
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      playerInstance?.disconnect();
      delete (window as unknown as { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady;
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [onReady, onStateChange, onError]);

  return null; // renders nothing — purely behavioral
}
