import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { transferPlayback, startPlayback } from '@/lib/spotify/client';

export async function POST(req: NextRequest) {
  const { deviceId, uris } = await req.json() as { deviceId: string; uris: string[] };

  console.log('[playback/start] hit', {
    deviceId: deviceId ?? '(none)',
    hasDeviceId: !!deviceId,
    uriCount: uris?.length ?? 0,
    firstUris: uris?.slice(0, 3) ?? [],
  });

  const token = await getValidAccessToken();
  if (!token) {
    console.log('[playback/start] no access token');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID — SDK not ready' }, { status: 400 });
  }
  if (!uris || uris.length === 0) {
    return NextResponse.json({ error: 'No track URIs provided' }, { status: 400 });
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

  // Step 2: play the URIs on the now-active device
  try {
    await startPlayback(token, deviceId, uris);
    console.log('[playback/start] play OK');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[playback/start] play FAILED:', err);
    const msg = err instanceof Error ? err.message : 'Playback failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
