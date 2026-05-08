import chalk from 'chalk';
import { getValidToken } from './auth.js';
import {
  spotifyFetch,
  pausePlayback,
  resumePlayback,
  startPlayback,
  SpotifyAPIError,
} from '../lib/spotify/client.js';
import { resolveDevice, ensureActive } from './utils/devices.js';
import { startKeyboard, type Key } from './utils/keyboard.js';
import { enterAltScreen, leaveAltScreen, clearAndHome } from './utils/altScreen.js';
import { pollActiveSession, resetPollCache } from './utils/activeSessionPoll.js';
import {
  BRAND,
  panelString,
  progressBarString,
  shortcutsLine,
} from './display.js';
import type { MoodcastSession, Track } from '../lib/types/moodcast.js';

const POLL_MS = 1500;
const RENDER_MS = 250;
const CUE_DURATION_MS = 12_000;
const TOAST_DURATION_MS = 2500;

interface PlayerSnapshot {
  fetchedAt: number;
  isPlaying: boolean;
  trackUri: string;
  trackName: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  progressMs: number;
  deviceId: string;
  deviceName: string;
}

export interface DashboardOptions {
  session: MoodcastSession | null;
  sessionId?: string | null;     // id under which `session` was written to the active store
  initialToken: string;
}

interface DashboardState {
  session: MoodcastSession | null;       // mutable: replaced when active-session changes
  sessionId: string | null;              // matched against active-session record
  snapshot: PlayerSnapshot | null;
  lastTrackUri: string | null;
  cue: { text: string; expiresAt: number } | null;
  toast: { text: string; expiresAt: number } | null;
  status: string;
  external: boolean;
  consecutiveFails: number;
}

export async function runDashboard(opts: DashboardOptions): Promise<void> {
  let token = opts.initialToken;

  const state: DashboardState = {
    session: opts.session,
    sessionId: opts.sessionId ?? null,
    snapshot: null,
    lastTrackUri: null,
    cue: null,
    toast: null,
    status: opts.session ? `ON AIR — ${opts.session.sessionTitle}` : 'ON AIR — following Spotify',
    external: false,
    consecutiveFails: 0,
  };

  // Reset poll cache so the very first tick reads any session that already exists.
  resetPollCache();

  let quitting = false;

  enterAltScreen();
  clearAndHome();

  function showToast(text: string) {
    state.toast = { text, expiresAt: Date.now() + TOAST_DURATION_MS };
  }

  // ─── Polling ────────────────────────────────────────────────────────────
  function syncActiveSession(): void {
    const result = pollActiveSession();
    if (!result.changed) return;
    const record = result.record;
    if (!record) {
      // File was deleted — keep our in-memory session, just clear the id
      state.sessionId = null;
      return;
    }
    if (record.id === state.sessionId) {
      // Same session, just an mtime bump — refresh fields silently
      state.session = record.session;
      return;
    }
    // New session — swap in metadata, reset cue, toast.
    const prevId = state.sessionId;
    state.session = record.session;
    state.sessionId = record.id;
    state.lastTrackUri = null; // force cue re-resolve on next poll
    state.cue = null;
    state.status = `ON AIR — ${record.session.sessionTitle}`;
    if (prevId !== null) {
      showToast(
        `session changed → ${record.session.sessionTitle} (${record.source})`
      );
    }
  }

  async function poll(): Promise<void> {
    syncActiveSession();
    try {
      const fresh = await getValidToken();
      if (fresh) token = fresh;

      const player = await spotifyFetch<{
        is_playing?: boolean;
        progress_ms?: number;
        device?: { id: string; name: string };
        item?: {
          uri: string;
          name: string;
          duration_ms: number;
          artists: Array<{ name: string }>;
          album: { name: string };
        };
      } | null>('/me/player', token);

      if (player && player.item) {
        const newUri = player.item.uri;
        state.snapshot = {
          fetchedAt: Date.now(),
          isPlaying: player.is_playing ?? false,
          trackUri: newUri,
          trackName: player.item.name,
          artistName: (player.item.artists ?? []).map((a) => a.name).join(', '),
          albumName: player.item.album?.name ?? '',
          durationMs: player.item.duration_ms ?? 0,
          progressMs: player.progress_ms ?? 0,
          deviceId: player.device?.id ?? '',
          deviceName: player.device?.name ?? '',
        };
        state.consecutiveFails = 0;

        // Track-change detection — uses the *current* session in state
        if (newUri !== state.lastTrackUri) {
          state.lastTrackUri = newUri;
          const sess = state.session;
          if (sess) {
            const moodTrack = sess.tracks.find((t) => t.uri === newUri);
            state.external = !moodTrack;
            if (moodTrack?.transitionLine) {
              state.cue = { text: moodTrack.transitionLine, expiresAt: Date.now() + CUE_DURATION_MS };
            } else {
              state.cue = null;
            }
          } else {
            state.external = true;
            state.cue = null;
          }
        }
      } else {
        // No active playback at all
        state.snapshot = null;
      }
    } catch (err) {
      state.consecutiveFails += 1;
      if (err instanceof SpotifyAPIError && err.status === 401) {
        showToast('Spotify token rejected — re-run `moodcast auth`');
      }
      // Otherwise: keep last snapshot, just show in footer
    }
  }

  // ─── Keyboard ───────────────────────────────────────────────────────────
  const stopKeyboard = startKeyboard((key: Key) => {
    if (quitting) return;
    if (key === 'q' || key === 'ctrl-c') {
      quitting = true;
      return;
    }
    if (key === 'space') void onSpace();
    else if (key === 'n') void onSkip('next');
    else if (key === 'p') void onSkip('previous');
    else if (key === 'r') showToast('retune coming later');
    else if (key === 'help') showToast('space pause · n next · p prev · r retune · q quit');
  });

  async function onSpace(): Promise<void> {
    try {
      const dev = await resolveDevice(token);
      if (!dev) {
        showToast('No active device — open Spotify or Moodcast Web Playback');
        return;
      }
      const playing = state.snapshot?.isPlaying ?? false;
      if (playing) {
        await pausePlayback(token, dev.id);
        showToast('Paused');
      } else {
        await resumePlayback(token, dev.id);
        showToast('Playing');
      }
      // Trigger a fast re-poll
      void poll();
    } catch (err) {
      const msg = err instanceof SpotifyAPIError ? `${err.status}` : (err as Error).message;
      showToast(`Pause/play failed: ${msg}`);
    }
  }

  async function onSkip(direction: 'next' | 'previous'): Promise<void> {
    try {
      const dev = await resolveDevice(token);
      if (!dev) {
        showToast('No active device — open Spotify first');
        return;
      }

      // Session-aware skip: if the current track is in our session, jump in our list
      const sess = state.session;
      if (sess && state.snapshot?.trackUri) {
        const tracks = sess.tracks;
        const idx = tracks.findIndex((t) => t.uri === state.snapshot!.trackUri);
        if (idx >= 0) {
          const targetIdx = direction === 'next' ? idx + 1 : idx - 1;
          if (targetIdx >= 0 && targetIdx < tracks.length) {
            const sliceUris = tracks
              .slice(targetIdx)
              .map((t) => t.uri ?? '')
              .filter((u) => u.startsWith('spotify:track:'));
            if (sliceUris.length > 0) {
              await ensureActive(token, dev);
              await startPlayback(token, dev.id, sliceUris);
              showToast(direction === 'next' ? 'Cueing next' : 'Going back');
              void poll();
              return;
            }
          } else {
            showToast(direction === 'next' ? 'End of session' : 'Start of session');
            return;
          }
        }
      }

      // Fallback: native skip on the device
      await ensureActive(token, dev);
      const path = direction === 'next' ? '/me/player/next' : '/me/player/previous';
      await spotifyFetch<void>(`${path}?device_id=${dev.id}`, token, { method: 'POST' });
      showToast(direction === 'next' ? 'Cueing next' : 'Going back');
      void poll();
    } catch (err) {
      const msg = err instanceof SpotifyAPIError ? `${err.status}` : (err as Error).message;
      showToast(`Skip failed: ${msg}`);
    }
  }

  // ─── Frame composer ─────────────────────────────────────────────────────
  function composeFrame(): string {
    const lines: string[] = [];
    lines.push('');
    lines.push(BRAND);
    lines.push('');

    // Status line
    const statusColor = state.external ? chalk.yellow : chalk.bold.hex('#ff6b6b');
    const statusPrefix = state.external ? chalk.yellow('◌') : chalk.bold.hex('#ff6b6b')('●');
    lines.push(`  ${statusPrefix}  ${statusColor(state.status)}`);
    if (state.external) {
      lines.push(`  ${chalk.dim('  following external Spotify playback — Moodcast cues paused')}`);
    }
    lines.push('');

    // Now Playing panel
    if (state.snapshot) {
      const interp =
        state.snapshot.isPlaying
          ? state.snapshot.progressMs + (Date.now() - state.snapshot.fetchedAt)
          : state.snapshot.progressMs;
      const progress = progressBarString(
        Math.min(state.snapshot.durationMs, Math.max(0, interp)),
        state.snapshot.durationMs,
        30
      );

      const playState = state.snapshot.isPlaying
        ? `${chalk.green('●')} on air`
        : `${chalk.yellow('▮▮')} paused`;
      const device = state.snapshot.deviceName
        ? `${chalk.dim('·')} ${state.snapshot.deviceName}`
        : '';

      const np = panelString('Now Playing', [
        chalk.bold(state.snapshot.trackName),
        chalk.hex('#c4b5fd')(state.snapshot.artistName),
        progress,
        `${playState} ${device}`,
      ]);
      lines.push(...np);
    } else {
      const np = panelString('Now Playing', [
        chalk.dim('queue is silent — nothing on air right now'),
      ]);
      lines.push(...np);
    }

    // MooC cue (if active and recent)
    if (state.cue && Date.now() < state.cue.expiresAt) {
      lines.push('');
      lines.push(`${chalk.bold.hex('#c4b5fd')('◖ MooC')}${chalk.dim('  cue')}`);
      lines.push(`${chalk.italic.hex('#a095b8')(`“${state.cue.text}”`)}`);
    }

    // Next track panel
    const nextTrack = computeNextTrack(state.session, state.snapshot?.trackUri);
    if (nextTrack) {
      lines.push('');
      const nextLines = [
        chalk.bold(nextTrack.title),
        chalk.hex('#c4b5fd')(nextTrack.artist),
      ];
      if (nextTrack.transitionLine) {
        nextLines.push(`${chalk.dim('↳')} ${chalk.italic.hex('#a095b8')(nextTrack.transitionLine)}`);
      } else if (nextTrack.whyItFits) {
        nextLines.push(`${chalk.dim('↳')} ${chalk.italic.hex('#a095b8')(nextTrack.whyItFits)}`);
      }
      lines.push(...panelString('Next', nextLines));
    }

    // Session footer
    const sess = state.session;
    if (sess && state.snapshot) {
      const idx = sess.tracks.findIndex((t) => t.uri === state.snapshot!.trackUri);
      if (idx >= 0) {
        lines.push('');
        lines.push(
          `  ${chalk.dim('Session:')} ${chalk.bold(sess.sessionTitle)}  ${chalk.dim(
            `· track ${idx + 1} of ${sess.tracks.length}`
          )}`
        );
      } else {
        lines.push('');
        lines.push(
          `  ${chalk.dim('Session:')} ${chalk.bold(sess.sessionTitle)}  ${chalk.dim(
            '· external track'
          )}`
        );
      }
    }

    // Toast / footer
    lines.push('');
    if (state.toast && Date.now() < state.toast.expiresAt) {
      lines.push(`  ${chalk.bold.hex('#c4b5fd')('▸')} ${state.toast.text}`);
    } else if (state.consecutiveFails > 0) {
      lines.push(`  ${chalk.yellow('⚠')} ${chalk.dim(`network blip (${state.consecutiveFails})`)}`);
    } else {
      lines.push(`  ${chalk.dim('listening…')}`);
    }
    lines.push('');
    lines.push(`  ${shortcutsLine()}`);

    return lines.join('\n') + '\n';
  }

  // ─── Run loops ──────────────────────────────────────────────────────────
  // First poll immediately
  await poll();

  const pollHandle = setInterval(() => { void poll(); }, POLL_MS);
  const renderHandle = setInterval(() => {
    if (quitting) return;
    clearAndHome();
    process.stdout.write(composeFrame());
  }, RENDER_MS);

  // Initial render
  clearAndHome();
  process.stdout.write(composeFrame());

  // Wait for quit
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (quitting) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  // Teardown
  clearInterval(pollHandle);
  clearInterval(renderHandle);
  stopKeyboard();
  leaveAltScreen();
}

function computeNextTrack(
  session: MoodcastSession | null,
  currentUri: string | undefined
): Track | null {
  if (!session || !currentUri) return null;
  const idx = session.tracks.findIndex((t) => t.uri === currentUri);
  if (idx < 0 || idx >= session.tracks.length - 1) return null;
  return session.tracks[idx + 1];
}
