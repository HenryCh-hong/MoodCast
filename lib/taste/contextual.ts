import type { TasteProfile, ContextualSignals } from '@/lib/types/moodcast';

type TimeWindow = 'morning' | 'evening' | 'lateNight' | 'other';

function classifyHour(hour: number): TimeWindow {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 18 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 3) return 'lateNight';
  return 'other';
}

function topN(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}

// recentSessions comes from the builder page (client reads localStorage, passes slim subset).
// Each entry is { mood: string; activity: string; createdAt: string }.
export function analyzeListeningPatterns(
  recentTracks: TasteProfile['recentTracks'],
  topTracks: TasteProfile['topTracks'],
  recentSessions: Array<{ mood: string; activity: string; createdAt: string }>
): ContextualSignals {
  // ── Time-window artist analysis ─────────────────────────────────────────────
  const windowCounts: Record<TimeWindow, Map<string, number>> = {
    morning: new Map(),
    evening: new Map(),
    lateNight: new Map(),
    other: new Map(),
  };
  const hourCounts = new Array<number>(24).fill(0);
  let tracksWithTimestamp = 0;

  for (const track of recentTracks ?? []) {
    if (!track?.playedAt || !track?.artist) continue;
    try {
      const date = new Date(track.playedAt);
      if (isNaN(date.getTime())) continue;
      tracksWithTimestamp++;
      const hour = date.getHours();
      hourCounts[hour]++;
      const window = classifyHour(hour);
      windowCounts[window].set(track.artist, (windowCounts[window].get(track.artist) ?? 0) + 1);
    } catch {
      // malformed date — skip
    }
  }

  const mostActiveHour = hourCounts.some(Boolean)
    ? hourCounts.indexOf(Math.max(...hourCounts))
    : 0;

  // ── Repeated artists (in both topTracks and recentTracks) ────────────────────
  const topArtistSet = new Set(
    (topTracks ?? []).map((t) => t?.artist).filter(Boolean)
  );
  const recentArtistCounts = new Map<string, number>();
  for (const t of recentTracks ?? []) {
    if (!t?.artist) continue;
    recentArtistCounts.set(t.artist, (recentArtistCounts.get(t.artist) ?? 0) + 1);
  }
  const repeatedArtists = [...recentArtistCounts.entries()]
    .filter(([artist]) => topArtistSet.has(artist))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // ── Session history signals ───────────────────────────────────────────────────
  const last5 = (recentSessions ?? []).slice(0, 5);
  const recentSessionMoods = last5
    .map((s) => s?.mood)
    .filter((m): m is string => typeof m === 'string' && m.length > 0);
  const recentSessionActivities = last5
    .map((s) => s?.activity)
    .filter((a): a is string => typeof a === 'string' && a.length > 0);

  // ── Recent energy trend from session energyArc text ──────────────────────────
  // Passed sessions don't include energyArc (only mood/activity/createdAt) so
  // we infer from mood keywords as a heuristic.
  const energyWords = { low: 0, medium: 0, high: 0 };
  for (const s of last5) {
    const combined = `${s?.mood ?? ''} ${s?.activity ?? ''}`.toLowerCase();
    if (/tired|relax|calm|soft|quiet|sleep|mellow|gentle/.test(combined)) energyWords.low++;
    else if (/focus|study|work|read|creat/.test(combined)) energyWords.medium++;
    else if (/energet|workout|pump|danc|run|motivat/.test(combined)) energyWords.high++;
  }
  const maxEnergy = Math.max(energyWords.low, energyWords.medium, energyWords.high);
  let recentEnergyTrend: ContextualSignals['recentEnergyTrend'] = 'unknown';
  if (maxEnergy > 0) {
    const dominated = Object.entries(energyWords).filter(([, v]) => v === maxEnergy);
    recentEnergyTrend = dominated.length === 1
      ? (dominated[0][0] as 'low' | 'medium' | 'high')
      : 'mixed';
  }

  // ── Confidence ────────────────────────────────────────────────────────────────
  let confidence: ContextualSignals['confidence'];
  if (tracksWithTimestamp >= 20 && last5.length >= 3) {
    confidence = 'high';
  } else if (tracksWithTimestamp >= 5 || last5.length >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // ── Explanation ───────────────────────────────────────────────────────────────
  const explanationParts: string[] = [];
  const morningTop = topN(windowCounts.morning, 1)[0];
  const lateTop = topN(windowCounts.lateNight, 1)[0];
  if (morningTop) explanationParts.push(`morning signal: ${morningTop}`);
  if (lateTop) explanationParts.push(`late-night signal: ${lateTop}`);
  if (recentEnergyTrend !== 'unknown') explanationParts.push(`recent energy: ${recentEnergyTrend}`);
  const explanation = explanationParts.length > 0
    ? explanationParts.join(' · ')
    : 'Not enough listening history to detect patterns.';

  return {
    morningArtists: topN(windowCounts.morning, 5),
    eveningArtists: topN(windowCounts.evening, 5),
    lateNightArtists: topN(windowCounts.lateNight, 5),
    mostActiveHour,
    recentSessionMoods,
    recentSessionActivities,
    repeatedArtists,
    recentEnergyTrend,
    confidence,
    explanation,
  };
}
