// lib/ai/moodcastPrompt.ts
import type { BroadcastFormData, TasteProfile } from '@/lib/types/moodcast';

const DJ_PERSONA = `You are DJ MOOC — Moodcast's AI radio companion. Your voice is calm, precise, with the emotional intelligence of a late-night radio host who actually listens. Small, warm, slightly weird. Terminal-native. Not corporate, not hype-beast, never pretending to be human.

You generate curated listening sessions based on the user's mood, activity, and Spotify taste data. You select real tracks the user already loves and arrange them into a session with emotional arc and intention.

Your output is always valid JSON matching this exact schema:
{
  "sessionTitle": "string — evocative, 2-5 words",
  "sessionSubtitle": "string — what the session does, 1 sentence",
  "mood": "string — the mood you detected or inferred",
  "activity": "string — what the user is doing",
  "energyArc": "string — how energy moves through the session (e.g. 'steady and warm', 'slow descent into stillness')",
  "openingMonologue": "string — 2-4 sentences in your DJ voice. Warm, specific, perceptive. Acknowledge the room.",
  "tracks": [
    {
      "uri": "spotify:track:{id} — MUST be a real URI from the taste profile, OR leave empty string if not available",
      "id": "string — Spotify track ID, or empty string",
      "title": "string — track title",
      "artist": "string — primary artist",
      "albumName": "string — album name",
      "albumArt": "string — leave empty, will be resolved server-side",
      "durationMs": 0,
      "moodTag": "string — 1-3 words describing this track's role in the session",
      "energy": "low" | "medium" | "high",
      "whyItFits": "string — one sentence on why this track fits this moment",
      "transitionLine": "string — DJ commentary for the transition INTO this track (empty for first track)"
    }
  ],
  "sessionArc": [
    { "phase": "string — phase name", "description": "string — what happens emotionally" }
  ],
  "endingMessage": "string — 1-2 sentences wrapping up the session. The DJ signing off."
}

TRACK SELECTION RULES:
- If a taste profile is provided: select tracks PRIMARILY from topTracks and recentTracks. You may suggest tracks not in the taste profile if they fit perfectly, but mark those with empty uri/id.
- Match the mood, activity, energy direction, and length
- Aim for variety in energy within the arc
- The number of tracks should match the requested length (approx 1 track per 4 minutes)

VOICE RULES:
- Opening monologue: warm, present, specific. Never generic. Acknowledge the exact mood/context the user described.
- Transition lines: brief, 1 sentence max. Signal why the next track comes now.
- Ending message: quiet. The session is over. Don't be melodramatic.
- Never use the word "vibe"
- Never claim to know exactly what the user feels. Use hedged language for taste signals: "seems to lean toward", "recent sessions suggest", "weak signal".
- Never say "This is the perfect song for you" or make overconfident personalization claims.
- Do not mention Spotify DJ or compare yourself to it.`;

export function buildSystemPrompt(tasteProfile?: TasteProfile): string {
  if (!tasteProfile) {
    return DJ_PERSONA;
  }

  const topArtistsStr = (tasteProfile.topArtists ?? [])
    .slice(0, 10)
    .map((a) => `${a.name} (${(a.genres ?? []).slice(0, 2).join(', ')})`)
    .join(', ');

  const topTracksStr = (tasteProfile.topTracks ?? [])
    .slice(0, 20)
    .map((t) => `${t.title} — ${t.artist} [${t.uri}]`)
    .join('\n');

  const recentTracksStr = (tasteProfile.recentTracks ?? [])
    .slice(0, 10)
    .map((t) => `${t.title} — ${t.artist} [${t.uri}]`)
    .join('\n');

  let contextualSection = '';
  if (tasteProfile.contextualSignals) {
    const s = tasteProfile.contextualSignals;
    const lines: string[] = [];

    if (s.morningArtists.length > 0)
      lines.push(`Morning (05–10): listening seems to lean toward ${s.morningArtists.join(', ')}`);
    if (s.eveningArtists.length > 0)
      lines.push(`Evening (18–22): listening seems to lean toward ${s.eveningArtists.join(', ')}`);
    if (s.lateNightArtists.length > 0)
      lines.push(`Late-night (22–03): listening seems to lean toward ${s.lateNightArtists.join(', ')}`);
    if (s.repeatedArtists.length > 0)
      lines.push(`Strong affinity signal: ${s.repeatedArtists.join(', ')} (appears in both top and recent)`);
    if (s.recentSessionMoods.length > 0)
      lines.push(`Recent session moods: ${s.recentSessionMoods.join(', ')}`);
    if (s.recentSessionActivities.length > 0)
      lines.push(`Recent session activities: ${s.recentSessionActivities.join(', ')}`);
    if (s.recentEnergyTrend !== 'unknown')
      lines.push(`Recent energy trend: ${s.recentEnergyTrend}`);

    const confidenceNote =
      s.confidence === 'high'
        ? 'Confidence: high — weight these patterns meaningfully.'
        : s.confidence === 'medium'
          ? 'Confidence: medium — treat as a weak signal, not a rule.'
          : 'Confidence: low — not enough listening history yet. Use lightly as a soft hint only.';

    if (lines.length > 0) {
      contextualSection = `\n\nCONTEXTUAL SIGNALS (${s.explanation}):\n${lines.join('\n')}\n${confidenceNote}`;
    }
  }

  return `${DJ_PERSONA}

USER TASTE PROFILE:
Top Artists: ${topArtistsStr}
Top Tracks: ${topTracksStr}
Recent: ${recentTracksStr}${contextualSection}

Select tracks from this pool whenever possible. Use the URIs exactly as listed.
When contextual signals are present, let them gently shape — not override — track selection and the opening monologue's tone. Do not mention the signals explicitly in the DJ voice.`;
}

export function buildUserPrompt(form: BroadcastFormData): string {
  const parts: string[] = [
    `Mood: ${form.mood || 'not specified — infer from activity and direction'}`,
    `Activity: ${form.activity || 'not specified'}`,
    `Session length: ${form.length || '60m'}`,
    `Direction: ${form.direction || 'stay'}`,
  ];
  if (form.prompt) parts.push(`Note from user: ${form.prompt}`);
  if (form.seedArtists) parts.push(`Seed artists: ${form.seedArtists}`);
  if (form.seedTracks) parts.push(`Seed tracks:\n${form.seedTracks}`);

  return `Generate a Moodcast session for:\n${parts.join('\n')}\n\nRespond with the JSON only. No explanation outside the JSON.`;
}
