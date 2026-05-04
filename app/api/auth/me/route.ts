// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { spotifyFetch } from '@/lib/spotify/client';

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ connected: false });

  try {
    const profile = await spotifyFetch<{
      display_name: string;
      product: string;
      images: Array<{ url: string }>;
    }>('/me', token);
    return NextResponse.json({
      connected: true,
      name: profile.display_name,
      isPremium: profile.product === 'premium',
      avatar: profile.images?.[0]?.url ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
