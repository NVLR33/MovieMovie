import { requirePlaybackSchema } from '@/lib/playback-schema';
import { requireTrailerSchema } from '@/lib/trailer-schema';
import { movieReadFields } from '@/lib/movie-read-fields';
import { canCreateMaterial, canModerate, isAdministrator } from '@/lib/permissions';
import { writeAdminAudit } from '@/lib/admin-audit';
import { manageAccount } from '@/lib/admin-server';
import { parseMaterialInput } from '@/lib/material-input';
import { handleMovieSuggestion, lockMaterial, existingMaterial } from '@/lib/movie-suggestions-server';
import { readJsonObject, RequestError, requestFailure, databaseId, isDatabaseFailure } from '@/lib/request-validation';
import { imageUrl } from '@/lib/image-storage';
import { awardPetActivity } from '@/lib/cinema-pet-server';
import { recordFirstViewer, recordPioneerActivity } from '@/lib/pioneer';
import { syncUserTitles, equipUserTitle } from '@/lib/user-titles-server';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql, ne, inArray, or, asc } from 'drizzle-orm';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { collabLists, collabItems } from '@/db/schema';
import { awardHiddenTrophy, recordTrophyWatch } from '@/lib/hidden-achievements';
import { validTrophyTimeZone, qualifiesForCounterCurrent } from '@/lib/hidden-achievement-rules';
import { syncChallengeProgress } from '@/lib/challenges';
import {
  users,
  movies,
  movieSuggestions,
  watches,
  ratings,
  comments,
  reactions,
  bookmarks,
  favorites,
  friendships,
  notifications,
  gameScores,
  messages,
  watchRooms,
  movieClub
} from '@/db/schema';

// [API:ACTIONS] Authenticated mutations with role and ownership checks.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Войдите в аккаунт, чтобы продолжить' },
      { status: 401 }
    );
  }

  try {
    const body = await readJsonObject(req);
    const action = String(body.action || '');
    for (const key of ['movieId', 'commentId', 'parentId', 'userId', 'listId', 'itemId', 'id']) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== '') body[key] = databaseId(body[key]);
    }
    const requiredIds: Record<string, string[]> = {
      commentEdit: ['commentId'], commentDelete: ['commentId'], commentSpoiler: ['commentId'], react: ['commentId'],
      friend: ['userId'], share: ['userId'], role: ['userId'], friendAccept: ['id'], approveSuggestion: ['id'], rejectSuggestion: ['id'], movieDelete: ['id'], addToList: ['listId'], voteList: ['itemId'],
    };
    for (const key of requiredIds[action] || []) body[key] = databaseId(body[key]);
    if (body.saved !== undefined && typeof body.saved !== 'boolean') throw new RequestError('Укажите состояние saved');
    const movieId = Number(body.movieId);
    let result: unknown = { ok: true };
    const unlockedTrophies: { id: string; name: string; icon: string; description: string }[] = [];
    const trophyTimeZone = validTrophyTimeZone(body.timeZone);

    // действия, которым нужен валидный фильм
    const filmActions = ['watch', 'unwatch', 'rate', 'bookmark', 'favorite', 'unfavorite', 'comment', 'share', 'addToList'];
    if (filmActions.includes(action)) {
      if (!Number.isSafeInteger(movieId) || movieId < 1) throw Error('Неверный ID материала');
      const [film] = await db
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.id, movieId))
        .limit(1);

      if (!film) throw Error('Материал не найден');
    }
    if (action === 'watch' || action === 'unwatch') {
      await db.transaction(async tx => {
        // Serialize this user's watch mutations, including the first insert with no row yet.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).for('update');
        if (action === 'watch') {
          const [existing] = await tx.select({ id: watches.id }).from(watches)
            .where(and(eq(watches.userId, user.id), eq(watches.movieId, movieId))).limit(1);
          if (!existing) {
            const [watchedFilm] = await tx.select({ category: movies.category }).from(movies).where(eq(movies.id, movieId));
            if (watchedFilm?.category === 'Фильм') await recordFirstViewer(tx, user.id, movieId);
            await tx.insert(watches).values({ userId: user.id, movieId });
            await awardPetActivity(tx, user.id, 'watch', movieId);
            unlockedTrophies.push(...await recordTrophyWatch(tx, user.id, movieId, new Date(), trophyTimeZone));
            await tx.update(users).set({ xp: sql`coalesce(${users.xp}, 0) + 35` })
              .where(eq(users.id, user.id));
          }
        } else {
          const removed = await tx.delete(watches)
            .where(and(eq(watches.userId, user.id), eq(watches.movieId, movieId)))
            .returning({ id: watches.id });
          // Undo the original reward so toggling watched cannot farm XP.
          if (removed.length) {
            await tx.update(users).set({ xp: sql`greatest(0, coalesce(${users.xp}, 0) - 35)` })
              .where(eq(users.id, user.id));
          }
        }
        await tx.delete(bookmarks)
          .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.movieId, movieId)));
        await syncUserTitles(tx, user.id);
      });
      await syncChallengeProgress(user.id);
      result = { ok: true, watched: action === 'watch', removedFromWatchlist: true };
    } else if (action === 'rate') {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0.5 || value > 10 || (value * 2) % 1 !== 0) {
        throw Error('Оценка должна быть от 0.5 до 10 с шагом 0.5');
      }
      await db.transaction(async tx => {
        // Consistent user -> movie lock order. Serialize same-film rating snapshots before the upsert.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).for('update');
        const [previous] = await tx.select({ value: ratings.value }).from(ratings)
          .where(and(eq(ratings.userId, user.id), eq(ratings.movieId, movieId))).limit(1);
        const [others] = await tx.select({ count: sql<number>`count(*)::int`, average: sql<number | null>`avg(${ratings.value})::float8` })
          .from(ratings).where(and(eq(ratings.movieId, movieId), ne(ratings.userId, user.id)));
        const qualifies = qualifiesForCounterCurrent(value, others, previous?.value);
        const inserted = await tx.insert(ratings)
          .values({ userId: user.id, movieId, value })
          .onConflictDoNothing({ target: [ratings.userId, ratings.movieId] })
          .returning({ id: ratings.id });
        if (inserted.length) {
          await awardPetActivity(tx, user.id, 'rate', movieId);
          await tx.update(users).set({ xp: sql`coalesce(${users.xp}, 0) + 10` })
            .where(eq(users.id, user.id));
        } else {
          await tx.update(ratings).set({ value })
            .where(and(eq(ratings.userId, user.id), eq(ratings.movieId, movieId)));
        }
        const pioneerAward = await recordPioneerActivity(tx, user.id, movieId, 'rated', trophyTimeZone);
        if (pioneerAward) unlockedTrophies.push(pioneerAward);
        if (qualifies) {
          const award = await awardHiddenTrophy(tx, user.id, 'against_the_current', new Date(), trophyTimeZone);
          if (award) unlockedTrophies.push(award);
        }
        await syncUserTitles(tx, user.id);
      });
    } else if (action === 'bookmark') {
      const saved = await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        const [existing] = await tx.select().from(bookmarks).where(and(eq(bookmarks.userId, user.id), eq(bookmarks.movieId, movieId))).limit(1);
        const desired = typeof body.saved === 'boolean' ? body.saved : !existing;
        if (desired) {
          const [watched] = await tx.select({ id: watches.id }).from(watches).where(and(eq(watches.userId, user.id), eq(watches.movieId, movieId))).limit(1);
          if (watched) throw Error('Этот материал уже просмотрен');
          await tx.insert(bookmarks).values({ userId: user.id, movieId }).onConflictDoNothing();
        } else await tx.delete(bookmarks).where(and(eq(bookmarks.userId, user.id), eq(bookmarks.movieId, movieId)));
        return desired;
      });
      result = { ok: true, saved };

    } else if (action === 'favorite') {
      const [existing] = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.movieId, movieId)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(favorites)
          .values({ userId: user.id, movieId })
          .onConflictDoNothing();
      }

      result = { ok: true, favorited: true };

    } else if (action === 'unfavorite') {
      await db.delete(favorites)
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.movieId, movieId)
          )
        );

      result = { ok: true, favorited: false };

    } else if (action === 'comment') {
      const text = String(body.text || '').trim().slice(0, 2000);
      if (text.length < 2) throw Error('Напишите комментарий');

      let parentId: number | null = null;
      let parentUserId: number | null = null;
      if (body.parentId) {
        const [parent] = await db
          .select()
          .from(comments)
          .where(eq(comments.id, Number(body.parentId)));

        if (!parent || parent.movieId !== movieId) throw Error('Комментарий не найден');
        let root = parent;
        const seen = new Set<number>();
        while (root.parentId) {
          if (seen.has(root.id)) throw Error('Повреждённая ветка комментариев');
          seen.add(root.id);
          const [ancestor] = await db.select().from(comments).where(eq(comments.id, root.parentId));
          if (!ancestor || ancestor.movieId !== movieId) throw Error('Комментарий не найден');
          root = ancestor;
        }
        parentId = root.id;

        parentUserId = parent.userId;
      }

      await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).for('update');
        await tx.insert(comments).values({ userId: user.id, movieId, parentId, body: text, spoiler: body.spoiler === true });
        if (!parentId && [...text].length >= 80) {
          await awardPetActivity(tx, user.id, 'review', movieId);
          const award = await recordPioneerActivity(tx, user.id, movieId, 'reviewed', trophyTimeZone);
          if (award) unlockedTrophies.push(award);
        }
        await tx.update(users).set({ xp: sql`coalesce(${users.xp}, 0) + 15` }).where(eq(users.id, user.id));
        await syncUserTitles(tx, user.id);
        if (parentUserId && parentUserId !== user.id) await tx.insert(notifications).values({ userId: parentUserId, actorId: user.id, message: `${user.username} ответил(а) на ваш комментарий`, link: `/movie/${movieId}` });
      });

    } else if (action === 'commentEdit') {
      // [ACTION:COMMENT_EDIT]
      // Пользователь может редактировать только свои комментарии

      const commentId = Number(body.commentId);
      const text = String(body.text || '').trim().slice(0, 2000);

      if (!Number.isInteger(commentId) || commentId <= 0) {
        throw Error('Некорректный комментарий');
      }

      if (text.length < 2) {
        throw Error('Комментарий должен содержать минимум 2 символа');
      }

      const [existing] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, commentId))
        .limit(1);

      if (!existing) {
        throw Error('Комментарий не найден');
      }

      if (existing.userId !== user.id) {
        return NextResponse.json(
          { error: 'Можно редактировать только свои комментарии' },
          { status: 403 }
        );
      }

      await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, existing.movieId)).for('update');
        const changed = await tx.update(comments).set({ body: text, editedAt: new Date(),
          ...(typeof body.spoiler === 'boolean' ? { spoiler: body.spoiler } : {})
        }).where(and(eq(comments.id, commentId), eq(comments.userId, user.id))).returning({ id: comments.id });
        if (!changed.length) throw Error('Комментарий не найден');
        if (!existing.parentId && [...text].length >= 80) {
          await awardPetActivity(tx, user.id, 'review', existing.movieId);
          const award = await recordPioneerActivity(tx, user.id, existing.movieId, 'reviewed', trophyTimeZone);
          if (award) unlockedTrophies.push(award);
        }
        await syncUserTitles(tx, user.id);
      });

      result = {
        ok: true,
        edited: true
      };

    } else if (action === 'commentSpoiler') {
      if (!canModerate(user)) throw new RequestError('Недостаточно прав',403);
      const commentId = Number(body.commentId);
      if (!Number.isSafeInteger(commentId) || commentId < 1 || typeof body.spoiler !== 'boolean') throw Error('Некорректный тег спойлера');
      const [target] = await db.select({ userId: comments.userId }).from(comments).where(eq(comments.id, commentId));
      if (!target) throw Error('Комментарий не найден');
      await db.transaction(async tx => {
        const accounts = await tx.select().from(users).where(inArray(users.id,[user.id,target.userId])).orderBy(asc(users.id)).for('update');
        if (!canModerate(accounts.find(account=>account.id===user.id))) throw new RequestError('Недостаточно прав',403);
        const changed = await tx.update(comments).set({ spoiler: body.spoiler }).where(eq(comments.id, commentId)).returning({ id: comments.id });
        if (!changed.length) throw Error('Комментарий не найден');
        await writeAdminAudit(tx,user,'comment.spoiler','comment',commentId,'Изменена отметка спойлера',{spoiler:body.spoiler});
        await syncUserTitles(tx, target.userId);
      });
    } else if (action === 'titleEquip') {
      await equipUserTitle(user.id, body.titleId);
    } else if (action === 'commentDelete') {
      // [ACTION:COMMENT_DELETE]
      // Автор удаляет своё, модератор — любое

      const commentId = Number(body.commentId);
      const reason = String(body.reason || '').trim().slice(0, 500);

      if (!Number.isInteger(commentId) || commentId <= 0) {
        throw Error('Некорректный комментарий');
      }

      const [existing] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, commentId))
        .limit(1);

      if (!existing) {
        throw Error('Комментарий не найден');
      }

      const isOwner = existing.userId === user.id;
      const isModerator = ['admin', 'moderator'].includes(user.role);

      if (!isOwner && !isModerator) {
        return NextResponse.json(
          { error: 'Недостаточно прав для удаления комментария' },
          { status: 403 }
        );
      }

      await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, existing.movieId)).for('update');
        if (!isOwner) {
          const [actor] = await tx.select().from(users).where(eq(users.id,user.id));
          if (!canModerate(actor)) throw new RequestError('Недостаточно прав',403);
          if (!reason) throw new RequestError('Для удаления чужого комментария укажите причину');
          await writeAdminAudit(tx,user,'comment.delete','comment',commentId,'Удалён комментарий с ответами',{reason,movieId:existing.movieId,authorId:existing.userId});
        }
        const descendants = sql`WITH RECURSIVE thread AS (SELECT id FROM ${comments} WHERE id=${commentId} UNION SELECT child.id FROM ${comments} child JOIN thread ON child.parent_id=thread.id) SELECT id FROM thread`;
        await tx.delete(reactions).where(sql`${reactions.commentId} IN (${descendants})`);
        await tx.delete(comments).where(sql`${comments.id} IN (${descendants})`);
        if (!isOwner && isModerator) await tx.insert(notifications).values({ userId: existing.userId, actorId: user.id, message: `🛡️ Ваш комментарий удалён модератором${reason ? ': ' + reason : ''}`, link: `/movie/${existing.movieId}` });
      });

      result = {
        ok: true,
        deleted: true
      };
  
  
    } else if (action === 'react') {
      const commentId = databaseId(body.commentId);
      await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        const [comment] = await tx.select().from(comments).where(eq(comments.id, commentId));
        if (!comment) throw Error('Комментарий не найден');
        await tx.select({ id: movies.id }).from(movies).where(eq(movies.id, comment.movieId)).for('update');
        const [existing] = await tx.select().from(reactions).where(and(eq(reactions.commentId, commentId), eq(reactions.userId, user.id)));
        if (existing) await tx.delete(reactions).where(eq(reactions.id, existing.id));
        else await tx.insert(reactions).values({ userId: user.id, commentId }).onConflictDoNothing();
        await tx.update(comments).set({ likes: sql`(SELECT count(*)::int FROM ${reactions} WHERE ${reactions.commentId}=${commentId})` }).where(eq(comments.id, commentId));
        if (!existing && comment.userId !== user.id) await tx.insert(notifications).values({ userId: comment.userId, actorId: user.id, message: `${user.username} понравился ваш комментарий`, link: `/movie/${comment.movieId}` });
      });
    } else if (action === 'friend') {
      const target = databaseId(body.userId);
      if (target === user.id) throw Error('Нельзя добавить себя');
      await db.transaction(async tx => {
        const people = await tx.select({ id: users.id }).from(users).where(inArray(users.id, [user.id, target])).orderBy(asc(users.id)).for('update');
        if (people.length !== 2) throw Error('Пользователь не найден');
        const [existing] = await tx.select().from(friendships).where(or(and(eq(friendships.fromId, user.id), eq(friendships.toId, target)), and(eq(friendships.fromId, target), eq(friendships.toId, user.id))));
        if (existing) throw Error(existing.status === 'accepted' ? 'Вы уже друзья' : 'Заявка уже существует: проверьте входящие');
        await tx.insert(friendships).values({ fromId: user.id, toId: target, status: 'pending' });
        await tx.insert(notifications).values({ userId: target, actorId: user.id, message: `${user.username} приглашает вас в друзья`, link: '/friends' });
      });
    } else if (action === 'friendAccept') {
      await db.transaction(async tx => {
        const [request] = await tx.update(friendships).set({ status: 'accepted' }).where(and(eq(friendships.id, body.id), eq(friendships.toId, user.id), eq(friendships.status, 'pending'))).returning();
        if (!request) {
          const [existing] = await tx.select().from(friendships).where(and(eq(friendships.id, body.id), eq(friendships.toId, user.id), eq(friendships.status, 'accepted')));
          if (!existing) throw Error('Заявка не найдена');
          return;
        }
        await tx.insert(notifications).values({ userId: request.fromId, actorId: user.id, message: `${user.username} принял(а) вашу заявку`, link: '/friends' });
      });
    } else if (action === 'notifyRead') {
      if (body.read !== undefined && typeof body.read !== 'boolean') throw new RequestError('Некорректное состояние уведомления');
      const read = body.read !== false;
      if (body.id === undefined) {
        if (!read) throw new RequestError('Укажите уведомление');
        // Preserve the legacy explicit mark-all action; opening the UI no longer calls it.
        await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
      } else {
        const changed = await db.update(notifications).set({ read })
          .where(and(eq(notifications.userId, user.id), eq(notifications.id, databaseId(body.id))))
          .returning({ id: notifications.id });
        if (!changed.length) throw new RequestError('Уведомление не найдено', 404);
      }
    } else if (action === 'profile') {
      const patch: Partial<typeof users.$inferInsert> = {};

      if (typeof body.bio === 'string') patch.bio = body.bio.slice(0, 100);

      if (typeof body.username === 'string') {
        const name = body.username.trim();
        if (name.length < 3 || name.length > 24) throw Error('Имя: от 3 до 24 символов');

        const [taken] = await db.select().from(users).where(eq(users.username, name));
        if (taken && taken.id !== user.id) throw Error('Имя занято');

        patch.username = name;
      }

      if (typeof body.headerImage === 'string') patch.headerImage = imageUrl(body.headerImage);
      if (['dark', 'light', 'pink', 'purple', 'yellow'].includes(body.theme)) patch.theme = body.theme;
      if (['ru', 'en'].includes(body.language)) patch.language = body.language;

      if (Number.isInteger(Number(body.headerStyle)) && Number(body.headerStyle) >= 1 && Number(body.headerStyle) <= 5) {
        const style = Number(body.headerStyle);
        if ((style === 4 && (user.xp || 0) < 1000) || (style === 5 && (user.xp || 0) < 2000)) {
          throw Error('Этот стиль откроется с новым уровнем');
        }
        patch.headerStyle = style;
      }

      const frameCost: Record<string, number> = {
        none: 0,
        gold: 500,
        neon: 1500,
        violet: 2500,
        sakura: 800,
        fire: 1200,
        ice: 1800,
        rainbow: 3000,
        cyberpunk: 2000,
        blood: 1600,
        emerald: 900,
        sunset: 1100,
        diamond: 3500,
        galaxy: 2800,
        glitch: 2200,
        anime: 1400
      };

      if (typeof body.avatarFrame === 'string' && body.avatarFrame in frameCost) {
        if ((user.xp || 0) < frameCost[body.avatarFrame]) throw Error(`Нужно ${frameCost[body.avatarFrame]} XP`);
        patch.avatarFrame = body.avatarFrame;
      }

      if (typeof body.headerFrame === 'string' && body.headerFrame in frameCost) {
        if ((user.xp || 0) < frameCost[body.headerFrame]) throw Error(`Нужно ${frameCost[body.headerFrame]} XP`);
        patch.headerFrame = body.headerFrame;
      }

      const effectCost: Record<string, number> = {
        none: 0,
        particles: 600,
        rain: 800,
        fireflies: 1000,
        snow: 700,
        stars: 900,
        aurora: 1500,
        matrix: 2000,
        cinema: 1200,
        spotlight: 1400
      };

      if (typeof body.profileEffect === 'string' && body.profileEffect in effectCost) {
        if ((user.xp || 0) < effectCost[body.profileEffect]) throw Error(`Нужно ${effectCost[body.profileEffect]} XP`);
        patch.profileEffect = body.profileEffect;
      }

      const nameEffects = [
        'none',
        'glow',
        'typewriter',
        'gradient',
        'shake',
        'rainbow',
        'neon-flicker',
        'fire-text',
        'ice-text',
        'glitch-text'
      ];

      if (typeof body.nameEffect === 'string' && nameEffects.includes(body.nameEffect)) {
        const neCost: Record<string, number> = {
          none: 0,
          glow: 300,
          typewriter: 400,
          gradient: 500,
          shake: 600,
          rainbow: 1000,
          'neon-flicker': 800,
          'fire-text': 1200,
          'ice-text': 1100,
          'glitch-text': 1500
        };

        if ((user.xp || 0) < (neCost[body.nameEffect] || 0)) throw Error(`Нужно ${neCost[body.nameEffect] || 0} XP`);
        patch.nameEffect = body.nameEffect;
      }

      const nameColors = [
        'default',
        'gold',
        'rose',
        'cyan',
        'lime',
        'orange',
        'purple-pink',
        'fire-gradient',
        'ocean-gradient',
        'aurora-gradient'
      ];

      if (typeof body.nameColor === 'string' && nameColors.includes(body.nameColor)) {
        const ncCost: Record<string, number> = {
          default: 0,
          gold: 200,
          rose: 200,
          cyan: 300,
          lime: 300,
          orange: 400,
          'purple-pink': 600,
          'fire-gradient': 800,
          'ocean-gradient': 900,
          'aurora-gradient': 1200
        };

        if ((user.xp || 0) < (ncCost[body.nameColor] || 0)) throw Error(`Нужно ${ncCost[body.nameColor] || 0} XP`);
        patch.nameColor = body.nameColor;
      }

      if (typeof body.tileOrder === 'string') patch.tileOrder = body.tileOrder.slice(0, 150);

      if (!Object.keys(patch).length) throw Error('Нет настроек для сохранения');
      await db.update(users).set(patch).where(eq(users.id, user.id));
    } else if (action === 'game') {
      const score = Number(body.score);
      const game = String(body.game || '').slice(0, 50);
      if (!Number.isInteger(score) || score < 0 || score > 5 || !['story','year','director','genre','poster','duration','country','original','category','higher','wordle','hangman','anagram','truths','chrono','connections'].includes(game)) throw Error('Некорректный результат');

      // Scores are currently calculated by the browser. Keep practice history, but
      // never turn an unverified/replayable client assertion into profile currency.
      await db.insert(gameScores).values({ userId: user.id, game, score });
    } else if (action === 'share') {
      const target = Number(body.userId);

      const [film] = await db.select(movieReadFields).from(movies).where(eq(movies.id, movieId));
      if (!film) throw Error('Материал не найден');

      const [friend] = await db.select().from(users).where(eq(users.id, target));
      if (!friend) throw Error('Пользователь не найден');
      const [friendship] = await db.select({ id: friendships.id }).from(friendships).where(and(
        eq(friendships.status, 'accepted'),
        or(and(eq(friendships.fromId, user.id), eq(friendships.toId, target)), and(eq(friendships.fromId, target), eq(friendships.toId, user.id)))
      )).limit(1);
      if (!friendship) return NextResponse.json({ error: 'Рекомендовать можно только друзьям' }, { status: 403 });

      await db.insert(notifications).values({
        userId: target,
        actorId: user.id,
        message: `${user.username} рекомендует вам «${film.title}»`,
        link: `/movie/${movieId}`
      });

    } else if (['suggestMovie', 'approveSuggestion', 'rejectSuggestion'].includes(action)) {
      result = await handleMovieSuggestion(user, body);
    } else if (action === 'movieSave') {
      if (body.id ? !canModerate(user) : !canCreateMaterial(user)) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
      }

      const input = parseMaterialInput(body);
      result = await db.transaction(async tx => {
        const [actor] = await tx.select().from(users).where(eq(users.id,user.id)).for('update');
        if (body.id ? !canModerate(actor) : !canCreateMaterial(actor)) throw new RequestError('Права изменились. Обновите страницу.',403);
        await requireTrailerSchema(tx);
        await requirePlaybackSchema(tx);
        await lockMaterial(tx, input);
        const duplicate = await existingMaterial(tx, input);
        if (duplicate && duplicate.id !== body.id) throw new RequestError('Такой материал уже существует. Используйте редактирование.', 409);
        if (body.id) {
          const updated = await tx.update(movies).set({...input, ...(body.playbackUrl === undefined ? {playbackUrl: undefined} : {})}).where(eq(movies.id, Number(body.id))).returning({ id: movies.id });
          if (!updated.length) throw new RequestError('Материал не найден', 404);
          await writeAdminAudit(tx, actor!, 'movie.update','movie',updated[0].id,input.title);
          return { ok: true, movieId: updated[0].id, created: false };
        }
        const [created] = await tx.insert(movies).values(input).returning({ id: movies.id });
        await writeAdminAudit(tx, actor!, 'movie.create','movie',created.id,input.title);
        return { ok: true, movieId: created.id, created: true };
      });
    } else if (action === 'questComplete') {
      // No server-defined daily quests exist: never accept XP rewards from the client.
      throw Error('Ежедневные задания пока недоступны');
    } else if (action === 'createList') {
      const title = typeof body.title === 'string' ? body.title.trim().slice(0,150) : '';
      if (!title) throw Error('Укажите название подборки');
      await db.insert(collabLists).values({ title, ownerId: user.id });
    } else if (action === 'addToList') {
      const listId = databaseId(body.listId);
      const [list] = await db.select({ id: collabLists.id }).from(collabLists).where(eq(collabLists.id, listId));
      if (!list) throw new RequestError('Подборка не найдена',404);

      const [existing] = await db
        .select()
        .from(collabItems)
        .where(and(eq(collabItems.listId, listId), eq(collabItems.movieId, movieId)));

      if (!existing) await db.insert(collabItems).values({ listId, movieId, addedById: user.id });
    } else if (action === 'voteList') {
      const itemId = Number(body.itemId);
      const changed = await db.update(collabItems).set({ votes: sql`coalesce(${collabItems.votes},0) + 1` }).where(eq(collabItems.id, itemId)).returning({ id: collabItems.id });
      if (!changed.length) throw new RequestError('Материал подборки не найден',404);
    } else if (action === 'movieDelete') {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
      }

      const id = Number(body.id);

      if (!Number.isSafeInteger(id) || id < 1) throw Error('Неверный ID материала');
      await db.transaction(async tx => {
        const [actor] = await tx.select().from(users).where(eq(users.id,user.id)).for('update');
        if (!isAdministrator(actor)) throw new RequestError('Недостаточно прав',403);
        const [film] = await tx.select(movieReadFields).from(movies).where(eq(movies.id,id)).for('update');
        if (!film) throw new RequestError('Материал не найден',404);
        await writeAdminAudit(tx, actor!, 'movie.delete','movie',id,film.title);
        const commentIds = tx.select({ id: comments.id }).from(comments).where(eq(comments.movieId, id));
        await tx.delete(reactions).where(inArray(reactions.commentId, commentIds));
        await tx.delete(comments).where(eq(comments.movieId, id));
        await tx.delete(ratings).where(eq(ratings.movieId, id));
        await tx.delete(watches).where(eq(watches.movieId, id));
        await tx.delete(bookmarks).where(eq(bookmarks.movieId, id));
        await tx.delete(favorites).where(eq(favorites.movieId, id));
        await tx.delete(collabItems).where(eq(collabItems.movieId, id));
        await tx.delete(watchRooms).where(eq(watchRooms.movieId, id));
        await tx.delete(movieClub).where(eq(movieClub.movieId, id));
        await tx.update(messages).set({ movieId: null }).where(eq(messages.movieId, id));
        await tx.update(movieSuggestions).set({ movieId: null }).where(eq(movieSuggestions.movieId, id));
        await tx.delete(movies).where(eq(movies.id, id));
      });
    } else if (action === 'role') {
      result = await manageAccount(user, { ...body, command: 'role' });
    } else {
      throw Error('Неизвестное действие');
    }

    return NextResponse.json(unlockedTrophies.length ? { ...(result as Record<string, unknown>), unlockedTrophies } : result);
  } catch (e) {
    if (e instanceof RequestError || isDatabaseFailure(e)) return requestFailure(e);
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ошибка сервера' },
      { status: 400 }
    );
  }
}
