import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { transferPlayback, startPlayback } from '@/lib/spotify/client';
import { sanitizeSpotifyTrackUris, countDroppedUris } from '@/lib/spotify/uris';

interface StartRequest {
  deviceId: string;
  // Caller-supplied URI list. Sanitized server-side before we hand it to
  // Spotify — empty strings, nulls, non-track URIs, and malformed ids are
  // dropped. If everything drops, the route refuses with a friendly error
  // rather than letting Spotify return `Invalid track uri: ""`.
  uris: string[];
  // Explicit 0-indexed position INTO THE SANITIZED LIST. Defaults to 0.
  // The route never infers position from Spotify's current state — that's
  // how we got "Start Playback starts in the middle" when the device
  // retained a prior context.
  startIndex?: number;
  // Identifier for the session being started. Logged for diagnostics so a
  // mismatch between the page and the playback request is visible. The
  // server doesn't currently re-write active-session.json from this route
  // (the session page already PUTs to /api/sessions/active on mount), but
  // including the id here lets us add that defense if needed.
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  const { deviceId, uris, startIndex, sessionId } = (await req.json()) as StartRequest;

  // Sanitize server-side. Defense in depth — the client already sanitizes,
  // but a stale tab or a buggy caller could still send empty strings.
  const cleanUris = sanitizeSpotifyTrackUris(uris);
  const dropped = countDroppedUris(uris);
  if (dropped > 0) {
    console.warn(`[playback/start] dropped invalid uris count=${dropped} sessionId=${sessionId ?? '(none)'}`);
  }

  // Clamp to valid range. Out-of-range or non-numeric falls back to 0.
  const requested = Number.isFinite(startIndex) ? Number(startIndex) : 0;
  const safeStart = cleanUris.length > 0
    ? Math.max(0, Math.min(requested, cleanUris.length - 1))
    : 0;

  console.log('[playback/start] hit', {
    deviceId: deviceId ? '(present)' : '(none)',
    hasDeviceId: !!deviceId,
    sessionId: sessionId ?? '(none)',
    rawUriCount: uris?.length ?? 0,
    cleanUriCount: cleanUris.length,
    droppedUriCount: dropped,
    requestedStartIndex: requested,
    safeStartIndex: safeStart,
  });

  const token = await getValidAccessToken();
  if (!token) {
    console.log('[playback/start] no access token');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID — SDK not ready' }, { status: 400 });
  }
  if (cleanUris.length === 0) {
    return NextResponse.json(
      { error: 'This session has no playable Spotify track URIs. Regenerate with Spotify connected.' },
      { status: 400 },
    );
  }

  // Step 1: transfer playback to the Moodcast device so it becomes "active"
  try {
    await transferPlayback(token, deviceId);
    console.log('[playback/start] transfer OK');
  } catch (err) {
    console.error('[playback/start] transfer FAILED:', err);
    const msg = err instanceof Error ? err.message : 'Transfer failed';
    return NextResponse.json({ error: `Playback transfer failed: ${msg}` }, { status: 502 });
  }

  // Step 2: play the sanitized uris on the now-active device, with an
  // explicit offset.position. The full sanitized list lets Spotify
  // auto-advance through the remainder of the session naturally; the
  // explicit position forces our intended start track regardless of what
  // the device played last.
  try {
    await startPlayback(token, deviceId, cleanUris, safeStart);
    console.log('[playback/start] play OK', { startIndex: safeStart, count: cleanUris.length });
    return NextResponse.json({ ok: true, startIndex: safeStart, playableCount: cleanUris.length });
  } catch (err) {
    console.error('[playback/start] play FAILED:', err);
    const msg = err instanceof Error ? err.message : 'Playback failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
