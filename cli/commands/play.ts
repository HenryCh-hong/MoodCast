import chalk from 'chalk';
import { getValidToken } from '../auth.js';
import {
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  SpotifyAPIError,
} from '../../lib/spotify/client.js';
import { resolveDevice, ensureActive } from '../utils/devices.js';
import { header, error, success, recovery } from '../display.js';

const VERBS: Record<string, string> = {
  play: 'tuning back in',
  pause: 'cooling the room',
  next: 'cueing the next track',
  prev: 'pulling the previous track',
};

const SUCCESS: Record<string, string> = {
  play: 'On air. Playback resumed.',
  pause: 'Off air. Playback paused.',
  next: 'Cueing next track.',
  prev: 'Returning to previous track.',
};

export async function playCommand(action: 'play' | 'pause' | 'next' | 'prev') {
  header();
  console.log(`  ${chalk.dim(VERBS[action])}…`);

  const token = await getValidToken();
  if (!token) {
    error('Not authenticated.');
    recovery([chalk.bold('npm run moodcast auth') + ' to connect Spotify']);
    return;
  }

  // Re-resolve device every command (with retries) so we never act on a stale ID.
  const dev = await resolveDevice(token, { retries: 2 });
  if (!dev) {
    error('No active Spotify device found.');
    recovery([
      'open Spotify on your phone or desktop, OR start Moodcast Web Playback in a browser tab',
      'then re-run: ' + chalk.bold(`npm run moodcast ${action}`),
    ]);
    return;
  }

  try {
    await ensureActive(token, dev);
    if (action === 'play') await resumePlayback(token, dev.id);
    else if (action === 'pause') await pausePlayback(token, dev.id);
    else if (action === 'next') await skipToNext(token, dev.id);
    else if (action === 'prev') await skipToPrevious(token, dev.id);
    success(SUCCESS[action]);
  } catch (err) {
    if (err instanceof SpotifyAPIError && err.status === 404) {
      error('Device disappeared during the command.');
      recovery([
        'open Spotify and play any track to wake the device',
        'then re-run: ' + chalk.bold(`npm run moodcast ${action}`),
      ]);
      return;
    }
    if (err instanceof SpotifyAPIError && err.status === 403) {
      error(`Spotify rejected the command: ${err.spotifyMessage ?? 'forbidden'}`);
      recovery(['this typically means a non-Premium account or an inactive device']);
      return;
    }
    error(`Playback command failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');
}
