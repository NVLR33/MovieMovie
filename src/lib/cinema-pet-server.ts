import { POPCORN_WEEKLY, POPCORN_MILESTONES, popcornWeek, popcornAccrual, popcornRequirementsMet, popcornEntryLabel, type PopcornEconomy, type PopcornFilter, type PopcornHistory, type PopcornCounts } from './popcorn-economy';
import { and, eq, gte, lt, gt, desc, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { users, cinemaPets, popcornLedger } from '@/db/schema';
import { PET_ACTIVITY, PET_CARE, PET_ITEMS, PET_QUESTS, PET_UPGRADES, parseOwnedItems, petDay, petProgress, type PetActivity, type PetBranch, type PetSnapshot, type PetPublic } from './cinema-pet';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PetRow = typeof cinemaPets.$inferSelect;
export class PetError extends Error {}
export async function ensurePet(tx: Transaction, userId: number) {
  await tx.insert(cinemaPets).values({ userId }).onConflictDoNothing();
  const [pet] = await tx.select().from(cinemaPets).where(eq(cinemaPets.userId, userId)).for('update');
  return pet;
}
function dayBounds(now: Date) {
  const start = new Date(`${petDay(now)}T00:00:00Z`);
  return { start, end: new Date(start.getTime() + 86400000) };
}
async function entry(tx: Transaction, userId: number, sourceKey: string, kind: string, delta: number, experienceDelta: number, now: Date) {
  const inserted = await tx.insert(popcornLedger).values({ userId, sourceKey, kind, delta, experienceDelta, createdAt: now })
    .onConflictDoNothing({ target: [popcornLedger.userId, popcornLedger.sourceKey] }).returning({ id: popcornLedger.id });
  if (!inserted.length) return false;
  await tx.update(cinemaPets).set({ balance: sql`${cinemaPets.balance} + ${delta}`, experience: sql`${cinemaPets.experience} + ${experienceDelta}` }).where(eq(cinemaPets.userId, userId));
  return true;
}
/** Caller must hold the user's row lock. Currency commits atomically with the real activity. */
export async function awardPetActivity(tx: Transaction, userId: number, kind: PetActivity, movieId: number, now = new Date()) {
  const sourceKey = `${kind}:${movieId}`;
  const [prior] = await tx.select({ id: popcornLedger.id }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), eq(popcornLedger.sourceKey, sourceKey))).limit(1);
  if (prior) return;
  await ensurePet(tx, userId);
  const bounds = dayBounds(now);
  const [daily] = await tx.select({ count: sql<number>`count(*)::int` }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), eq(popcornLedger.kind, kind), gte(popcornLedger.createdAt, bounds.start), lt(popcornLedger.createdAt, bounds.end)));
  const policy = PET_ACTIVITY[kind];
  const eligible = daily.count < policy.dailyLimit;
  await entry(tx, userId, sourceKey, kind, eligible ? policy.popcorn : 0, eligible ? policy.xp : 0, now);
}
function publicPet(pet: PetRow): PetPublic {
  const progress = petProgress(pet.experience);
  return { name: pet.name, experience: pet.experience, branch: pet.branch as PetBranch, theme: pet.theme, accessory: pet.accessory, level: progress.level, stage: progress.stage };
}
export async function getPublicPet(userId: number) {
  const [pet] = await db.select().from(cinemaPets).where(eq(cinemaPets.userId, userId)).limit(1);
  return pet?.adoptedAt && pet.showInProfile ? publicPet(pet) : null;
}
// All aggregates are scoped to this user; baseline and zero-value capped events never
// advance weekly or lifetime bonuses. Queries run under the wallet lock when claiming.
async function economySnapshot(connection: Transaction | typeof db, userId: number, now: Date): Promise<PopcornEconomy> {
  const week = popcornWeek(now);
  const rows = await connection.select({
    kind: popcornLedger.kind,
    earned: sql<number>`coalesce(sum(greatest(${popcornLedger.delta}, 0)), 0)::int`,
    spent: sql<number>`coalesce(sum(greatest(-${popcornLedger.delta}, 0)), 0)::int`,
    weekEarned: sql<number>`coalesce(sum(case when ${popcornLedger.createdAt} >= ${week.start} and ${popcornLedger.createdAt} < ${week.end} then greatest(${popcornLedger.delta}, 0) else 0 end), 0)::int`,
    weekSpent: sql<number>`coalesce(sum(case when ${popcornLedger.createdAt} >= ${week.start} and ${popcornLedger.createdAt} < ${week.end} then greatest(-${popcornLedger.delta}, 0) else 0 end), 0)::int`,
    count: sql<number>`count(*) filter (where ${popcornLedger.delta} > 0)::int`,
    weekCount: sql<number>`count(*) filter (where ${popcornLedger.delta} > 0 and ${popcornLedger.createdAt} >= ${week.start} and ${popcornLedger.createdAt} < ${week.end})::int`,
  }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), sql`${popcornLedger.kind} <> 'baseline'`)).groupBy(popcornLedger.kind);
  const claims = await connection.select({ key: popcornLedger.sourceKey, kind: popcornLedger.kind }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), inArray(popcornLedger.kind, ['weekly', 'milestone'])));
  const counts = (weekly: boolean): PopcornCounts => Object.fromEntries(Object.keys(PET_ACTIVITY).map(kind => [kind, rows.find(row => row.kind === kind)?.[weekly ? 'weekCount' : 'count'] || 0])) as PopcornCounts;
  return { weekStart: week.start.toISOString(), weekEnd: week.end.toISOString(),
    lifetime: { earned: rows.reduce((sum, r) => sum + r.earned, 0), spent: rows.reduce((sum, r) => sum + r.spent, 0) },
    week: { earned: rows.reduce((sum, r) => sum + r.weekEarned, 0), spent: rows.reduce((sum, r) => sum + r.weekSpent, 0) },
    activity: counts(false), weeklyActivity: counts(true),
    claimedWeekly: claims.filter(c => c.kind === 'weekly' && c.key.endsWith(`:${week.key}`)).map(c => c.key.split(':')[1]),
    claimedMilestones: claims.filter(c => c.kind === 'milestone').map(c => c.key.split(':')[1]),
  };
}
export async function getPopcornHistory(userId: number, filter: PopcornFilter = 'all', cursor?: number, connection: Transaction | typeof db = db): Promise<PopcornHistory> {
  const rows = await connection.select({ id: popcornLedger.id, kind: popcornLedger.kind, sourceKey: popcornLedger.sourceKey, delta: popcornLedger.delta, experienceDelta: popcornLedger.experienceDelta, createdAt: popcornLedger.createdAt }).from(popcornLedger)
    .where(and(eq(popcornLedger.userId, userId), sql`${popcornLedger.kind} <> 'baseline'`, cursor === undefined ? undefined : lt(popcornLedger.id, cursor), filter === 'income' ? gt(popcornLedger.delta, 0) : filter === 'expense' ? lt(popcornLedger.delta, 0) : undefined))
    .orderBy(desc(popcornLedger.id)).limit(21);
  const entries = rows.slice(0, 20).map(({ sourceKey, ...row }) => ({ ...row, label: popcornEntryLabel(row.kind, sourceKey, row.delta), createdAt: row.createdAt.toISOString() }));
  return { entries, nextCursor: rows.length > 20 ? entries[entries.length - 1].id : null };
}
export async function getPetSnapshot(userId: number, now = new Date()): Promise<PetSnapshot> {
  return db.transaction(async tx => {
    const [stored] = await tx.select().from(cinemaPets).where(eq(cinemaPets.userId, userId)).limit(1);
    const pet: PetRow = stored || { userId, name: 'Поппи', balance: 0, experience: 0, branch: 'director', theme: 'classic', accessory: 'none', ownedItems: '[]', projectorLevel: 0, archiveLevel: 0, productionCarry: 0, showInProfile: true, adoptedAt: null, lastCollectedAt: null };
    const bounds = dayBounds(now);
    const today = await tx.select({ kind: popcornLedger.kind, sourceKey: popcornLedger.sourceKey }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), gte(popcornLedger.createdAt, bounds.start), lt(popcornLedger.createdAt, bounds.end)));
    const recent = await getPopcornHistory(userId, 'all', undefined, tx);
    const economy = await economySnapshot(tx, userId, now);
    return { ...publicPet(pet), adopted: Boolean(pet.adoptedAt), balance: pet.balance, projectorLevel: pet.projectorLevel, archiveLevel: pet.archiveLevel,
      owned: parseOwnedItems(pet.ownedItems), showInProfile: pet.showInProfile, lastCollectedAt: pet.lastCollectedAt?.toISOString() ?? null,
      productionCarry: pet.productionCarry, economy, serverNow: now.toISOString(), pending: popcornAccrual(pet.lastCollectedAt, pet.projectorLevel, now, pet.productionCarry).pending,
      dailyCounts: Object.fromEntries(Object.keys(PET_ACTIVITY).map(kind => [kind, today.filter(e => e.kind === kind).length])) as Record<PetActivity, number>,
      cared: today.filter(e => e.sourceKey.startsWith('care:')).map(e => e.kind), claimed: today.filter(e => e.kind === 'quest').map(e => e.sourceKey.split(':')[1]),
      ledger: recent.entries.slice(0, 12),
    };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

async function collect(tx: Transaction, pet: PetRow, now: Date): Promise<PetRow> {
  const { pending, carry } = popcornAccrual(pet.lastCollectedAt, pet.projectorLevel, now, pet.productionCarry);
  if (pending) await entry(tx, pet.userId, `collect:${pet.lastCollectedAt!.toISOString()}`, 'collect', pending, 0, now);
  await tx.update(cinemaPets).set({ lastCollectedAt: now, productionCarry: carry }).where(eq(cinemaPets.userId, pet.userId));
  return { ...pet, balance: pet.balance + pending, lastCollectedAt: now, productionCarry: carry };
}

/** No client-supplied prices, balances, XP, dates or reward amounts are read. */
export async function mutatePet(userId: number, body: Record<string, unknown>) {
  await db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const now = new Date();
    let pet = await ensurePet(tx, userId);
    const action = body.action;
    if (action === 'adopt') {
      if (pet.adoptedAt) throw new PetError('Питомец уже с тобой');
      await entry(tx, userId, 'welcome', 'adopt', 30, 0, now);
      await tx.update(cinemaPets).set({ adoptedAt: now, lastCollectedAt: now }).where(eq(cinemaPets.userId, userId));
      return;
    }
    if (!pet.adoptedAt) throw new PetError('Сначала познакомься с питомцем');
    if (action === 'collect') {
      if (popcornAccrual(pet.lastCollectedAt, pet.projectorLevel, now, pet.productionCarry).pending < 1) throw new PetError('Проектор ещё копит попкорн');
      await collect(tx, pet, now); return;
    }
    if (action === 'weekly' || action === 'milestone') {
      const economy = await economySnapshot(tx, userId, now);
      if (action === 'weekly') {
        const quest = POPCORN_WEEKLY.find(q => q.id === body.id);
        if (!quest) throw new PetError('Неизвестное задание недели');
        if (!popcornRequirementsMet(economy.weeklyActivity, quest.requirements)) throw new PetError('Задание недели ещё не выполнено');
        if (!await entry(tx, userId, `weekly:${quest.id}:${popcornWeek(now).key}`, 'weekly', quest.popcorn, 0, now)) throw new PetError('Награда недели уже получена');
      } else {
        const milestone = POPCORN_MILESTONES.find(m => m.id === body.id);
        if (!milestone) throw new PetError('Неизвестный рубеж');
        if (economy.activity[milestone.kind] < milestone.target) throw new PetError('Рубеж ещё не достигнут');
        if (!await entry(tx, userId, `milestone:${milestone.id}`, 'milestone', milestone.popcorn, 0, now)) throw new PetError('Награда за рубеж уже получена');
      }
      return;
    }
    if (action === 'care') {
      const kind = body.kind;
      if (typeof kind !== 'string' || !Object.hasOwn(PET_CARE, kind)) throw new PetError('Неизвестное действие заботы');
      const policy = PET_CARE[kind as keyof typeof PET_CARE];
      if (petProgress(pet.experience).level < policy.level) throw new PetError(`Нужен ${policy.level} уровень питомца`);
      if (pet.balance < policy.cost) throw new PetError('Не хватает попкорна');
      const granted = await entry(tx, userId, `care:${kind}:${petDay(now)}`, kind, -policy.cost, Math.floor(policy.xp * (1 + pet.archiveLevel / 10)), now);
      if (!granted) throw new PetError('Это действие уже выполнено сегодня (UTC)');
      return;
    }
    if (action === 'upgrade') {
      const kind = body.kind;
      if (kind !== 'projector' && kind !== 'archive') throw new PetError('Неизвестное улучшение');
      const level = kind === 'projector' ? pet.projectorLevel : pet.archiveLevel;
      if (body.expectedLevel !== level) throw new PetError('Уровень изменился. Обнови питомца перед покупкой');
      const price = PET_UPGRADES[kind].prices[level];
      if (price === undefined) throw new PetError('Улучшение уже максимальное');
      // Settle old-rate income BEFORE changing production speed; no retroactive boosted income.
      if (kind === 'projector') pet = await collect(tx, pet, now);
      if (pet.balance < price) throw new PetError('Не хватает попкорна');
      await entry(tx, userId, `upgrade:${kind}:${level + 1}`, `upgrade_${kind}`, -price, 0, now);
      await tx.update(cinemaPets).set(kind === 'projector' ? { projectorLevel: level + 1 } : { archiveLevel: level + 1 }).where(eq(cinemaPets.userId, userId));
      return;
    }
    if (action === 'quest') {
      const quest = PET_QUESTS.find(q => q.id === body.id);
      if (!quest) throw new PetError('Неизвестная миссия');
      const bounds = dayBounds(now);
      const [count] = await tx.select({ value: sql<number>`count(*)::int` }).from(popcornLedger).where(and(eq(popcornLedger.userId, userId), eq(popcornLedger.kind, quest.id), gte(popcornLedger.createdAt, bounds.start), lt(popcornLedger.createdAt, bounds.end)));
      if (count.value < quest.target) throw new PetError('Условие миссии ещё не выполнено');
      if (!await entry(tx, userId, `quest:${quest.id}:${petDay(now)}`, 'quest', quest.popcorn, quest.xp, now)) throw new PetError('Награда за миссию уже получена');
      return;
    }
    if (action === 'buy' || action === 'equip') {
      const id = body.id;
      const item = PET_ITEMS.find(i => i.id === id);
      const owned = parseOwnedItems(pet.ownedItems);
      if (action === 'buy') {
        if (!item) throw new PetError('Предмет не найден');
        if (owned.includes(item.id)) throw new PetError('Этот предмет уже куплен');
        if (pet.balance < item.price) throw new PetError('Не хватает попкорна');
        await entry(tx, userId, `purchase:${item.id}`, 'purchase', -item.price, 0, now);
        owned.push(item.id);
      } else if (id !== 'theme:classic' && id !== 'accessory:none' && (!item || !owned.includes(item.id))) throw new PetError('Предмет ещё не куплен');
      if (typeof id !== 'string') throw new PetError('Неверный предмет');
      const [type, value] = id.split(':');
      await tx.update(cinemaPets).set({ ownedItems: JSON.stringify(owned), ...(type === 'theme' ? { theme: value } : { accessory: value }) }).where(eq(cinemaPets.userId, userId));
      return;
    }
    if (action === 'customize') {
      if (typeof body.name !== 'string' || [...body.name.trim()].length < 1 || [...body.name.trim()].length > 24 || !['director', 'monster'].includes(String(body.branch)) || typeof body.showInProfile !== 'boolean') throw new PetError('Имя: 1–24 символа, выбери ветку и видимость');
      await tx.update(cinemaPets).set({ name: body.name.trim(), branch: body.branch as string, showInProfile: body.showInProfile }).where(eq(cinemaPets.userId, userId));
      return;
    }
    throw new PetError('Неизвестное действие');
  });
  return getPetSnapshot(userId);
}
