import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// [API:UPLOAD] Local image upload for avatars and moderator-managed posters.
export async function POST(req:NextRequest){const user=await getUser();if(!user)return NextResponse.json({error:'Необходимо войти'},{status:401});try{const form=await req.formData();const file=form.get('file');const kind=String(form.get('kind')||'avatar');if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024)throw Error('Загрузите JPG, PNG или WebP до 4 МБ');if(kind==='poster'&&!['admin','moderator'].includes(user.role))throw Error('Недостаточно прав');const ext=file.type.split('/')[1].replace('jpeg','jpg');const name=`${randomUUID()}.${ext}`;const dir=join(process.cwd(),'public','uploads');await mkdir(dir,{recursive:true});await writeFile(join(dir,name),Buffer.from(await file.arrayBuffer()));const url=`/uploads/${name}`;if(kind==='avatar')await db.update(users).set({avatar:url}).where(eq(users.id,user.id));return NextResponse.json({url});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ошибка загрузки'},{status:400});}}
