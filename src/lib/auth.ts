import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// [AUTH:SESSION] Signed, httpOnly session cookie compatible with Vercel serverless.
const secretKey = process.env.SESSION_SECRET || process.env.DATABASE_URL || 'development-only-secret';
const secret = new Uint8Array(createHash('sha256').update(secretKey).digest());

export async function setSession(id: number) {
  const token = await new SignJWT({ id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set('mg_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set('mg_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('mg_session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const [user] = await db.select().from(users).where(eq(users.id, Number(payload.id))).limit(1);
    return user || null;
  } catch (e) {
    console.error('[AUTH] getUser error:', e);
    return null;
  }
}

export function publicUser(user: typeof users.$inferSelect | null) {
  if (!user) return null;
  const { passwordHash, providerId, ...safe } = user;
  void passwordHash;
  void providerId;
  return safe;
}
