// Phase 3 — Apple Calendar connect endpoint.
// POST { appleId, appPassword } → verifies credentials, persists on success.
// PRIVACY: response NEVER includes the password. On failure, the file is not written.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAndDiscover } from '@/lib/calendar/appleCalDAV';

interface ConnectBody {
  appleId?: string;
  appPassword?: string;
}

export async function POST(req: NextRequest) {
  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const appleId = (body.appleId ?? '').trim();
  const appPassword = body.appPassword ?? '';
  if (!appleId || !appPassword) {
    return NextResponse.json(
      { error: 'appleId and appPassword required' },
      { status: 400 }
    );
  }

  const result = await verifyAndDiscover(appleId, appPassword);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  // CRITICAL: never echo the password. Return calendar names only.
  return NextResponse.json({
    connected: true,
    appleId,
    calendars: result.calendars.map((c) => ({ displayName: c.displayName })),
  });
}
