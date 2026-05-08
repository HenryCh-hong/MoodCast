// Phase 3 — Moment Context type definitions.
// All optional fields degrade silently when their provider is unavailable.

export type TimeOfDay =
  | 'early_morning' | 'morning' | 'midday' | 'afternoon'
  | 'evening' | 'night' | 'late_night';

export type DayType = 'weekday' | 'weekend';

export type WeatherSummary =
  | 'clear' | 'cloudy' | 'rain' | 'heavy_rain'
  | 'snow' | 'fog' | 'thunderstorm' | 'hot' | 'cold';

export type TemperatureCategory = 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

export type CalendarRhythm = 'light' | 'moderate' | 'heavy' | 'unknown';

export type DiscoveryDial = 'familiar' | 'balanced' | 'discover';

export interface MomentContext {
  // Time (always available)
  localTime: string;     // ISO 8601
  timeZone: string;      // IANA tz, e.g. "America/New_York"
  timeOfDay: TimeOfDay;
  dayType: DayType;
  dayOfWeek: number;     // 0 = Sunday … 6 = Saturday

  // Optional — Location
  locationSummary?: string;     // city-level only, e.g. "Boston"
  countryCode?: string;         // ISO 3166-1 alpha-2

  // Optional — Weather
  weatherSummary?: WeatherSummary;
  temperatureCategory?: TemperatureCategory;

  // Optional — Calendar
  calendarRhythm?: CalendarRhythm;
  nextEventInMinutes?: number;
  nextEventTypeHint?: 'class' | 'meeting' | 'study' | 'travel' | 'personal' | 'unknown';

  // Derived for prompt
  contextualSignals: string[];          // 1–4 short phrases
  discoveryRecommendation: DiscoveryDial;

  // Confidence (debug telemetry — never shown to the user)
  confidence: {
    time: 'high';
    location: 'none' | 'manual' | 'ip' | 'browser';
    weather: 'none' | 'live';
    calendar: 'none' | 'manual' | 'live';
  };
}
