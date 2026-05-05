// app/api/generate-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { buildTasteProfile } from '@/lib/spotify/taste';
import { generateMoodcastSession } from '@/lib/ai/generateMoodcastSession';
import { getRandomDemoSession } from '@/lib/demo/demoSessions';
import { analyzeListeningPatterns } from '@/lib/taste/contextual';
import type { BroadcastFormData } from '@/lib/types/moodcast';

export async function POST(req: NextRequest) {
  const form = (await req.json()) as BroadcastFormData;

  // Demo mode — no AI key configured
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_API_KEY) {
    const demo = getRandomDemoSession();
    return NextResponse.json({ session: demo, isDemo: true, demoId: demo.id });
  }

  // Try Spotify taste profile
  let tasteProfile = undefined;
  const spotifyToken = await getValidAccessToken();
  if (spotifyToken) {
    try {
      tasteProfile = await buildTasteProfile(spotifyToken);
      if (tasteProfile && Array.isArray(form.recentSessions)) {
        tasteProfile.contextualSignals = analyzeListeningPatterns(
          tasteProfile.recentTracks,
          tasteProfile.topTracks,
          form.recentSessions,
        );
      }
    } catch {
      // Continue without taste profile
    }
  }

  try {
    const session = await generateMoodcastSession({ form, tasteProfile });
    return NextResponse.json({ session, isDemo: false });
  } catch (err) {
    console.error('[generate-session] generation failed:', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
