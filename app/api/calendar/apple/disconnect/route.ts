// Phase 3 — Apple Calendar disconnect.
// DELETE → removes the credential file completely (no soft-delete).

import { NextResponse } from 'next/server';
import { clearAppleCredentials } from '@/lib/calendar/appleCredentialStore';

export async function DELETE() {
  const removed = clearAppleCredentials();
  return NextResponse.json({ ok: true, removed });
}
