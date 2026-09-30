import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// [AUTH:SESSION] Signed, httpOnly session cookie.
const secret = new Uint8Array(createHash('sha256').update(process.env.SESSION_SECRET || process.env.DATABASE_URL || 'development-only-secret').digest());
export async function setSession(id:number) { const token = await new SignJWT({id}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('30d').sign(secret); (await cookies()).set('mg_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*30}); }
export async function clearSession() { (await cookies()).delete('mg_session'); }
export async function getUser() { try { const token=(await cookies()).get('mg_session')?.value; if(!token)return null; const {payload}=await jwtVerify(token,secret); const [user]=await db.select().from(users).where(eq(users.id,Number(payload.id))).limit(1); return user||null; } catch { return null; } }
export function publicUser(user:typeof users.$inferSelect|null) { if(!user)return null; const {passwordHash,providerId,...safe}=user; void passwordHash; void providerId; return safe; }
