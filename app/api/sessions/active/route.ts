import { NextRequest, NextResponse } from 'next/server';
import {
  readActiveSession,
  writeActiveSession,
  clearActiveSession,
} from '@/lib/sessions/activeSession';
import { appendSession } from '@/lib/sessions/sessionLibrary';
import type { MoodcastSession } from '@/lib/types/moodcast';

export async function GET() {
  const record = readActiveSession();
  if (!record) {
    return NextResponse.json({ active: null });
  }
  return NextResponse.json({ active: record });
}

interface PutBody {
  id: string;
  source?: 'web' | 'cli';
  session: MoodcastSession;
}

export async function PUT(req: NextRequest) {
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body?.id || !body?.session?.sessionTitle || !Array.isArray(body.session.tracks)) {
    return NextResponse.json({ error: 'id and session.tracks required' }, { status: 400 });
  }
  const source = body.source ?? 'web';
  const record = writeActiveSession(body.id, body.session, source);
  // Mirror into the shared library so terminal + web see the same set of
  // saved sessions. Best-effort: never block or fail the active-session PUT.
  try {
    appendSession({ id: body.id, source, session: body.session });
  } catch (err) {
    console.error('[sessions/active] library mirror failed:', err);
  }
  return NextResponse.json({ active: record });
}

export async function DELETE() {
  clearActiveSession();
  return NextResponse.json({ ok: true });
}
