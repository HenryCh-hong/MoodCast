// Phase 3 — Location provider.
//
// PRIVACY:
//   - All call sites must summarize down to city + country code before reaching
//     MomentContext or the LLM prompt.
//   - Coordinates returned here are kept locally only (used to query Open-Meteo
//     for weather), and the orchestrator (Batch 4) will not pass them through.
//   - Every helper degrades silently to {} or { source: 'none' } on failure.

export type LocationSource = 'manual' | 'ip' | 'browser' | 'none';

export interface LocationResult {
  city?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  source: LocationSource;
}

const TIMEOUT_MS = 4000;

// ─────────────────────────────────────────────────────────────────────────────
// IP-based fallback (server-side)
// Uses ipapi.co — no API key, ~1k req/day free tier.
// Failure modes: network failure, rate limit, garbage response → returns
// { source: 'none' } so the caller can fall back to time-only context.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchIpLocation(): Promise<LocationResult> {
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'moodcast-cli/1.0' },
    });
    if (!res.ok) return { source: 'none' };
    const data = (await res.json()) as {
      city?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (data.error || !data.city) return { source: 'none' };
    return {
      city: data.city,
      countryCode: data.country_code,
      latitude: data.latitude,
      longitude: data.longitude,
      source: 'ip',
    };
  } catch {
    return { source: 'none' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse geocode (coords → city/country). Used by the browser-geo bridge.
// Open-Meteo's geocoding API: free, no key.
// ─────────────────────────────────────────────────────────────────────────────
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ city?: string; countryCode?: string }> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      results?: Array<{ name?: string; country_code?: string }>;
    };
    const r = data.results?.[0];
    return { city: r?.name, countryCode: r?.country_code };
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Forward geocode (city name → coords + country code).
// Used when locationMode === 'manual'. Manual override takes priority over
// IP-based guesses in the orchestrator.
// ─────────────────────────────────────────────────────────────────────────────
export async function geocodeCity(
  city: string
): Promise<{ lat?: number; lon?: number; countryCode?: string }> {
  if (!city || !city.trim()) return {};
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city.trim()
    )}&count=1&language=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      results?: Array<{
        latitude?: number;
        longitude?: number;
        country_code?: string;
      }>;
    };
    const r = data.results?.[0];
    return { lat: r?.latitude, lon: r?.longitude, countryCode: r?.country_code };
  } catch {
    return {};
  }
}
