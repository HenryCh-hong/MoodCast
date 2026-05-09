// `tracks` — open the interactive track-queue picker for the active session.
//
// Used in the shell (`moodcast> tracks`) and as a one-shot
// (`moodcast tracks`). The dashboard's `t` key wires straight into
// `pickTrack` itself rather than going through this entry point because it
// already has the session in memory.

import { readActiveSession } from '../../lib/sessions/activeSession.js';
import { spotifyFetch } from '../../lib/spotify/client.js';
import { getValidToken } from '../auth.js';
import { pickTrack } from '../trackPicker.js';
import { playSessionTrackAt } from '../utils/playSessionTrack.js';
import { error, recovery } from '../display.js';

export async function tracksCommand(): Promise<void> {
  const active = readActiveSession();
  if (!active) {
    error('No active session.');
    recovery([
      'generate one first — try `start --auto` or pick from `sessions`',
    ]);
    return;
  }
  if (!active.session.tracks || active.session.tracks.length === 0) {
    error('Active session has no tracks.');
    return;
  }

  // Best-effort: ask Spotify what's playing so the picker can label NOW.
  // Failures here are non-fatal — the picker still works without it.
  let currentRawIndex: number | null = null;
  try {
    const token = await getValidToken();
    if (token) {
      const player = await spotifyFetch<{ item?: { uri?: string } | null } | null>(
        '/me/player',
        token,
      );
      const currentUri = player?.item?.uri;
      if (currentUri) {
        const idx = active.session.tracks.findIndex((t) => t.uri === currentUri);
        if (idx >= 0) currentRawIndex = idx;
      }
    }
  } catch {
    /* ignore — picker still works without the NOW label */
  }

  const result = await pickTrack({
    session: active.session,
    currentRawIndex,
    sessionId: active.id,
  });

  if (result?.action === 'play') {
    await playSessionTrackAt({
      session: active.session,
      rawIndex: result.rawIndex,
      retryHint: 'tracks',
    });
  }
}
