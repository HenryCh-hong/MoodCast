import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type Provider = 'gemini' | 'anthropic';

/**
 * Priority: AI_PROVIDER env → GOOGLE_API_KEY → ANTHROPIC_API_KEY
 */
export function getActiveProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER;
  if (explicit === 'anthropic') return process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (explicit === 'gemini') return process.env.GOOGLE_API_KEY ? 'gemini' : null;
  if (process.env.GOOGLE_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export async function generateText({
  systemPrompt,
  userMessage,
  maxTokens = 512,
}: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const provider = getActiveProvider();

  if (provider === 'gemini') {
    const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text();
  }

  if (provider === 'anthropic') {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  throw new Error('No AI provider configured');
}
