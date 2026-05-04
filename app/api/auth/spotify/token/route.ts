// Returns access token to browser for Web Playback SDK.
// Safe: same-origin, HTTP-only refresh token never exposed.
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ token });
}
