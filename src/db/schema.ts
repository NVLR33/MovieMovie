import { pgTable, serial, text, integer, timestamp, real, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';

// [DB:USERS] Account, roles, profile customization and progression.
export const users = pgTable('mg_users', {
  id: serial('id').primaryKey(), email: text('email').notNull().unique(), username: text('username').notNull().unique(), passwordHash: text('password_hash'), provider: text('provider').default('email'), providerId: text('provider_id'), role: text('role').notNull().default('visitor'), bio: text('bio').default('Кино — это больше, чем история.'), avatar: text('avatar'), theme: text('theme').default('dark'), language: text('language').default('ru'), headerStyle: integer('header_style').default(1), headerImage: text('header_image'), avatarFrame: text('avatar_frame').default('none'), headerFrame: text('header_frame').default('none'), profileEffect: text('profile_effect').default('none'), nameEffect: text('name_effect').default('none'), nameColor: text('name_color').default('default'), tileOrder: text('tile_order').default('stats,genres,history,achievements,friends'), xp: integer('xp').default(0), equippedTitle: text('equipped_title'), quests: text('quests').default('{}'), lastQuestDate: text('last_quest_date'), telegramId: text('telegram_id'), createdAt: timestamp('created_at').defaultNow().notNull()
});
// [DB:MOVIES] Curated media library and watch destinations.
export const movies = pgTable('mg_movies', {
  id: serial('id').primaryKey(), title: text('title').notNull(), originalTitle: text('original_title'), description: text('description').notNull(), category: text('category').notNull(), genre: text('genre').notNull(), studio: text('studio'), year: integer('year').notNull(), ageRating: text('age_rating'), endYear: integer('end_year'), ongoing: boolean('ongoing').default(false), duration: integer('duration').notNull(), episodes: integer('episodes'), mood: text('mood').default(''), poster: text('poster').notNull(), backdrop: text('backdrop'), watchUrl: text('watch_url'), director: text('director'), cast: text('cast').notNull().default(''), franchise: text('franchise').notNull().default(''), festivalRecognized: boolean('festival_recognized').notNull().default(false), country: text('country'), featured: boolean('featured').default(false), views: integer('views').default(0), createdAt: timestamp('created_at').defaultNow().notNull()
});
// [DB:WATCHES] One viewing entry per session allows meaningful history and streaks.
export const watches = pgTable('mg_watches', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id), watchedAt: timestamp('watched_at').defaultNow().notNull() });
// [DB:RATINGS] Half-star ratings are unique per user and title.
export const ratings = pgTable('mg_ratings', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id), value: real('value').notNull() }, t => [uniqueIndex('mg_rating_unique').on(t.userId, t.movieId)]);
// [DB:COMMENTS] Threaded discussions and reactions.
// [DB:COMMENTS] Threaded discussions and reactions.
export const comments = pgTable('mg_comments', {
  id: serial('id').primaryKey(),

  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  movieId: integer('movie_id')
    .notNull()
    .references(() => movies.id),

  parentId: integer('parent_id'),

  body: text('body').notNull(),
  spoiler: boolean('spoiler').notNull().default(false),

  likes: integer('likes').default(0),

  createdAt: timestamp('created_at')
    .defaultNow()
    .notNull(),

  // Дата последнего редактирования
  editedAt: timestamp('edited_at'),
});

export const reactions = pgTable(
  'mg_reactions',
  {
    id: serial('id').primaryKey(),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id),

    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id),
  },
  t => [
    uniqueIndex('mg_reaction_unique').on(t.userId, t.commentId)
  ]
);
// [DB:SOCIAL] Bookmarks, friendships, and notification inbox.
export const bookmarks = pgTable('mg_bookmarks', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id) }, t => [uniqueIndex('mg_bookmark_unique').on(t.userId, t.movieId)]);
export const friendships = pgTable('mg_friendships', { id: serial('id').primaryKey(), fromId: integer('from_id').notNull().references(() => users.id), toId: integer('to_id').notNull().references(() => users.id), status: text('status').notNull().default('pending'), createdAt: timestamp('created_at').defaultNow().notNull() });
export const notifications = pgTable('mg_notifications', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), actorId: integer('actor_id').references(() => users.id), message: text('message').notNull(), link: text('link'), read: boolean('read').default(false), createdAt: timestamp('created_at').defaultNow().notNull() });
export const gameScores = pgTable('mg_game_scores', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), game: text('game').notNull(), score: integer('score').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() });
// [DB:MESSAGES] Direct messages between friends, with optional shared film attachment.
export const messages = pgTable('mg_messages', { id: serial('id').primaryKey(), fromId: integer('from_id').notNull().references(() => users.id), toId: integer('to_id').notNull().references(() => users.id), body: text('body').notNull(), movieId: integer('movie_id').references(() => movies.id), read: boolean('read').default(false), createdAt: timestamp('created_at').defaultNow().notNull() });

// [DB:COLLAB] Collaborative lists and watch rooms
export const collabLists = pgTable('mg_collab_lists', { id: serial('id').primaryKey(), title: text('title').notNull(), ownerId: integer('owner_id').notNull().references(() => users.id), createdAt: timestamp('created_at').defaultNow().notNull() });
export const collabItems = pgTable('mg_collab_items', { id: serial('id').primaryKey(), listId: integer('list_id').notNull().references(() => collabLists.id), movieId: integer('movie_id').notNull().references(() => movies.id), addedById: integer('added_by_id').notNull().references(() => users.id), votes: integer('votes').default(0) });
export const watchRooms = pgTable('mg_watch_rooms', { id: text('id').primaryKey(), hostId: integer('host_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id), state: text('state').default('paused'), time: integer('time').default(0), updatedAt: timestamp('updated_at').defaultNow().notNull() });
export const movieClub = pgTable('mg_movie_club', { id: serial('id').primaryKey(), movieId: integer('movie_id').notNull().references(() => movies.id), weekStart: text('week_start').notNull(), active: boolean('active').default(true) });
// [DB:CHALLENGES] Monthly challenges with XP rewards
export const challenges = pgTable('mg_challenges', { id: serial('id').primaryKey(), title: text('title').notNull(), description: text('description').notNull(), month: integer('month').notNull(), filterGenre: text('filter_genre'), filterCategory: text('filter_category'), target: integer('target').notNull().default(3), xpReward: integer('xp_reward').notNull().default(300), icon: text('icon').default('🎬') });
export const challengeProgress = pgTable('mg_challenge_progress', {
  id: serial('id').primaryKey(),

  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  challengeId: integer('challenge_id')
    .notNull()
    .references(() => challenges.id),

  year: integer('year').notNull(),

  progress: integer('progress').default(0),

  completed: boolean('completed').default(false),

  rewardClaimed: boolean('reward_claimed')
    .notNull()
    .default(false),
});

// [DB:FAVORITES] Personal favorite titles with unique user/movie pairs.
export const favorites = pgTable(
  'mg_favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    movieId: integer('movie_id').notNull().references(() => movies.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('mg_favorite_unique').on(t.userId, t.movieId),
  ]
);

// [DB:MOVIE_SUGGESTIONS] User-submitted movie proposals
export const movieSuggestions = pgTable(
  'mg_movie_suggestions',
  {
    id: serial('id').primaryKey(),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id),

    title: text('title').notNull(),

    year: integer('year').notNull(),

    genre: text('genre').notNull(),

    category: text('category').notNull(),

    comment: text('comment'),

    status: text('status')
      .notNull()
      .default('pending'),

    reviewedBy: integer('reviewed_by')
      .references(() => users.id),

    reviewReason: text('review_reason'),

    movieId: integer('movie_id')
      .references(() => movies.id),

    createdAt: timestamp('created_at')
      .defaultNow()
      .notNull(),

    reviewedAt: timestamp('reviewed_at'),
  }
);

// Event-time trophies are immutable. No movie FK: deleting a title must not erase earned history.
export const hiddenAchievementEvents = pgTable('mg_hidden_achievement_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  movieId: integer('movie_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  timeZone: text('time_zone').notNull(),
  weekKey: text('week_key').notNull(),
}, table => [
  uniqueIndex('mg_hidden_event_unique').on(table.userId, table.kind, table.movieId),
  index('mg_hidden_event_week').on(table.userId, table.kind, table.weekKey),
]).enableRLS();

export const hiddenAchievementAwards = pgTable('mg_hidden_achievement_awards', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  timeZone: text('time_zone').notNull(),
}, table => [uniqueIndex('mg_hidden_award_unique').on(table.userId, table.achievementId)]).enableRLS();

// Earned titles are permanent; the equipped choice remains separate from unlocks.
export const userTitleAwards = pgTable('mg_user_title_awards', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  titleId: text('title_id').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('mg_user_title_unique').on(table.userId, table.titleId)]).enableRLS();
