// lib/ai/generateMoodcastSession.ts
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt } from './moodcastPrompt';
import type { BroadcastFormData, MoodcastSession, TasteProfile } from '@/lib/types/moodcast';

const client = new Anthropic();

interface GenerateOptions {
  form: BroadcastFormData;
  tasteProfile?: TasteProfile;
}

export async function generateMoodcastSession({ form, tasteProfile }: GenerateOptions): Promise<MoodcastSession> {
  const systemPrompt = buildSystemPrompt(tasteProfile);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(form),
      },
    ],
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  // Strip markdown code fences if present
  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let session: MoodcastSession;
  try {
    session = JSON.parse(jsonText) as MoodcastSession;
  } catch {
    throw new Error(`Failed to parse session JSON: ${jsonText.slice(0, 200)}`);
  }

  // Validate required fields
  if (!session.sessionTitle || !session.tracks || !Array.isArray(session.tracks)) {
    throw new Error('Invalid session: missing required fields');
  }

  return session;
}
