import { pgTable, jsonb, bigint, serial, text, integer, timestamp, real, boolean, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { MaterialInput } from '../lib/material-input';

// [DB:USERS] Account, roles, profile customization and progression.
export const users = pgTable('mg_users', {
  id: serial('id').primaryKey(), email: text('email').notNull().unique(), username: text('username').notNull().unique(), passwordHash: text('password_hash'), provider: text('provider').default('email'), providerId: text('provider_id'), role: text('role').notNull().default('visitor'), isEditor: boolean('is_editor').notNull().default(false), isSuspended: boolean('is_suspended').notNull().default(false), suspensionReason: text('suspension_reason'), sessionVersion: integer('session_version').notNull().default(0), bio: text('bio').default('Кино — это больше, чем история.'), avatar: text('avatar'), theme: text('theme').default('dark'), language: text('language').default('ru'), headerStyle: integer('header_style').default(1), headerImage: text('header_image'), avatarFrame: text('avatar_frame').default('none'), headerFrame: text('header_frame').default('none'), profileEffect: text('profile_effect').default('none'), nameEffect: text('name_effect').default('none'), nameColor: text('name_color').default('default'), tileOrder: text('tile_order').default('stats,genres,history,achievements,friends'), xp: integer('xp').default(0), equippedTitle: text('equipped_title'), quests: text('quests').default('{}'), lastQuestDate: text('last_quest_date'), telegramId: text('telegram_id'), createdAt: timestamp('created_at').defaultNow().notNull()
});
// [DB:MOVIES] Curated media library and watch destinations.
export const movies = pgTable('mg_movies', {
  id: serial('id').primaryKey(), title: text('title').notNull(), originalTitle: text('original_title'), description: text('description').notNull(), category: text('category').notNull(), genre: text('genre').notNull(), studio: text('studio'), year: integer('year').notNull(), ageRating: text('age_rating'), endYear: integer('end_year'), ongoing: boolean('ongoing').default(false), seriesCatalogComplete: boolean('series_catalog_complete').notNull().default(false), duration: integer('duration').notNull(), episodes: integer('episodes'), mood: text('mood').default(''), poster: text('poster').notNull(), backdrop: text('backdrop'), watchUrl: text('watch_url'), director: text('director'), cast: text('cast').notNull().default(''), franchise: text('franchise').notNull().default(''), festivalRecognized: boolean('festival_recognized').notNull().default(false), country: text('country'), featured: boolean('featured').default(false), views: integer('views').default(0), createdAt: timestamp('created_at').defaultNow().notNull()
});
// [DB:WATCHES] One viewing entry per session allows meaningful history and streaks.
export const watches = pgTable('mg_watches', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id), watchedAt: timestamp('watched_at').defaultNow().notNull() }, t => [index('mg_watch_user_movie').on(t.userId, t.movieId), index('mg_watch_user_date').on(t.userId, t.watchedAt), index('mg_watch_movie').on(t.movieId)]);
// [DB:RATINGS] Half-star ratings are unique per user and title.
export const ratings = pgTable('mg_ratings', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), movieId: integer('movie_id').notNull().references(() => movies.id), value: real('value').notNull() }, t => [uniqueIndex('mg_rating_unique').on(t.userId, t.movieId), index('mg_rating_movie_value').on(t.movieId, t.value)]);
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
}, t => [index('mg_comment_movie_date').on(t.movieId, t.createdAt)]);

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
export const notifications = pgTable('mg_notifications', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), actorId: integer('actor_id').references(() => users.id), message: text('message').notNull(), link: text('link'), read: boolean('read').default(false), createdAt: timestamp('created_at').defaultNow().notNull() }, t => [index('mg_notification_user_date').on(t.userId, t.createdAt)]);
export const gameScores = pgTable('mg_game_scores', { id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id), game: text('game').notNull(), score: integer('score').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() });
// [DB:MESSAGES] Direct messages between friends, with optional shared film attachment.
export const messages = pgTable('mg_messages', { id: serial('id').primaryKey(), fromId: integer('from_id').notNull().references(() => users.id), toId: integer('to_id').notNull().references(() => users.id), body: text('body').notNull(), movieId: integer('movie_id').references(() => movies.id), read: boolean('read').default(false), createdAt: timestamp('created_at').defaultNow().notNull() }, t => [index('mg_message_pair_date').on(t.fromId, t.toId, t.createdAt)]);

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

    material: jsonb('material').$type<MaterialInput>(),

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
  },
  t => [index('mg_suggestion_status_date').on(t.status, t.createdAt), index('mg_suggestion_user_status').on(t.userId, t.status)]
).enableRLS();

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


// Structured series catalog and private per-user ratings (server API only).
export const seriesSeasons = pgTable('mg_series_seasons', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull().default(''),
}, t => [uniqueIndex('mg_season_number_unique').on(t.movieId, t.number), check('mg_season_number_valid', sql`${t.number} between 1 and 100`)]).enableRLS();
export const seriesEpisodes = pgTable('mg_series_episodes', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seriesSeasons.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull().default(''),
}, t => [uniqueIndex('mg_episode_number_unique').on(t.seasonId, t.number), check('mg_episode_number_valid', sql`${t.number} between 1 and 100`)]).enableRLS();
export const seasonRatings = pgTable('mg_season_ratings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  seasonId: integer('season_id').notNull().references(() => seriesSeasons.id, { onDelete: 'cascade' }),
  value: real('value').notNull(),
}, t => [uniqueIndex('mg_season_rating_unique').on(t.userId, t.seasonId), check('mg_season_rating_valid', sql`${t.value} between 0.5 and 10 and ${t.value} * 2 = floor(${t.value} * 2)`)]).enableRLS();
export const episodeRatings = pgTable('mg_episode_ratings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').notNull().references(() => seriesEpisodes.id, { onDelete: 'cascade' }),
  value: real('value').notNull(),
}, t => [uniqueIndex('mg_episode_rating_unique').on(t.userId, t.episodeId), check('mg_episode_rating_valid', sql`${t.value} between 0.5 and 10 and ${t.value} * 2 = floor(${t.value} * 2)`)]).enableRLS();
// No title FK: earned serial completions survive catalog deletions.
export const seriesCompletions = pgTable('mg_series_completions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  movieId: integer('movie_id').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('mg_series_completion_unique').on(t.userId, t.movieId)]).enableRLS();
// First viewer is immutable. Nullable owner prevents reassigning a deleted user's discovery.
export const moviePioneers = pgTable('mg_movie_pioneers', {
  movieId: integer('movie_id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  firstWatchedAt: timestamp('first_watched_at', { withTimezone: true }).notNull().defaultNow(),
  rated: boolean('rated').notNull().default(false),
  reviewed: boolean('reviewed').notNull().default(false),
}).enableRLS();


export const cinemaPets = pgTable('mg_cinema_pets', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Поппи'),
  balance: integer('balance').notNull().default(0),
  experience: integer('experience').notNull().default(0),
  branch: text('branch').notNull().default('director'),
  theme: text('theme').notNull().default('classic'),
  accessory: text('accessory').notNull().default('none'),
  ownedItems: text('owned_items').notNull().default('[]'),
  projectorLevel: integer('projector_level').notNull().default(0),
  archiveLevel: integer('archive_level').notNull().default(0),
  productionCarry: integer('production_carry').notNull().default(0),
  showInProfile: boolean('show_in_profile').notNull().default(true),
  adoptedAt: timestamp('adopted_at', { withTimezone: true }),
  lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
}, t => [
  check('mg_pet_balance_valid', sql`${t.balance} >= 0`),
  check('mg_pet_experience_valid', sql`${t.experience} >= 0`),
  check('mg_pet_projector_valid', sql`${t.projectorLevel} between 0 and 5`),
  check('mg_pet_archive_valid', sql`${t.archiveLevel} between 0 and 3`),
  check('mg_pet_carry_valid', sql`${t.productionCarry} between 0 and 3599999`),
  check('mg_pet_branch_valid', sql`${t.branch} in ('director', 'monster')`),
  check('mg_pet_name_valid', sql`char_length(${t.name}) between 1 and 24`),
]).enableRLS();
export const popcornLedger = pgTable('mg_popcorn_ledger', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull(),
  kind: text('kind').notNull(),
  delta: integer('delta').notNull(),
  experienceDelta: integer('experience_delta').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('mg_popcorn_source_unique').on(t.userId, t.sourceKey), index('mg_popcorn_user_day').on(t.userId, t.createdAt), index('mg_popcorn_user_history').on(t.userId, t.id)]).enableRLS();

// One revision per audience (0 = public); no message bodies or replay log to retain.
export const realtimeVersions = pgTable('mg_realtime_versions', {
  audienceId: integer('audience_id').primaryKey(),
  revision: bigint('revision', { mode: 'bigint' }).notNull().default(sql`1`),
}, t => [check('mg_realtime_audience_valid', sql`${t.audienceId} >= 0`), check('mg_realtime_revision_valid', sql`${t.revision} > 0`)]).enableRLS();

// Private append-only application audit trail. Never contains passwords, tokens or private messages.
export const adminAudit = pgTable('mg_admin_audit', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').notNull().references(() => users.id),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  summary: text('summary').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('mg_admin_audit_actor_date').on(t.actorId, t.createdAt), index('mg_admin_audit_action_date').on(t.action, t.createdAt)]).enableRLS();
