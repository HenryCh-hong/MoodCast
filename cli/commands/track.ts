// `moodcast track <n>` — play the Nth track of the currently active session.
// 1-indexed for users (so `track 1` = the first track).
//
// Reads the active session from ~/.moodcast/active-session.json so this
// works whether the session was generated in the web app or the terminal.
// No AI call, no regeneration — just playback handoff via the shared
// `playSessionTrackAt` helper, which is also used by the `tracks` picker.

import { readActiveSession } from '../../lib/sessions/activeSession.js';
import { playSessionTrackAt } from '../utils/playSessionTrack.js';
import { header, error, success, recovery } from '../display.js';

export async function trackCommand(numberRaw: string | number | undefined): Promise<void> {
  header();

  const n = typeof numberRaw === 'string' ? parseInt(numberRaw, 10) : numberRaw;
  if (!Number.isFinite(n) || (n as number) < 1) {
    error('Usage: track <n>  (1-indexed; e.g. `track 1` plays the first track)');
    return;
  }

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

  const rawIndex = (n as number) - 1;
  const result = await playSessionTrackAt({
    session: active.session,
    rawIndex,
    retryHint: `track ${n}`,
  });
  if (result.ok && result.track) {
    success(`Playing track ${n}: ${result.track.title}`);
    console.log('');
  }
}
