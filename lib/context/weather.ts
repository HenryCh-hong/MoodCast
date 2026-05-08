// Phase 3 — Weather provider (Open-Meteo, free, no API key required).
//
// PRIVACY: This module receives raw coordinates ONLY to query Open-Meteo.
// Coordinates are not retained, not logged, and are discarded after the
// HTTP call. The returned `WeatherResult` carries only coarse summaries.

import type { WeatherSummary, TemperatureCategory } from '@/lib/types/momentContext';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: 0 | 1;
  };
}

// WMO weather codes → coarse categorical summary.
// Reference: https://open-meteo.com/en/docs#weathervariables
function codeToSummary(code: number | undefined): WeatherSummary | undefined {
  if (code === undefined) return undefined;
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  // Drizzle (51-57), rain (61-67), rain showers (80-82) → all "rain"
  if (code >= 51 && code <= 67) return code >= 65 ? 'heavy_rain' : 'rain';
  if (code >= 80 && code <= 82) return code === 82 ? 'heavy_rain' : 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'cloudy';
}

function tempCategory(t: number | undefined): TemperatureCategory | undefined {
  if (t === undefined) return undefined;
  if (t < 0)  return 'cold';
  if (t < 12) return 'cool';
  if (t < 22) return 'mild';
  if (t < 30) return 'warm';
  return 'hot';
}

export interface WeatherResult {
  summary?: WeatherSummary;
  temperatureCategory?: TemperatureCategory;
  rawTempC?: number;       // intentionally exposed only at provider level for UI display
                           // and never injected into the LLM prompt
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherResult> {
  // Round to 2 decimals (~1km precision) so we never hit the network with sub-100m coords.
  const latR = Math.round(lat * 100) / 100;
  const lonR = Math.round(lon * 100) / 100;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latR}&longitude=${lonR}&current=temperature_2m,weather_code&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;

  const tempC = data.current?.temperature_2m;
  const cat = tempCategory(tempC);
  let summary = codeToSummary(data.current?.weather_code);

  // Promote temperature extremes to the summary when sky is otherwise clear/cloudy.
  if (cat === 'hot' && (summary === 'clear' || summary === 'cloudy')) summary = 'hot';
  if (cat === 'cold' && (summary === 'clear' || summary === 'cloudy')) summary = 'cold';

  return { summary, temperatureCategory: cat, rawTempC: tempC };
}

// Convenience for callers that want a never-throws variant.
export async function fetchWeatherSafe(lat: number, lon: number): Promise<WeatherResult | null> {
  try {
    return await fetchWeather(lat, lon);
  } catch {
    return null;
  }
}
