import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { startPlayback } from '@/lib/spotify/client';

export async function POST(req: NextRequest) {
  const { deviceId, uris } = await req.json() as { deviceId: string; uris: string[] };
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    await startPlayback(token, deviceId, uris);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Playback failed' },
      { status: 500 }
    );
  }
}
