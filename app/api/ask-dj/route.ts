// app/api/ask-dj/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AskDJRequest } from '@/lib/types/moodcast';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      djMessage: "I can't answer questions in demo mode — connect your API key to chat with the DJ.",
    });
  }

  const { session, question } = (await req.json()) as AskDJRequest;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: 'You are Moodcast DJ. Answer the user\'s question about their session in 1-3 sentences. Stay in character: calm, warm, specific. Never use the word "vibe".',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Session context: "${session.sessionTitle}" — ${session.mood}, ${session.activity}.\n\nQuestion: ${question}`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('');

  return NextResponse.json({ djMessage: text });
}
