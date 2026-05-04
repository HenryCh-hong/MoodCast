// app/api/generate-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { buildTasteProfile } from '@/lib/spotify/taste';
import { generateMoodcastSession } from '@/lib/ai/generateMoodcastSession';
import { getRandomDemoSession } from '@/lib/demo/demoSessions';
import type { BroadcastFormData } from '@/lib/types/moodcast';

export async function POST(req: NextRequest) {
  const form = (await req.json()) as BroadcastFormData;

  // Demo mode — no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const demo = getRandomDemoSession();
    return NextResponse.json({ session: demo, isDemo: true, demoId: demo.id });
  }

  // Try Spotify taste profile
  let tasteProfile = undefined;
  const spotifyToken = await getValidAccessToken();
  if (spotifyToken) {
    try {
      tasteProfile = await buildTasteProfile(spotifyToken);
    } catch {
      // Continue without taste profile — Claude picks from its knowledge
    }
  }

  try {
    const session = await generateMoodcastSession({ form, tasteProfile });
    return NextResponse.json({ session, isDemo: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
