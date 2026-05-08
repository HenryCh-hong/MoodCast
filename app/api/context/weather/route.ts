// Phase 3 — Weather endpoint. Web hits this; CLI imports the lib directly.
//
// PRIVACY: This endpoint takes raw coordinates only to relay them to Open-Meteo.
// They are not logged or stored. Response is the coarse summary only.

import { NextRequest, NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/context/weather';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: 'lat and lon query params required' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchWeather(lat, lon);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Weather lookup failed' },
      { status: 502 }
    );
  }
}
