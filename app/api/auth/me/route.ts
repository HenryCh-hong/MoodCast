// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { spotifyFetch } from '@/lib/spotify/client';

function devLog(event: string, fields: Record<string, string | number | boolean>): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.log(`[auth/me] ${event}`, fields);
}

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    devLog('not_authenticated', { reason: 'no_valid_token' });
    return NextResponse.json({ connected: false });
  }

  try {
    const profile = await spotifyFetch<{
      id: string;
      display_name: string;
      product: string;
      images: Array<{ url: string }>;
    }>('/me', token);
    devLog('connected', {
      isPremium: profile.product === 'premium',
    });
    return NextResponse.json({
      connected: true,
      userId: profile.id,
      name: profile.display_name,
      isPremium: profile.product === 'premium',
      avatar: profile.images?.[0]?.url ?? null,
    });
  } catch (err) {
    // A transient /me failure should not log the user out client-side. We
    // still return connected:false because callers expect the boolean, but
    // surface the reason in dev so the cause is debuggable.
    devLog('not_authenticated', {
      reason: 'profile_fetch_failed',
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    return NextResponse.json({ connected: false });
  }
}
