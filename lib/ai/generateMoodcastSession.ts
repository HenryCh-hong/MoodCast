import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, buildUserPrompt } from './moodcastPrompt';
import type { BroadcastFormData, MoodcastSession, TasteProfile } from '@/lib/types/moodcast';

interface GenerateOptions {
  form: BroadcastFormData;
  tasteProfile?: TasteProfile;
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
  if (!session.sessionTitle || !session.tracks || !Array.isArray(session.tracks)) {
    throw new Error('Invalid session: missing required fields');
  }
  return session;
}

async function generateWithClaude(form: BroadcastFormData, tasteProfile?: TasteProfile): Promise<MoodcastSession> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(tasteProfile),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(form) }],
  });

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseSession(raw);
}

async function generateWithGemini(form: BroadcastFormData, tasteProfile?: TasteProfile): Promise<MoodcastSession> {
  const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(tasteProfile),
  });

  const result = await model.generateContent(buildUserPrompt(form));
  return parseSession(result.response.text());
}

export async function generateMoodcastSession({ form, tasteProfile }: GenerateOptions): Promise<MoodcastSession> {
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(form, tasteProfile);
  }
  if (process.env.GOOGLE_API_KEY) {
    return generateWithGemini(form, tasteProfile);
  }
  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY in .env.local.');
}
