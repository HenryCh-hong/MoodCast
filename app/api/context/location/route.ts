// Phase 3 — Location endpoint. Modes:
//   /api/context/location?mode=ip                              — IP-based fallback
//   /api/context/location?mode=manual&city=Boston              — manual city override
//   /api/context/location?mode=browser&lat=42.36&lon=-71.06    — browser geolocation bridge
//
// Default behavior when `mode` omitted: ip.
// Always returns 200 with `source: 'none'` on failure (silent degrade).

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchIpLocation,
  geocodeCity,
  reverseGeocode,
  type LocationResult,
} from '@/lib/context/location';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'ip';

  try {
    if (mode === 'manual') {
      const city = searchParams.get('city') ?? '';
      if (!city.trim()) {
        return NextResponse.json(
          { error: 'city required for manual mode' },
          { status: 400 }
        );
      }
      const geo = await geocodeCity(city);
      const result: LocationResult = {
        city: city.trim(),
        countryCode: geo.countryCode,
        latitude: geo.lat,
        longitude: geo.lon,
        source: geo.lat !== undefined ? 'manual' : 'none',
      };
      return NextResponse.json(result);
    }

    if (mode === 'browser') {
      const lat = parseFloat(searchParams.get('lat') ?? '');
      const lon = parseFloat(searchParams.get('lon') ?? '');
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return NextResponse.json(
          { error: 'lat and lon required for browser mode' },
          { status: 400 }
        );
      }
      const rev = await reverseGeocode(lat, lon);
      const result: LocationResult = {
        city: rev.city,
        countryCode: rev.countryCode,
        latitude: lat,
        longitude: lon,
        source: 'browser',
      };
      return NextResponse.json(result);
    }

    // Default: IP
    const ip = await fetchIpLocation();
    return NextResponse.json(ip);
  } catch (e) {
    // Silent degrade: never bubble a 5xx for context lookup.
    return NextResponse.json({ source: 'none', note: (e as Error).message });
  }
}
