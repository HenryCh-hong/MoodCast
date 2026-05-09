// `like` / `dislike` / `feedback clear` for the shell and one-shot CLI.
//
// Resolves the current Moodcast track by:
//   1. Reading <home>/active-session.json (the active session pointer).
//   2. Asking Spotify which track is currently playing.
//   3. Matching that URI against the active session's track list.
// If any step fails, we print a friendly "no current track to rate" line —
// we never invent a track or rate something the user can't see.
//
// All three commands share one resolver. Dashboard keys (l/d/u) take a
// faster in-memory path via cli/feedback.ts directly.

import chalk from 'chalk';
import { getValidToken } from '../auth.js';
import { spotifyFetch, SpotifyAPIError } from '../../lib/spotify/client.js';
import { readActiveSession } from '../../lib/sessions/activeSession.js';
import { applyFeedbackForTrack, type FeedbackAction } from '../feedback.js';
import type { Track } from '../../lib/types/moodcast.js';

interface ResolveResult {
  ok: boolean;
  track?: Track;
  sessionId?: string;
  reason?: string;
}

async function resolveCurrentMoodcastTrack(): Promise<ResolveResult> {
  const active = readActiveSession();
  if (!active) {
    return { ok: false, reason: 'No active Moodcast session.' };
  }

  const token = await getValidToken();
  if (!token) {
    return {
      ok: false,
      reason: 'Spotify not connected. Run `auth` (or `moodcast auth`) first.',
    };
  }

  let currentUri: string | undefined;
  try {
    const player = await spotifyFetch<{
      item?: { uri?: string } | null;
    } | null>('/me/player', token);
    currentUri = player?.item?.uri;
  } catch (err) {
    if (err instanceof SpotifyAPIError && err.status === 401) {
      return { ok: false, reason: 'Spotify token rejected — re-run `auth`.' };
    }
    // Network/transient errors fall through to "no current track".
  }

  if (!currentUri) {
    return { ok: false, reason: 'No current Moodcast track to rate.' };
  }

  const match = active.session.tracks.find((t) => t.uri === currentUri);
  if (!match) {
    return {
      ok: false,
      reason: 'Current Spotify track is not in the active Moodcast session.',
    };
  }

  return { ok: true, track: match, sessionId: active.id };
}

async function runFeedback(verdict: FeedbackAction): Promise<void> {
  const resolved = await resolveCurrentMoodcastTrack();
  if (!resolved.ok || !resolved.track) {
    console.log('');
    console.log(`  ${chalk.yellow('○')} ${resolved.reason ?? 'No current Moodcast track to rate.'}`);
    console.log('');
    return;
  }
  const result = applyFeedbackForTrack({
    track: resolved.track,
    verdict,
    sessionId: resolved.sessionId,
  });
  console.log('');
  if (result.ok) {
    console.log(`  ${chalk.green('✓')} ${result.message}: ${chalk.bold(resolved.track.title)} — ${chalk.hex('#c4b5fd')(resolved.track.artist)}`);
  } else {
    console.log(`  ${chalk.red('✗')} ${result.message}`);
  }
  console.log('');
}

export async function likeCommand(): Promise<void> {
  await runFeedback('like');
}

export async function dislikeCommand(): Promise<void> {
  await runFeedback('dislike');
}

export async function clearFeedbackCommand(): Promise<void> {
  await runFeedback('clear');
}
