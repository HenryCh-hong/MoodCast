// Phase 3 — MomentContext endpoint.
// GET /api/context/moment[?lat=X&lon=Y] → { context: MomentContext }
// Coords (when supplied) are consumed only locally and discarded after.

import { NextRequest, NextResponse } from 'next/server';
import { buildMomentContext } from '@/lib/context/momentContext';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');
  const forceLat = Number.isFinite(lat) ? lat : undefined;
  const forceLon = Number.isFinite(lon) ? lon : undefined;
  try {
    const context = await buildMomentContext({ forceLat, forceLon });
    return NextResponse.json({ context });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'failed to build context' },
      { status: 500 }
    );
  }
}
