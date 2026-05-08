import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { pausePlayback, resumePlayback, skipToNext, skipToPrevious, startPlayback } from '@/lib/spotify/client';

type Action = 'pause' | 'resume' | 'next' | 'previous';

interface ControlRequest {
  action: Action;
  // Session-aware navigation — required for next/previous to respect Moodcast order
  uris?: string[];
  currentUri?: string;
  deviceId?: string;
}

export async function POST(req: NextRequest) {
  const { action, uris, currentUri, deviceId } = await req.json() as ControlRequest;

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
      const hasSessionInfo = uris && uris.length > 0 && currentUri && deviceId;
      if (hasSessionInfo) {
        const currentIndex = uris.indexOf(currentUri);
        if (currentIndex === -1) {
          // currentUri not in session list — fall back to Spotify native skip
          if (action === 'next') await skipToNext(token);
          else await skipToPrevious(token);
        } else {
          const targetIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;
          if (targetIndex >= 0 && targetIndex < uris.length) {
            await startPlayback(token, deviceId, uris.slice(targetIndex));
          }
          // At boundary — silently do nothing
        }
      } else {
        // No session context provided — fall back to Spotify native skip
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
