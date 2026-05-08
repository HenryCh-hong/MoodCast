import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, buildUserPrompt } from './moodcastPrompt';
import { getActiveProvider } from './provider';
import { asQuotaError } from './quotaError';
import type { BroadcastFormData, MoodcastSession, TasteProfile } from '@/lib/types/moodcast';
import type { MomentContext, DiscoveryDial } from '@/lib/types/momentContext';
import type { SelectedTagSet } from '@/lib/types/tags';

interface GenerateOptions {
  form: BroadcastFormData;
  tasteProfile?: TasteProfile;
  momentContext?: MomentContext;
  selectedTags?: SelectedTagSet;
  discoveryDial?: DiscoveryDial;
  /** Extra one-shot user-prompt instruction; used to push harder on discovery after a weak first generation. */
  extraInstruction?: string;
}

function parseSession(raw: string): MoodcastSession {
  const json = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let session: MoodcastSession;
  try {
    session = JSON.parse(json) as MoodcastSession;
  } catch {
    throw new Error(`Failed to parse session JSON: ${json.slice(0, 200)}`);
  }
  if (!session.sessionTitle || !Array.isArray(session.tracks) || session.tracks.length === 0) {
    throw new Error('Invalid session: missing required fields');
  }

  // Normalise optional fields so downstream code never sees undefined
  session.sessionSubtitle = session.sessionSubtitle ?? '';
  session.mood = session.mood ?? '';
  session.activity = session.activity ?? '';
  session.energyArc = session.energyArc ?? '';
  session.openingMonologue = session.openingMonologue ?? '';
  session.endingMessage = session.endingMessage ?? '';
  session.sessionArc = Array.isArray(session.sessionArc) ? session.sessionArc : [];
  session.tracks = session.tracks.map((t) => ({
    ...t,
    uri: t.uri ?? '',
    id: t.id ?? '',
    albumName: t.albumName ?? '',
    albumArt: t.albumArt ?? '',
    durationMs: t.durationMs ?? 0,
    moodTag: t.moodTag ?? '',
    energy: t.energy ?? 'medium',
    whyItFits: t.whyItFits ?? '',
    transitionLine: t.transitionLine ?? '',
    // Phase 3 — source-intent metadata; pass through if AI provided it.
    sourceIntent: t.sourceIntent,
    familiarityLevel: t.familiarityLevel,
    whyThisSourceFits: t.whyThisSourceFits ?? '',
  }));

  return session;
}

async function generateWithClaude(opts: GenerateOptions): Promise<MoodcastSession> {
  const client = new Anthropic();
  let raw: string;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(opts.tasteProfile),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(
            opts.form,
            opts.momentContext,
            opts.selectedTags,
            opts.discoveryDial,
            { extraInstruction: opts.extraInstruction },
          ),
        },
      ],
    });
    raw = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (err) {
    const quota = asQuotaError(err, 'anthropic');
    if (quota) throw quota;
    throw err;
  }
  return parseSession(raw);
}

async function generateWithGemini(opts: GenerateOptions): Promise<MoodcastSession> {
  const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(opts.tasteProfile),
  });

  let raw: string;
  try {
    const result = await model.generateContent(
      buildUserPrompt(
        opts.form,
        opts.momentContext,
        opts.selectedTags,
        opts.discoveryDial,
        { extraInstruction: opts.extraInstruction },
      )
    );
    raw = result.response.text();
  } catch (err) {
    const quota = asQuotaError(err, 'gemini');
    if (quota) throw quota;
    throw err;
  }
  return parseSession(raw);
}

export async function generateMoodcastSession(opts: GenerateOptions): Promise<MoodcastSession> {
  const provider = getActiveProvider();
  if (provider === 'anthropic') return generateWithClaude(opts);
  if (provider === 'gemini') return generateWithGemini(opts);
  throw new Error('No AI provider configured. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY in .env.local.');
}
