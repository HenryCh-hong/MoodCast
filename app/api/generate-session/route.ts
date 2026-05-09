// app/api/generate-session/route.ts
//
// Web-side session generation. Mirrors the CLI's `moodcast start` pipeline:
// accepts an optional MomentContext + SelectedTagSet from the browser, runs
// the same generateMoodcastSession() the CLI uses, and persists the result
// into the shared session library so /saved and `moodcast sessions list`
// see the same data.

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { buildTasteProfile } from '@/lib/spotify/taste';
import { generateMoodcastSession } from '@/lib/ai/generateMoodcastSession';
import { getRandomDemoSession } from '@/lib/demo/demoSessions';
import { analyzeListeningPatterns } from '@/lib/taste/contextual';
import { getActiveProvider } from '@/lib/ai/provider';
import { QuotaExhaustedError } from '@/lib/ai/quotaError';
import { writeActiveSession } from '@/lib/sessions/activeSession';
import { appendSession, listSessions } from '@/lib/sessions/sessionLibrary';
import { sanitiseMomentContext } from '@/lib/sessions/sanitiseMoment';
import { resolveSessionTracks } from '@/lib/spotify/resolveTracks';
import {
  summarizeSourceIntent,
  shouldRegenerate,
  describeIntentSummary,
  regenerateInstruction,
} from '@/lib/ai/sessionValidation';
import { readPreferences } from '@/lib/storage/preferencesServer';
import { readFeedback } from '@/lib/feedback/feedbackStore';
import { summarizeFeedback } from '@/lib/feedback/aggregate';
import { filterDislikedExactTracks } from '@/lib/feedback/applyToSession';
import type { BroadcastFormData, MoodcastSession } from '@/lib/types/moodcast';
import type { MomentContext, DiscoveryDial } from '@/lib/types/momentContext';
import type { SelectedTagSet } from '@/lib/types/tags';

interface GenerateRequestBody extends BroadcastFormData {
  momentContext?: MomentContext;
  selectedTags?: SelectedTagSet;
}

function genWebId(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function persistWebSession(args: {
  id: string;
  session: MoodcastSession;
  momentContext?: MomentContext;
  selectedTags?: SelectedTagSet;
  discoveryDial?: DiscoveryDial;
  length?: string;
}): void {
  // active-session.json points at this newly generated session so the CLI
  // dashboard / `moodcast resume` can immediately pick it up.
  try {
    writeActiveSession(args.id, args.session, 'web');
  } catch (err) {
    console.error('[generate-session] active-session write failed:', err);
  }
  // Shared library entry — visible to both /saved and `moodcast sessions list`.
  try {
    appendSession({
      id: args.id,
      source: 'web',
      session: args.session,
      length: args.length,
      selectedTags: args.selectedTags,
      discoveryDial: args.discoveryDial,
      momentSummary: args.momentContext ? sanitiseMomentContext(args.momentContext) : undefined,
    });
  } catch (err) {
    console.error('[generate-session] library mirror failed:', err);
  }
}

export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { momentContext, selectedTags, ...form } = body;

  // Demo mode — no AI key configured. Demo sessions still get an id so the
  // client can route to /session/<id>.
  if (!getActiveProvider()) {
    const demo = getRandomDemoSession();
    return NextResponse.json({
      session: demo,
      sessionId: demo.id,
      isDemo: true,
      demoId: demo.id,
    });
  }

  // Spotify taste profile (optional).
  let tasteProfile = undefined;
  const spotifyToken = await getValidAccessToken();
  if (spotifyToken) {
    try {
      tasteProfile = await buildTasteProfile(spotifyToken);
      if (tasteProfile) {
        // librarySize feeds the userMaturity bucket so a user with a thin
        // Spotify history but several saved Moodcast sessions still counts
        // as 'learning' / 'established'.
        let librarySize = 0;
        try { librarySize = listSessions().length; } catch { /* fs unavailable — treat as 0 */ }
        tasteProfile.contextualSignals = analyzeListeningPatterns(
          tasteProfile.recentTracks,
          tasteProfile.topTracks,
          Array.isArray(form.recentSessions) ? form.recentSessions : [],
          librarySize,
        );
      }
    } catch {
      // Continue without taste profile.
    }
  }

  try {
    const prefs = readPreferences();
    const dial: DiscoveryDial = momentContext?.discoveryRecommendation ?? prefs.discoveryDial;

    const maturity = tasteProfile?.contextualSignals?.userMaturity ?? 'established';
    const mixLabel =
      maturity === 'new' && (dial === 'familiar' || dial === 'balanced')
        ? 'taste-safe-70-30'
        : dial;
    console.log(`[discovery] maturity=${maturity} dial=${dial} mix=${mixLabel}`);

    let feedbackRecords: ReturnType<typeof readFeedback> = [];
    let feedbackSummary;
    try {
      feedbackRecords = readFeedback();
      feedbackSummary = summarizeFeedback(feedbackRecords);
      if (feedbackSummary.hasFeedback) {
        console.log(
          `[feedback] likes=${feedbackSummary.totals.likes} dislikes=${feedbackSummary.totals.dislikes} blockedUris=${feedbackSummary.dislikedTrackUris.length}`,
        );
      }
    } catch {
      /* feedback file unreadable — continue without it */
    }

    let session: MoodcastSession = await generateMoodcastSession({
      form,
      tasteProfile,
      momentContext,
      selectedTags,
      discoveryDial: dial,
      feedbackSummary,
    });

    // Source-intent diagnostics. Warn (do not throw) on degenerate distributions.
    let summary = summarizeSourceIntent(session);
    if (summary.missingSourceIntent > Math.ceil(summary.total / 2)) {
      console.warn(
        `[generate-session] sourceIntent missing on many tracks (${summary.missingSourceIntent}/${summary.total})`,
      );
    }
    if (shouldRegenerate(summary, dial)) {
      console.warn(
        `[generate-session] retrying once with stronger discovery: ${describeIntentSummary(summary)}`,
      );
      try {
        session = await generateMoodcastSession({
          form,
          tasteProfile,
          momentContext,
          selectedTags,
          discoveryDial: dial,
          extraInstruction: regenerateInstruction(dial),
          feedbackSummary,
        });
        summary = summarizeSourceIntent(session);
        console.warn(`[generate-session] post-retry: ${describeIntentSummary(summary)}`);
      } catch (retryErr) {
        // Retry failed — keep the original session.
        console.warn('[generate-session] retry failed, keeping original session:', retryErr);
      }
    } else {
      console.log(`[generate-session] ${describeIntentSummary(summary)}`);
    }

    // Best-effort URI resolution for tracks the AI left empty.
    if (spotifyToken) {
      try {
        const resolved = await resolveSessionTracks(session, spotifyToken);
        session = resolved.session;
        if (resolved.resolved > 0 || resolved.unresolved > 0) {
          console.log(
            `[generate-session] uri resolution: filled=${resolved.resolved} unresolved=${resolved.unresolved}`,
          );
        }
      } catch (resolveErr) {
        console.warn('[generate-session] uri resolution failed:', resolveErr);
      }
    }

    // Soft post-pass: blank URIs of any exactly-disliked tracks so the queue
    // never repeats them. We don't drop the row outright — see applyToSession.
    if (feedbackRecords.length) {
      const filtered = filterDislikedExactTracks(session, feedbackRecords);
      if (filtered.blocked > 0) {
        console.log(`[feedback] blocked exact-disliked tracks: ${filtered.blocked}`);
        session = filtered.session;
      }
    }

    const sessionId = genWebId();
    persistWebSession({
      id: sessionId,
      session,
      momentContext,
      selectedTags,
      discoveryDial: dial,
      length: form.length,
    });
    return NextResponse.json({ session, sessionId, isDemo: false });
  } catch (err) {
    if (err instanceof QuotaExhaustedError) {
      console.error(`[generate-session] AI quota exhausted (${err.provider}):`, err.originalMessage);
      return NextResponse.json(
        {
          ok: false,
          code: 'AI_QUOTA_EXCEEDED',
          message: `MooC reached the ${err.provider} API limit for this key. Update the provider key or wait for the quota to reset.`,
          provider: err.provider,
        },
        { status: 429 },
      );
    }
    console.error('[generate-session] generation failed:', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
