// Centralised CLI playback handoff used by `moodcast start`, `moodcast
// sessions play`, and `moodcast resume`. Owns the device-resolution +
// transfer + start + verify dance so all three commands behave identically
// (and so a single fix lands in all three at once).
//
// The handoff has four steps and either fully succeeds (returns `{ ok: true,
// device }`) or fully fails (returns `{ ok: false, reason, ... }`). Callers
// should never enter the dashboard's ON AIR state on failure.

import {
  startPlayback,
  SpotifyAPIError,
  type SpotifyDevice,
} from '../../lib/spotify/client.js';
import { sanitizeSpotifyTrackUris, countDroppedUris } from '../../lib/spotify/uris.js';
import {
  resolveDevice,
  ensureActive,
  verifyPlayback,
} from './devices.js';
import { debugLog } from './debugLog.js';
import { error, recovery, panel, panelLine } from '../display.js';
import { rerunHint } from './shellContext.js';

export type PlaybackFailureReason =
  | 'no_uris'
  | 'no_device'
  | 'transfer_failed'
  | 'play_forbidden'   // Spotify 403 (not Premium / dev-mode restriction)
  | 'device_lost'      // Spotify 404 (device disappeared)
  | 'play_failed'      // any other 4xx/5xx from start
  | 'verify_failed';   // start returned ok but verify said no audio

export interface PlaybackResult {
  ok: boolean;
  device?: SpotifyDevice;
  reason?: PlaybackFailureReason;
  errorMessage?: string;
}

interface StartContext {
  // Bare command verb shown in user-facing recovery hints, e.g. "start" or
  // "sessions play <id>". The hint is rendered context-aware: inside the
  // shell as `type ${verb}`, outside as `npm run moodcast ${verb}`.
  retryHint: string;
  // Whether to attempt verification after startPlayback. Default true.
  verify?: boolean;
  // 0-indexed position in `uris` to start at. Default 0. The full uris are
  // sent with explicit offset.position so Spotify never resumes from a
  // prior context.
  startIndex?: number;
}

/**
 * Resolve a fresh device, transfer to it, start the URIs, and verify audio.
 * Surfaces clear errors via the shared error/recovery helpers when something
 * goes wrong — never silently "succeeds" with no audio.
 */
export async function startSessionPlayback(
  token: string,
  uris: string[],
  ctx: StartContext,
): Promise<PlaybackResult> {
  // Sanitize first — empty strings, nulls, and non-track URIs would all
  // cause Spotify to reject the whole call with `Invalid track uri: ""`.
  const cleanUris = sanitizeSpotifyTrackUris(uris);
  const dropped = countDroppedUris(uris);
  if (dropped > 0) {
    debugLog('playback.handoff.dropped_invalid_uris', { count: dropped });
  }
  if (cleanUris.length === 0) {
    error('This session has no playable Spotify track URIs.');
    recovery([
      'try a fresh session: ' + rerunHint('start'),
      'or use ' + rerunHint('sessions show <id>') + ' to inspect the queue',
    ]);
    return { ok: false, reason: 'no_uris' };
  }

  // Always re-resolve. If the web tab reloaded, the SDK device id changed;
  // a stale id from earlier in the same shell would silently 404.
  const device = await resolveDevice(token, { retries: 3 });
  if (!device) {
    error('No Spotify device found after retries.');
    recovery([
      'open Spotify on your phone or desktop, OR open Moodcast Web Playback in a browser tab',
      rerunHint(ctx.retryHint),
    ]);
    return { ok: false, reason: 'no_device' };
  }

  // Show the user which device we picked. This makes the "wrong target"
  // failure mode legible at a glance.
  panel('Playback Target', [
    panelLine('device', device.name || '(unnamed)'),
    panelLine('type', device.type || '—'),
    panelLine('state', device.is_active ? 'active' : 'idle'),
    panelLine('tracks', `${uris.length} queued`),
  ]);

  // Always transfer. ensureActive throws on transfer error so we catch here.
  try {
    await ensureActive(token, device);
  } catch (err) {
    debugLog('playback.handoff.transfer_failed', {
      device_name: device.name,
      id_suffix: device.id.slice(-6),
      status: err instanceof SpotifyAPIError ? err.status : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof SpotifyAPIError && err.status === 403) {
      error(`Spotify rejected playback: ${err.spotifyMessage ?? 'forbidden'}`);
      recovery([
        'requires Spotify Premium for app-controlled playback',
        'or open Spotify and play any track first to wake the device',
      ]);
      return { ok: false, reason: 'play_forbidden', errorMessage: err.spotifyMessage };
    }
    if (err instanceof SpotifyAPIError && err.status === 404) {
      error(`Device "${device.name}" is no longer reachable.`);
      recovery([
        'reload the Moodcast browser tab or reopen Spotify',
        rerunHint(ctx.retryHint),
      ]);
      return { ok: false, reason: 'device_lost' };
    }
    error(`Could not transfer playback to ${device.name}: ${err instanceof Error ? err.message : String(err)}`);
    recovery([rerunHint(ctx.retryHint)]);
    return { ok: false, reason: 'transfer_failed' };
  }

  // Issue play.
  const startIndex = Math.max(0, Math.min(ctx.startIndex ?? 0, cleanUris.length - 1));
  try {
    await startPlayback(token, device.id, cleanUris, startIndex);
    debugLog('playback.handoff.play_ok', {
      device_name: device.name,
      id_suffix: device.id.slice(-6),
      uri_count: cleanUris.length,
      start_index: startIndex,
      first_uri_kind: cleanUris[0]?.split(':')[1] ?? 'unknown',
    });
  } catch (err) {
    debugLog('playback.handoff.play_failed', {
      device_name: device.name,
      id_suffix: device.id.slice(-6),
      status: err instanceof SpotifyAPIError ? err.status : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof SpotifyAPIError && err.status === 403) {
      error(`Spotify rejected playback: ${err.spotifyMessage ?? 'forbidden'}`);
      recovery([
        'requires Spotify Premium for app-controlled playback',
        'or open Spotify and play any track first to wake the device',
      ]);
      return { ok: false, reason: 'play_forbidden', errorMessage: err.spotifyMessage };
    }
    if (err instanceof SpotifyAPIError && err.status === 404) {
      error('Device disappeared between transfer and play.');
      recovery([
        'reload the Moodcast browser tab',
        rerunHint(ctx.retryHint),
      ]);
      return { ok: false, reason: 'device_lost' };
    }
    error(`Playback failed: ${err instanceof Error ? err.message : String(err)}`);
    recovery([rerunHint(ctx.retryHint)]);
    return { ok: false, reason: 'play_failed', errorMessage: err instanceof Error ? err.message : String(err) };
  }

  // Verify — unless the caller explicitly opts out (tests, or future
  // watch-only mode).
  if (ctx.verify === false) {
    return { ok: true, device };
  }
  const verify = await verifyPlayback(token, device.id, { expectedUri: cleanUris[startIndex] });
  if (!verify.ok) {
    error(
      `Spotify accepted the play command, but no audio is coming from "${device.name}".` +
        (verify.observedDeviceName && verify.observedDeviceName !== device.name
          ? ` (Spotify is currently routing to "${verify.observedDeviceName}" instead.)`
          : ''),
    );
    recovery([
      'click play once on the Moodcast browser tab (or open Spotify and play any track)',
      rerunHint(ctx.retryHint),
    ]);
    return { ok: false, reason: 'verify_failed', device };
  }

  return { ok: true, device };
}
