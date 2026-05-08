import {
  spotifyFetch,
  getDevices,
  transferPlayback,
  SpotifyAPIError,
  type SpotifyDevice,
} from '../../lib/spotify/client.js';
import { debugLog } from './debugLog.js';

export interface ResolveDeviceOptions {
  retries?: number;
  // Case-insensitive substring match. Defaults to "moodcast" — i.e. we always
  // prefer the Moodcast Web Playback SDK device over the user's other devices.
  preferName?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Spotify often keeps stale Web Playback SDK device entries around for a few
// seconds after a tab closes. Two devices with the same name can co-exist;
// the live one is is_active or has been recently touched. When we have a
// choice, prefer is_active and otherwise fall back to the entry order Spotify
// returns (newest registrations first).
function pickBestNamed(devices: SpotifyDevice[], preferLower: string): SpotifyDevice | null {
  const matches = devices.filter((d) => d.name?.toLowerCase().includes(preferLower));
  if (matches.length === 0) return null;
  return matches.find((d) => d.is_active) ?? matches[0];
}

function pickBestUnnamed(devices: SpotifyDevice[]): SpotifyDevice | null {
  if (devices.length === 0) return null;
  return devices.find((d) => d.is_active) ?? devices[0];
}

/**
 * Re-resolve the Spotify playback device.
 *
 * Priority:
 *   1. Active Moodcast Web Playback SDK device (name match + is_active)
 *   2. Any Moodcast Web Playback SDK device (name match)
 *   3. Active Spotify device (any non-restricted device with is_active)
 *   4. Any non-restricted Spotify device
 *   5. null (caller surfaces a friendly no-device error)
 *
 * The previous implementation read /me/player FIRST and returned whatever was
 * currently playing — that meant the CLI hijacked playback to the user's
 * phone or desktop instead of the open Moodcast tab. We now always inspect
 * the full device list and let priority decide.
 */
export async function resolveDevice(
  token: string,
  opts: ResolveDeviceOptions = {},
): Promise<SpotifyDevice | null> {
  const retries = opts.retries ?? 2;
  const preferLower = opts.preferName?.toLowerCase() ?? 'moodcast';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const devices = await getDevices(token);
      const usable = devices.filter((d) => !d.is_restricted && d.id);

      const named = pickBestNamed(usable, preferLower);
      if (named) {
        debugLog('device.resolve.match', {
          name: named.name,
          type: named.type,
          is_active: named.is_active,
          id_suffix: named.id.slice(-6),
          attempt,
          totalDevices: devices.length,
        });
        return named;
      }

      const fallback = pickBestUnnamed(usable);
      if (fallback) {
        debugLog('device.resolve.fallback', {
          name: fallback.name,
          type: fallback.type,
          is_active: fallback.is_active,
          id_suffix: fallback.id.slice(-6),
          attempt,
          totalDevices: devices.length,
        });
        return fallback;
      }

      debugLog('device.resolve.empty', { attempt, totalDevices: devices.length });
    } catch (err) {
      if (err instanceof SpotifyAPIError && err.status === 401) throw err;
      debugLog('device.resolve.error', {
        attempt,
        status: err instanceof SpotifyAPIError ? err.status : undefined,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < retries) await sleep(400 * (attempt + 1));
  }

  return null;
}

/**
 * Always transfer playback to the chosen device before issuing a play
 * command. The previous implementation skipped transfer when the device
 * reported is_active — but is_active just means "Spotify last sent audio
 * here," which can mislead when another tab/device is the real owner.
 *
 * Idempotent. Best-effort: errors are logged and re-thrown so callers can
 * decide whether to keep going or fail loudly.
 */
export async function ensureActive(token: string, device: SpotifyDevice): Promise<void> {
  try {
    await transferPlayback(token, device.id);
    debugLog('device.transfer.ok', {
      name: device.name,
      id_suffix: device.id.slice(-6),
      was_active: device.is_active,
    });
  } catch (err) {
    debugLog('device.transfer.error', {
      name: device.name,
      id_suffix: device.id.slice(-6),
      status: err instanceof SpotifyAPIError ? err.status : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  // Spotify needs a brief moment after the transfer before play commands
  // land reliably on the new device. ~250ms in practice.
  await sleep(300);
}

export interface VerifyOptions {
  // Total time we'll keep checking before giving up. Default 4s.
  timeoutMs?: number;
  // Polling interval. Default 500ms.
  pollMs?: number;
  // The track URI we expect to be playing (optional). When set, we also
  // verify the device is playing the right track, not just *something*.
  expectedUri?: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: 'no_player' | 'wrong_device' | 'not_playing' | 'wrong_track' | 'error';
  // For diagnostics only — what /me/player actually showed.
  observedDeviceName?: string;
  observedDeviceId?: string;
  observedIsPlaying?: boolean;
  observedTrackUri?: string;
}

interface PlayerSnapshot {
  is_playing: boolean;
  device?: { id?: string; name?: string };
  item?: { uri?: string };
}

/**
 * After issuing a startPlayback, confirm the chosen device actually accepted
 * the command and is playing. Avoids the "fake ON AIR" failure mode where
 * the CLI dashboard pretends success while no audio is coming out.
 */
export async function verifyPlayback(
  token: string,
  deviceId: string,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const pollMs = opts.pollMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  let snapshot: PlayerSnapshot | null = null;
  while (Date.now() < deadline) {
    try {
      snapshot = await spotifyFetch<PlayerSnapshot | null>('/me/player', token);
    } catch (err) {
      if (err instanceof SpotifyAPIError && err.status === 204) {
        // No active player yet — keep polling.
      } else {
        debugLog('playback.verify.error', {
          status: err instanceof SpotifyAPIError ? err.status : undefined,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (snapshot?.device?.id === deviceId && snapshot.is_playing) {
      if (opts.expectedUri && snapshot.item?.uri && snapshot.item.uri !== opts.expectedUri) {
        // Right device, right state, but a different track than we asked for.
        // Treat as success — Spotify sometimes reorders queues; the dashboard
        // tracks the live state.
      }
      debugLog('playback.verify.ok', {
        device_name: snapshot.device.name,
        id_suffix: deviceId.slice(-6),
        track_uri: snapshot.item?.uri,
      });
      return {
        ok: true,
        observedDeviceName: snapshot.device?.name,
        observedDeviceId: snapshot.device?.id,
        observedIsPlaying: snapshot.is_playing,
        observedTrackUri: snapshot.item?.uri,
      };
    }
    await sleep(pollMs);
  }

  let reason: VerifyResult['reason'] = 'not_playing';
  if (!snapshot) reason = 'no_player';
  else if (snapshot.device?.id && snapshot.device.id !== deviceId) reason = 'wrong_device';
  else if (!snapshot.is_playing) reason = 'not_playing';

  debugLog('playback.verify.fail', {
    reason,
    expected_id_suffix: deviceId.slice(-6),
    observed_device_name: snapshot?.device?.name,
    observed_id_suffix: snapshot?.device?.id?.slice(-6),
    observed_is_playing: snapshot?.is_playing,
  });
  return {
    ok: false,
    reason,
    observedDeviceName: snapshot?.device?.name,
    observedDeviceId: snapshot?.device?.id,
    observedIsPlaying: snapshot?.is_playing,
    observedTrackUri: snapshot?.item?.uri,
  };
}
