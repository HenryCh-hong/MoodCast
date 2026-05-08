// GET    /api/sessions/library/[id]   → { session: StoredSessionRecord }
// DELETE /api/sessions/library/[id]   → 204 / 404
//
// In Next.js 16, dynamic route handlers receive params as a Promise that must
// be awaited. See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md.

import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/sessions/sessionLibrary';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ session });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = deleteSession(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
