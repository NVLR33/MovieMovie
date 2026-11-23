import { sessionIsCurrent } from '@/lib/permissions';
import { RequestError } from '@/lib/request-validation';
import { AUTH_MESSAGES } from '@/lib/auth-errors';
import { sessionSecret } from '@/lib/auth-validation';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// [AUTH:SESSION] Signed, httpOnly session cookie compatible with Vercel serverless.
function getSecret() {
  try { return new Uint8Array(createHash('sha256').update(sessionSecret()).digest()); }
  catch { throw new RequestError(AUTH_MESSAGES.session, 503); }
}

export async function setSession(id: number) {
  const [account] = await db.select().from(users).where(eq(users.id,id)).limit(1);
  if (!account || account.isSuspended) throw new RequestError('Аккаунт заблокирован',403);
  const token = await new SignJWT({ id, sv: account.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set('mg_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set('mg_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(payload.id) || Number(payload.id) <= 0) return null;
    const [user] = await db.select().from(users).where(eq(users.id, Number(payload.id))).limit(1);
    return user && sessionIsCurrent(user, payload.sv) ? user : null;
  } catch (e) {
    console.error('[AUTH] getUser error:', e);
    return null;
  }
}

export function publicUser(user: typeof users.$inferSelect | null) {
  if (!user) return null;
  const { passwordHash, providerId, suspensionReason, sessionVersion, ...safe } = user;
  void suspensionReason; void sessionVersion;
  void passwordHash;
  void providerId;
  return safe;
}
