// Server-only access to <MOODCAST_HOME>/feedback.json. The browser never
// touches the filesystem; both the like/dislike UI and any future surfaces
// go through this route.
//
// GET    → { records, summary }         records newest-first, summary
//                                       is the prompt-safe aggregate.
// POST   → { record, summary }          upsert one feedback row (one
//                                       feedback per track; latest wins).
// DELETE → { ok, summary, removed }     remove one row by trackUri OR
//                                       title+artist; { all: true } clears
//                                       the whole file.
//
// Privacy: never echoes Spotify access tokens, raw calendar data, or any
// credentials. The store + aggregator both enforce shape.

import { NextRequest, NextResponse } from 'next/server';
import {
  readFeedback,
  upsertFeedback,
  clearFeedback,
  clearAllFeedback,
  type UpsertFeedbackInput,
} from '@/lib/feedback/feedbackStore';
import { summarizeFeedback } from '@/lib/feedback/aggregate';

export async function GET() {
  const records = readFeedback();
  const summary = summarizeFeedback(records);
  return NextResponse.json({ records, summary });
}

export async function POST(req: NextRequest) {
  let body: UpsertFeedbackInput;
  try {
    body = (await req.json()) as UpsertFeedbackInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body.title !== 'string' || typeof body.artist !== 'string') {
    return NextResponse.json({ error: 'title and artist are required' }, { status: 400 });
  }
  if (body.feedback !== 'like' && body.feedback !== 'dislike') {
    return NextResponse.json({ error: 'feedback must be "like" or "dislike"' }, { status: 400 });
  }
  const record = upsertFeedback(body);
  const summary = summarizeFeedback(readFeedback());
  return NextResponse.json({ record, summary }, { status: 201 });
}

interface DeleteBody {
  all?: boolean;
  trackUri?: string;
  title?: string;
  artist?: string;
}

export async function DELETE(req: NextRequest) {
  let body: DeleteBody = {};
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    // empty body — treat as "no key", which we reject below
  }
  if (body.all === true) {
    clearAllFeedback();
    const summary = summarizeFeedback(readFeedback());
    return NextResponse.json({ ok: true, removed: 'all', summary });
  }
  if (!body.trackUri && !(body.title && body.artist)) {
    return NextResponse.json(
      { error: 'either { all: true }, { trackUri }, or { title, artist } is required' },
      { status: 400 },
    );
  }
  const removed = clearFeedback(body);
  const summary = summarizeFeedback(readFeedback());
  return NextResponse.json({ ok: removed, summary });
}
