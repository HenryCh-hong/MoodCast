// lib/ai/moodcastPrompt.ts
import type { BroadcastFormData, TasteProfile } from '@/lib/types/moodcast';
import type { MomentContext, DiscoveryDial } from '@/lib/types/momentContext';
import type { SelectedTagSet } from '@/lib/types/tags';
import { dayName } from '@/lib/context/time';

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
      "transitionLine": "string — DJ commentary for the transition INTO this track (empty for first track)",
      "sourceIntent": "familiar_anchor | same_artist_fresh | adjacent_artist | contextual_discovery | user_seed",
      "familiarityLevel": "familiar | fresh | discovery",
      "whyThisSourceFits": "string — one short sentence on why this source intent fits"
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

SOURCE INTENT MIX (HARD RULE):
A Moodcast session is an AI radio show, NOT a replay of the user's library.
Every session MUST blend five intents:
  · familiar_anchor       — top/recent artists, recognizable, grounds the room (use real URI from the taste profile)
  · same_artist_fresh     — same artist, a DIFFERENT track from the user's top/recent (leave URI empty unless certain)
  · adjacent_artist       — genre / mood neighbour the user hasn't heard much (leave URI empty)
  · contextual_discovery  — purely mood/moment-matched, may be unknown to the user (leave URI empty)
  · user_seed             — only when the user explicitly named an artist/track in seedArtists/seedTracks

For each track set:
    sourceIntent       (one of the five above; required on every track)
    familiarityLevel   ('familiar' | 'fresh' | 'discovery'; required on every track)
    whyThisSourceFits  (one short sentence in DJ voice)

Discovery dial → required mix (counts apply to a session of N tracks; round to nearest whole track):
  'familiar'   →  familiar_anchor 50–60%,  same_artist_fresh ~25%,  adjacent_artist 10–15%,  contextual_discovery up to 5%
  'balanced'   →  familiar_anchor 25–35%,  same_artist_fresh 25–30%, adjacent_artist 25–30%,  contextual_discovery 10–20%
  'discover'   →  familiar_anchor 10–15%,  same_artist_fresh 15–20%, adjacent_artist 35–40%,  contextual_discovery 25–35%

Even on 'familiar' the session must include at least 2 non-anchor tracks. NEVER produce a session that is 100%
familiar_anchor — that is a failure mode.

ANTI-REPLAY RULE (HARD):
Top tracks and recent tracks are TASTE REFERENCES, not the queue.
Default to:
  • same artist, a track NOT in the user's listed top/recent
  • an adjacent artist with a similar sonic texture
  • a contextually fitting discovery (mood/weather/time/calendar)
Only include a previously played/top track when it is serving as a deliberate familiar_anchor.
If you find yourself filling the queue from topTracks/recentTracks line by line — STOP and rebalance toward
same_artist_fresh + adjacent_artist + contextual_discovery before responding.

URI POLICY:
- familiar_anchor and user_seed: MUST use a real spotify:track:{id} URI from the taste profile when one exists.
- same_artist_fresh / adjacent_artist / contextual_discovery: leave uri/id as empty strings if you don't have
  a real URI. The server will resolve them via Spotify search.
- Never invent URIs. Never guess an ID. Empty string is correct when uncertain.

VOICE RULES:
- Opening monologue: warm, present, specific. Never generic. Acknowledge the exact mood/context the user described.
- Transition lines: brief, 1 sentence max. Signal why the next track comes now.
- Ending message: quiet. The session is over. Don't be melodramatic.
- Never use the word "vibe".
- Never claim to know exactly what the user feels. Use hedged language for taste signals: "seems to lean toward", "recent sessions suggest", "weak signal".
- Never say "This is the perfect song for you" or make overconfident personalization claims.
- Do not mention Spotify DJ or compare yourself to it.
- When Moment context is provided, treat it as a soft atmosphere cue, not a rule. Acceptable phrasings:
    "Looks like a softer morning, so I'm not going to rush the opening."
    "You have something coming up soon, so I'll keep this clean and focused."
    "I'm keeping one familiar anchor, then opening the signal a little."
    "This stays close to your recent taste, but it isn't just a replay."
- AVOID: "I know exactly how you feel", "I know where you are", "I know your schedule", therapy language,
  exact event titles, exact locations, attendee names, addresses, or any creepy/overconfident claim.`;

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

export function buildAskDJSystemPrompt(tasteProfile?: TasteProfile): string {
  const topTracksStr = (tasteProfile?.topTracks ?? [])
    .slice(0, 20)
    .map((t) => `${t.title} — ${t.artist} [${t.uri}]`)
    .join('\n');

  const recentTracksStr = (tasteProfile?.recentTracks ?? [])
    .slice(0, 10)
    .map((t) => `${t.title} — ${t.artist} [${t.uri}]`)
    .join('\n');

  const tasteSection = tasteProfile
    ? `\n\nUSER TASTE PROFILE (use these URIs when recommending replacement tracks):\nTop Tracks:\n${topTracksStr}\nRecent:\n${recentTracksStr}`
    : '';

  return `You are DJ MOOC — Moodcast's AI radio companion. Calm, precise, warm, slightly weird. Terminal-native. Never corporate, never hype-beast.

RESPONSE FORMAT: Return ONLY valid JSON — no explanation outside the JSON.

For informational questions (what's playing, why this track, explain the session arc, what comes next):
{"type":"message","djMessage":"1–3 sentences in DJ voice."}

For modification requests (softer, more energy, less vocals, acoustic, coding, sleep, skip this, different mood, adjust, retune):
{"type":"session_update","djMessage":"1–2 sentences explaining what changed, in DJ voice.","updatedTracks":[/* complete tracks array */],"changedTrackTitles":["exact titles you changed"],"playbackRecommendation":"restart"}

RULES FOR session_update:
- Return the COMPLETE tracks array — all tracks, replacing only those that do not fit the request
- Use exact spotify:track:... URIs from the taste profile; use empty string "" if no match available
- Maintain the session's emotional arc; adjust energy or mood as requested
- Never use the word "vibe"
- Never claim to know exactly what the user feels — use hedged language${tasteSection}`;
}

function buildDialDirective(dial: DiscoveryDial): string {
  switch (dial) {
    case 'familiar':
      return [
        '[Discovery dial: familiar]',
        'User wants warmth and recognition, but this is still an AI radio show.',
        'Aim for ~50–60% familiar_anchor, ~25% same_artist_fresh, 10–15% adjacent_artist,',
        'and a small 0–5% contextual_discovery. Do NOT make a 100% top-tracks queue.',
      ].join('\n');
    case 'discover':
      return [
        '[Discovery dial: discover]',
        'Lead with adjacent_artist and contextual_discovery (~60–75% of tracks combined).',
        'Keep 1–2 familiar_anchor tracks at most for grounding. Do not pad with top tracks.',
      ].join('\n');
    case 'balanced':
    default:
      return [
        '[Discovery dial: balanced]',
        'Distribute roughly evenly across familiar_anchor / same_artist_fresh / adjacent_artist',
        'with 10–20% contextual_discovery. Avoid building the queue from top tracks alone.',
      ].join('\n');
  }
}

export function buildUserPrompt(
  form: BroadcastFormData,
  momentContext?: MomentContext,
  selectedTags?: SelectedTagSet,
  discoveryDial?: DiscoveryDial,
  options?: { extraInstruction?: string }
): string {
  const parts: string[] = [
    `Mood: ${form.mood || 'not specified — infer from activity and direction'}`,
    `Activity: ${form.activity || 'not specified'}`,
    `Session length: ${form.length || '60m'}`,
    `Direction: ${form.direction || 'stay'}`,
  ];
  if (form.prompt) parts.push(`Note from user: ${form.prompt}`);
  if (form.seedArtists) parts.push(`Seed artists: ${form.seedArtists}`);
  if (form.seedTracks) parts.push(`Seed tracks:\n${form.seedTracks}`);

  let momentBlock = '';
  if (momentContext) {
    momentBlock = '\n\n' + buildMomentContextBlock(momentContext);
  }
  let tagsBlock = '';
  if (selectedTags) {
    tagsBlock = '\n\n' + buildSelectedTagsBlock(selectedTags);
  }
  const dial = discoveryDial ?? momentContext?.discoveryRecommendation ?? 'balanced';
  const dialBlock = '\n\n' + buildDialDirective(dial);
  const extra = options?.extraInstruction ? `\n\n${options.extraInstruction}` : '';

  return `Generate a Moodcast session for:\n${parts.join(
    '\n'
  )}${momentBlock}${tagsBlock}${dialBlock}${extra}\n\nRespond with the JSON only. No explanation outside the JSON.`;
}

// ─── Moment context + selected tags formatters ──────────────────────────────
//
// PRIVACY: only summary fields go through. Coordinates, raw event titles,
// attendees, locations, descriptions never appear in the prompt.

function buildMomentContextBlock(c: MomentContext): string {
  const lines: string[] = ['[Moment context]'];
  const tod = c.timeOfDay.replace('_', ' ');
  lines.push(
    `Time: ${dayName(c.dayOfWeek)} ${tod} (${c.localTime} ${c.timeZone})`
  );
  lines.push(
    `Weather: ${c.weatherSummary ?? '—'}${c.temperatureCategory ? ` / ${c.temperatureCategory}` : ''}`
  );
  // Calendar — summary only. nextEventTypeHint is the *category*, not the title.
  if (c.calendarRhythm) {
    const next =
      c.nextEventInMinutes !== undefined
        ? ` · next in ${c.nextEventInMinutes}m (${c.nextEventTypeHint ?? 'unknown'})`
        : '';
    lines.push(`Calendar: ${c.calendarRhythm}${next}`);
  } else {
    lines.push('Calendar: —');
  }
  lines.push(
    `Location: ${c.locationSummary ?? '—'}${c.countryCode ? ` (${c.countryCode}, city-level)` : ''}`
  );
  if (c.contextualSignals.length > 0) {
    lines.push(`Signals: ${c.contextualSignals.join(' · ')}`);
  }
  lines.push(`Discovery: ${c.discoveryRecommendation}`);
  lines.push('');
  lines.push(
    "Treat these as soft atmosphere cues. They shape texture and energy"
  );
  lines.push(
    "but never override the user's stated mood or activity."
  );
  return lines.join('\n');
}

function buildSelectedTagsBlock(t: SelectedTagSet): string {
  const fmt = (label: string, items: string[]) =>
    `${label}: ${items.length ? items.join(', ') : '—'}`;
  return [
    '[Selected tags]',
    fmt('mood', t.mood),
    fmt('activity', t.activity),
    fmt('texture', t.texture),
    fmt('signal', t.signal),
    `familiarity: ${t.familiarity}`,
  ].join('\n');
}
