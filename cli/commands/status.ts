import chalk from 'chalk';
import { getValidToken, readTokens } from '../auth.js';
import { spotifyFetch } from '../../lib/spotify/client.js';
import { resolveDevice } from '../utils/devices.js';
import { header, panel, panelLine, nowPlaying, recovery } from '../display.js';
import { pingServer } from '../utils/serverPing.js';
import { readPreferences } from '../../lib/storage/preferencesServer.js';
import { readAppleStatus } from '../../lib/calendar/appleCredentialStore.js';

interface SpotifyPlaybackState {
  is_playing: boolean;
  device?: { id: string; name: string; type: string; is_active: boolean };
  item?: {
    name: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
  };
  progress_ms?: number;
}

function detectAIProvider(): { name: string; available: boolean } {
  if (process.env.AI_PROVIDER === 'anthropic' && process.env.ANTHROPIC_API_KEY)
    return { name: 'anthropic', available: true };
  if (process.env.AI_PROVIDER === 'gemini' && process.env.GOOGLE_API_KEY)
    return { name: 'gemini', available: true };
  if (process.env.GOOGLE_API_KEY) return { name: 'gemini', available: true };
  if (process.env.ANTHROPIC_API_KEY) return { name: 'anthropic', available: true };
  return { name: 'none', available: false };
}

export async function statusCommand() {
  header();

  // Server
  const server = await pingServer();
  const lines: string[] = [];

  lines.push(
    panelLine('server', server.online ? `online :${server.port}` : `offline (${server.origin})`, server.online ? 'on' : 'fail')
  );

  // Token + Spotify
  const stored = readTokens();
  if (!stored) {
    lines.push(panelLine('token', 'not authenticated', 'fail'));
    lines.push(panelLine('spotify', 'disconnected', 'off'));
  } else {
    const expiresIn = Math.max(0, Math.floor((stored.expires_at - Date.now()) / 60_000));
    lines.push(
      panelLine('token', expiresIn > 0 ? `valid · refresh in ${expiresIn}m` : 'expired (auto-refresh)', expiresIn > 0 ? 'on' : 'warn')
    );
  }

  const token = await getValidToken();
  let account = '';
  let deviceLabel = 'no active device';
  let deviceState: 'on' | 'off' | 'warn' | 'fail' = 'off';
  let nowPlayingState: SpotifyPlaybackState | null = null;

  if (token) {
    lines.push(panelLine('spotify', 'connected', 'on'));
    try {
      const profile = await spotifyFetch<{ display_name: string; product: string }>('/me', token);
      const premium = profile.product === 'premium' ? ' · Premium' : '';
      account = `${profile.display_name}${premium}`;
    } catch {
      account = 'could not fetch profile';
    }
    lines.push(panelLine('account', account));

    try {
      nowPlayingState = await spotifyFetch<SpotifyPlaybackState | null>('/me/player', token);
      if (nowPlayingState?.device) {
        deviceLabel = nowPlayingState.device.name + (nowPlayingState.device.is_active ? ' · active' : '');
        deviceState = 'on';
      } else {
        // Fall back to /me/player/devices — there may be an idle device available
        const dev = await resolveDevice(token, { retries: 0 });
        if (dev) {
          deviceLabel = `${dev.name} · idle`;
          deviceState = 'warn';
        }
      }
    } catch {
      deviceLabel = 'unknown';
      deviceState = 'warn';
    }
    lines.push(panelLine('device', deviceLabel, deviceState));
  }

  // AI provider
  const ai = detectAIProvider();
  lines.push(panelLine('ai provider', ai.name, ai.available ? 'on' : 'fail'));

  // Phase 3 — real context source state
  const prefs = readPreferences();

  // Location row
  if (prefs.locationMode === 'off') {
    lines.push(panelLine('location', 'off', 'off'));
  } else if (prefs.locationMode === 'manual') {
    lines.push(
      panelLine(
        'location',
        prefs.manualCity ? `manual · ${prefs.manualCity}` : 'manual · (no city set)',
        prefs.manualCity ? 'on' : 'warn'
      )
    );
  } else if (prefs.locationMode === 'browser') {
    lines.push(panelLine('location', 'browser geo (web only)', 'warn'));
  } else {
    lines.push(panelLine('location', 'IP-based (approximate)', 'on'));
  }

  // Weather row
  if (prefs.weatherEnabled && prefs.locationMode !== 'off') {
    lines.push(panelLine('weather', 'enabled (Open-Meteo)', 'on'));
  } else if (!prefs.weatherEnabled) {
    lines.push(panelLine('weather', 'disabled in preferences', 'off'));
  } else {
    lines.push(panelLine('weather', 'unavailable (location off)', 'warn'));
  }

  // Calendar row
  const apple = readAppleStatus();
  if (!apple.connected) {
    lines.push(panelLine('calendar', 'not connected', 'off'));
  } else if (!prefs.calendarEnabled) {
    lines.push(
      panelLine('calendar', `connected (${apple.appleId}) · disabled in preferences`, 'warn')
    );
  } else {
    lines.push(panelLine('calendar', `connected (${apple.appleId})`, 'on'));
  }

  // Discovery dial row
  lines.push(panelLine('discovery', prefs.discoveryDial, 'on'));

  panel('Signal Check', lines);

  // Now playing block
  if (nowPlayingState?.item) {
    nowPlaying(
      nowPlayingState.item.name,
      nowPlayingState.item.artists.map((a) => a.name).join(', '),
      nowPlayingState.progress_ms ?? 0,
      nowPlayingState.item.duration_ms
    );
  } else if (token) {
    console.log('');
    console.log(`  ${chalk.dim('queue is silent — nothing on air right now')}`);
  }

  // Quota note
  console.log('');
  console.log(`  ${chalk.dim('note:')} ${chalk.dim('playlist save is in fallback mode — Spotify dev quota pending review')}`);

  // Recovery hints
  if (!server.online) {
    recovery([
      'in another terminal: ' + chalk.bold('npm run dev -- -p 3001'),
      'then re-run: ' + chalk.bold('npm run moodcast status'),
    ]);
  } else if (!token) {
    recovery([
      chalk.bold('npm run moodcast auth') + ' to connect Spotify',
    ]);
  } else if (deviceState === 'off') {
    recovery([
      'open Spotify on any device, or start the Moodcast Web Playback in a browser tab',
    ]);
  }

  console.log('');
}
