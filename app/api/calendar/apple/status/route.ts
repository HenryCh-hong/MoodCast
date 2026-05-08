// Phase 3 — Apple Calendar connection status.
// GET → { connected, appleId?, connectedAt?, lastVerifiedAt? } — never password.

import { NextResponse } from 'next/server';
import { readAppleStatus } from '@/lib/calendar/appleCredentialStore';

export async function GET() {
  return NextResponse.json(readAppleStatus());
}
