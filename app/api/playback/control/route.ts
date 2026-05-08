import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { pausePlayback, resumePlayback, skipToNext, skipToPrevious, startPlayback } from '@/lib/spotify/client';
import { sanitizeSpotifyTrackUris, countDroppedUris } from '@/lib/spotify/uris';

type Action = 'pause' | 'resume' | 'next' | 'previous';

interface ControlRequest {
  action: Action;
  // Session-aware navigation — required for next/previous to respect Moodcast order.
  // The list is sanitized server-side; entries that aren't valid `spotify:track:…`
  // URIs are dropped before any indexing.
  uris?: string[];
  // Index source of truth, maintained client-side. Preferred over indexOf(currentUri)
  // to handle duplicate URIs in a session and to avoid race conditions where
  // Spotify's `current_track.uri` lags or leads the actual playing track.
  // The index is into the SANITIZED list — same indexing the client uses.
  currentIndex?: number;
  // Verification hint. If `uris[currentIndex]` doesn't match this URI, we
  // fall back to a directional findIndex search to recover.
  currentUri?: string;
  deviceId?: string;
  // Optional — logged for diagnostics. Lets us spot a stale request that
  // belongs to a different session than the one currently active.
  sessionId?: string;
}

// Resolve the source-of-truth current index. Prefers the client-supplied
// index (verified against currentUri), then a directional search starting
// from the hint, finally indexOf.
function resolveCurrentIndex(
  uris: string[],
  currentIndex: number | undefined,
  currentUri: string | undefined,
): number {
  if (
    typeof currentIndex === 'number' &&
    currentIndex >= 0 &&
    currentIndex < uris.length &&
    (!currentUri || uris[currentIndex] === currentUri)
  ) {
    return currentIndex;
  }
  if (currentUri) {
    // Search forward from the hint first to handle duplicate URIs by picking
    // the occurrence closest to the client's expected position.
    const start = Math.max(0, Math.min(currentIndex ?? 0, uris.length - 1));
    for (let i = start; i < uris.length; i += 1) if (uris[i] === currentUri) return i;
    for (let i = start - 1; i >= 0; i -= 1) if (uris[i] === currentUri) return i;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  const { action, uris, currentIndex, currentUri, deviceId, sessionId } =
    (await req.json()) as ControlRequest;

  const cleanUris = sanitizeSpotifyTrackUris(uris);
  const dropped = countDroppedUris(uris);
  if (dropped > 0) {
    console.warn(
      `[playback/control] dropped invalid uris count=${dropped} action=${action} sessionId=${sessionId ?? '(none)'}`,
    );
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    if (action === 'pause') {
      await pausePlayback(token);
    } else if (action === 'resume') {
      await resumePlayback(token);
    } else if (action === 'next' || action === 'previous') {
      const hasSessionInfo = cleanUris.length > 0 && !!deviceId;
      if (hasSessionInfo) {
        const idx = resolveCurrentIndex(cleanUris, currentIndex, currentUri);
        if (idx === -1) {
          // Could not locate the current track in the session. Don't guess
          // a random Spotify-native skip — that would jump out of the
          // session entirely and is what produced "next jumped to a wrong
          // song" in the bug report. Restart the active session at track 1
          // so the user is back inside the Moodcast queue.
          await startPlayback(token, deviceId!, cleanUris, 0);
          return NextResponse.json({
            ok: true,
            recovered: true,
            note: 'current track not found in session; restarted at track 1',
          });
        }
        const targetIndex = action === 'next' ? idx + 1 : idx - 1;
        if (targetIndex >= 0 && targetIndex < cleanUris.length) {
          // Send the sanitized uris with explicit offset.position. We never
          // call skipToNext/Previous in addition — that's the double-fire
          // pattern that caused "Next jumps multiple songs".
          await startPlayback(token, deviceId!, cleanUris, targetIndex);
          return NextResponse.json({ ok: true, currentIndex: idx, targetIndex });
        }
        // At boundary — silently no-op.
        return NextResponse.json({ ok: true, currentIndex: idx, atBoundary: true });
      } else {
        // No session context provided — fall back to Spotify native skip.
        if (action === 'next') await skipToNext(token);
        else await skipToPrevious(token);
      }
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Playback control failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
