// Server-only access to the shared session library at <home>/sessions/
// (default ~/.moodcast/sessions; override with MOODCAST_HOME).
// Browser code never touches the filesystem; it always goes through this route.
//
// GET  → { sessions: SessionIndexEntry[] }   newest first, capped server-side
// POST → { entry: SessionIndexEntry }        explicit save (web also gets
//                                            mirrored automatically via PUT
//                                            /api/sessions/active)

import { NextRequest, NextResponse } from 'next/server';
import {
  appendSession,
  listSessions,
  type AppendInput,
} from '@/lib/sessions/sessionLibrary';
import type { MoodcastSession } from '@/lib/types/moodcast';

export async function GET() {
  const sessions = listSessions();
  return NextResponse.json({ sessions });
}

interface PostBody {
  id?: string;
  source?: 'web' | 'cli';
  session: MoodcastSession;
  length?: string;
  createdAt?: number;
}

function genWebId(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body?.session?.sessionTitle || !Array.isArray(body.session?.tracks)) {
    return NextResponse.json({ error: 'session.sessionTitle and session.tracks required' }, { status: 400 });
  }
  const id = body.id ?? genWebId();
  const input: AppendInput = {
    id,
    source: body.source === 'cli' ? 'cli' : 'web',
    session: body.session,
    length: body.length,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
  };
  const entry = appendSession(input);
  return NextResponse.json({ entry }, { status: 201 });
}
