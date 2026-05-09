import { NextRequest, NextResponse } from 'next/server';
import { getActiveProvider, generateText } from '@/lib/ai/provider';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { buildTasteProfile } from '@/lib/spotify/taste';
import { buildAskDJSystemPrompt } from '@/lib/ai/moodcastPrompt';
import type { AskDJRequest, AskDJStructuredResponse, TasteProfile } from '@/lib/types/moodcast';

export async function POST(req: NextRequest) {
  const provider = getActiveProvider();
  if (!provider) {
    return NextResponse.json<AskDJStructuredResponse>({
      type: 'message',
      djMessage: 'MooC chat needs ANTHROPIC_API_KEY in .env.local.',
    });
  }
  // Ask DJ requires reliable structured-JSON output. Gemini's path here does
  // not enable JSON mode, and was flaky enough in practice that we restrict
  // chat to Anthropic. Session generation still supports both providers.
  if (provider !== 'anthropic') {
    return NextResponse.json<AskDJStructuredResponse>({
      type: 'message',
      djMessage:
        'MooC chat is Anthropic-only right now. Set ANTHROPIC_API_KEY in .env.local to enable Ask DJ.',
    });
  }

  const { session, question } = (await req.json()) as AskDJRequest;

  if (!question?.trim() || !session?.sessionTitle) {
    return NextResponse.json<AskDJStructuredResponse>(
      { type: 'message', djMessage: 'No question provided.' },
      { status: 400 }
    );
  }

  // Fetch taste profile for URI suggestions in retune responses
  let tasteProfile: TasteProfile | undefined;
  try {
    const token = await getValidAccessToken();
    if (token) tasteProfile = await buildTasteProfile(token);
  } catch { /* no taste profile — continue without */ }

  const userMessage = `Current session: ${JSON.stringify({
    sessionTitle: session.sessionTitle,
    mood: session.mood,
    activity: session.activity,
    energyArc: session.energyArc,
    tracks: session.tracks,
  })}\n\nUser question/request: ${question}`;

  try {
    const raw = await generateText({
      systemPrompt: buildAskDJSystemPrompt(tasteProfile),
      userMessage,
      maxTokens: 4096,
    });

    // Strip possible markdown code fences the AI might wrap around the JSON
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: AskDJStructuredResponse;
    try {
      parsed = JSON.parse(cleaned) as AskDJStructuredResponse;
    } catch {
      // AI returned plain text — treat as informational message
      parsed = { type: 'message', djMessage: raw.slice(0, 400) };
    }

    // Validate session_update: must have at least one track with a title
    if (parsed.type === 'session_update') {
      const tracks = parsed.updatedTracks;
      if (!Array.isArray(tracks) || tracks.length === 0 || !tracks[0]?.title) {
        parsed = { type: 'message', djMessage: parsed.djMessage };
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json<AskDJStructuredResponse>(
      { type: 'message', djMessage: `MooC is off-air right now — ${detail}` },
      { status: 500 }
    );
  }
}
