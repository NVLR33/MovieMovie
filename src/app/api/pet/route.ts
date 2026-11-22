import { readJsonObject, RequestError, requestFailure } from '@/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getPetSnapshot, getPublicPet, mutatePet, getPopcornHistory, PetError } from '@/lib/cinema-pet-server';

export async function GET(req: NextRequest) {
  try {
    const target = req.nextUrl.searchParams.get('userId');
    if (target !== null) {
      const id = Number(target);
      if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: 'Неверный ID' }, { status: 400 });
      return NextResponse.json({ pet: await getPublicPet(id) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
    if (req.nextUrl.searchParams.has('history')) {
      const filter = req.nextUrl.searchParams.get('filter') || 'all';
      const rawCursor = req.nextUrl.searchParams.get('cursor');
      const cursor = rawCursor === null ? undefined : Number(rawCursor);
      if (!['all', 'income', 'expense'].includes(filter) || (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor < 1 || cursor > 2147483647))) return NextResponse.json({ error: 'Неверные параметры истории' }, { status: 400 });
      return NextResponse.json(await getPopcornHistory(user.id, filter as 'all' | 'income' | 'expense', cursor), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json({ pet: await getPetSnapshot(user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Pet GET:', error);
    return NextResponse.json({ error: 'Не удалось загрузить питомца. Проверьте миграции базы.' }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
    return NextResponse.json({ pet: await mutatePet(user.id, body) });
  } catch (error) {
    if (error instanceof RequestError) return requestFailure(error);
    if (error instanceof PetError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Pet POST:', error);
    return NextResponse.json({ error: 'Не удалось сохранить питомца' }, { status: 500 });
  }
}
