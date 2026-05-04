// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/spotify/auth';

export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ connected: false });

  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json({ connected: false });
    const profile = await res.json() as {
      display_name: string;
      product: string;
      images: Array<{ url: string }>;
    };
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
