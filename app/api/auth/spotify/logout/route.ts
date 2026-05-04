import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const jar = await cookies();
  jar.delete('spotify_access_token');
  jar.delete('spotify_refresh_token');
  jar.delete('spotify_expires_at');
  return NextResponse.redirect(new URL('/', req.url));
}
