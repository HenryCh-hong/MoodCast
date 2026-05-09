import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const jar = await cookies();
  jar.delete('spotify_access_token');
  jar.delete('spotify_refresh_token');
  jar.delete('spotify_expires_at');
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/auth/spotify/callback';
  const origin = new URL(redirectUri).origin;
  return NextResponse.redirect(`${origin}/`);
}
