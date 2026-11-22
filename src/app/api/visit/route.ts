import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { movies } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { databaseId, requestFailure } from '@/lib/request-validation';
// Visits are a browser/day estimate, not a tamper-proof unique-person metric.
export async function GET(req: NextRequest) {
  try {
    const id = databaseId(req.nextUrl.searchParams.get('movieId'));
    const key = `mg_visit_${id}`;
    const [film] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, id)).limit(1);
    if (!film) return NextResponse.json({ error: 'Материал не найден' }, { status: 404 });
    const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (!req.cookies.get(key)) {
      await db.update(movies).set({ views: sql`coalesce(${movies.views},0)+1` }).where(eq(movies.id, id));
      res.cookies.set(key, '1', { maxAge: 86400, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    }
    return res;
  } catch (error) { return requestFailure(error); }
}
