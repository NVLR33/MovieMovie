import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, watches, ratings, comments, bookmarks, movies, friendships } from '@/db/schema';
import { getUser } from '@/lib/auth';

// [API:PROFILE] Public profile data for viewing friend or community member profiles.
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(userId) || userId < 1) return NextResponse.json({ error: 'Неверный ID' }, { status: 400 });

  const me = await getUser();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

  const [userWatches, userRatings, userComments, userBookmarks, allFilms] = await Promise.all([
    db.select().from(watches).where(eq(watches.userId, userId)),
    db.select().from(ratings).where(eq(ratings.userId, userId)),
    db.select().from(comments).where(eq(comments.userId, userId)),
    db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
    db.select().from(movies),
  ]);

  // Check friendship status
  let friendStatus: string | null = null;
  let friendshipId: number | null = null;
  if (me && me.id !== userId) {
    const allFriendships = await db.select().from(friendships).where(
      eq(friendships.fromId, me.id)
    );
    const allFriendshipsReverse = await db.select().from(friendships).where(
      eq(friendships.toId, me.id)
    );
    const sent = allFriendships.find(f => f.toId === userId);
    const received = allFriendshipsReverse.find(f => f.fromId === userId);
    if (sent) { friendStatus = sent.status; friendshipId = sent.id; }
    else if (received) { friendStatus = received.status; friendshipId = received.id; }
  }

  const filmMap = Object.fromEntries(allFilms.map(f => [f.id, f]));
  const totalMinutes = userWatches.reduce((n, w) => n + (filmMap[w.movieId]?.duration || 0), 0);
  const uniqueFilms = new Set(userWatches.map(w => w.movieId)).size;
  const categories = ['Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм']
    .map(cat => ({
      name: cat,
      count: userWatches.filter(w => filmMap[w.movieId]?.category === cat).length,
      minutes: userWatches.filter(w => filmMap[w.movieId]?.category === cat).reduce((n, w) => n + (filmMap[w.movieId]?.duration || 0), 0),
    }));

  // Favorite genres
  const genreMap = new Map<string, number>();
  for (const w of userWatches) {
    const film = filmMap[w.movieId];
    if (film) {
      film.genre.split(',').map(g => g.trim()).forEach(g => genreMap.set(g, (genreMap.get(g) || 0) + 1));
    }
  }
  const topGenres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, c]) => ({ genre: g, count: c }));

  // Recent watches
  const recentWatches = [...userWatches].sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()).slice(0, 6).map(w => ({
    ...w,
    film: filmMap[w.movieId] ? { id: filmMap[w.movieId].id, title: filmMap[w.movieId].title, poster: filmMap[w.movieId].poster, year: filmMap[w.movieId].year, category: filmMap[w.movieId].category } : null,
  }));

  // User's rated films for comparison
  const userRatingsWithFilm = userRatings.map(r => ({
    movieId: r.movieId,
    value: r.value,
    title: filmMap[r.movieId]?.title || '',
  }));


  // Compatibility calculation
  let compatibility = 0;
  if (me && me.id !== userId) {
    const myWatches = await db.select().from(watches).where(eq(watches.userId, me.id));
    const myWatchesIds = new Set(myWatches.map(w => w.movieId));
    
    // 1. Watched overlap (max 40%)
    const overlapCount = userWatches.filter(w => myWatchesIds.has(w.movieId)).length;
    const maxWatches = Math.max(myWatches.length, userWatches.length);
    const watchScore = maxWatches > 0 ? (overlapCount / maxWatches) * 40 : 0;
    
    // 2. Rating diffs (max 30%)
    const myRatings = await db.select().from(ratings).where(eq(ratings.userId, me.id));
    const myRatingMap = new Map(myRatings.map(r => [r.movieId, r.value]));
    let ratingDiffSum = 0;
    let ratingOverlaps = 0;
    for (const ur of userRatings) {
      if (myRatingMap.has(ur.movieId)) {
        ratingOverlaps++;
        ratingDiffSum += Math.abs(ur.value - myRatingMap.get(ur.movieId)!);
      }
    }
    const maxDiff = 10; // max possible diff on 0.5 to 10 scale
    const ratingScore = ratingOverlaps > 0 ? (1 - (ratingDiffSum / ratingOverlaps) / maxDiff) * 30 : (watchScore > 0 ? 15 : 0);

    // 3. Genre overlap (max 30%)
    const myGenreMap = new Map<string, number>();
    for (const w of myWatches) {
      const film = filmMap[w.movieId];
      if (film) film.genre.split(',').map(g => g.trim()).forEach(g => myGenreMap.set(g, (myGenreMap.get(g) || 0) + 1));
    }
    let genreOverlap = 0;
    let myTotalGenres = [...myGenreMap.values()].reduce((a,b)=>a+b, 0);
    let theirTotalGenres = [...genreMap.values()].reduce((a,b)=>a+b, 0);
    const maxTotal = Math.max(myTotalGenres, theirTotalGenres);
    
    if (maxTotal > 0) {
      for (const [g, c] of genreMap.entries()) {
        if (myGenreMap.has(g)) {
          genreOverlap += Math.min(c, myGenreMap.get(g)!);
        }
      }
      const genreScore = (genreOverlap / maxTotal) * 30;
      compatibility = Math.min(100, Math.round(watchScore + ratingScore + genreScore));
    } else {
      compatibility = 0;
    }
    
    // Boost base compatibility a bit for visual effect
    if (compatibility > 0) compatibility = Math.min(100, compatibility + 25);
  }

  // Active days
  const activeDays = new Set(userWatches.map(w => new Date(w.watchedAt).toISOString().slice(0, 10))).size;

  return NextResponse.json({
    profile: {
      id: target.id,
      username: target.username,
      avatar: target.avatar,
      bio: target.bio,
      role: target.role,
      xp: target.xp,
      headerStyle: target.headerStyle,
      avatarFrame: target.avatarFrame,
      headerFrame: target.headerFrame, profileEffect: target.profileEffect, nameEffect: target.nameEffect, nameColor: target.nameColor,
      createdAt: target.createdAt,
    },
    stats: {
      totalWatches: userWatches.length,
      uniqueFilms,
      totalMinutes,
      totalRatings: userRatings.length,
      totalComments: userComments.length,
      totalBookmarks: userBookmarks.length,
      activeDays,
      categories,
      topGenres,
      level: Math.floor((target.xp || 0) / 500) + 1,
    },
    recentWatches,
    ratings: userRatingsWithFilm,
    friendship: { status: friendStatus, id: friendshipId },
    isSelf: me?.id === userId, compatibility,
  });
}
