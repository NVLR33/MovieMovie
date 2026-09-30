import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { movies } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
// [API:VISITS] Count card visits without counting the same browser repeatedly within a day.
export async function GET(req:NextRequest){const id=Number(req.nextUrl.searchParams.get('movieId'));if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Неверный ID'},{status:400});const key=`mg_visit_${id}`;if(req.cookies.get(key))return NextResponse.json({ok:true});await db.update(movies).set({views:sql`${movies.views}+1`}).where(eq(movies.id,id));const res=NextResponse.json({ok:true});res.cookies.set(key,'1',{maxAge:86400,httpOnly:true,sameSite:'lax',path:'/'});return res;}
