-- Local test fixture: catalog schema before the series/pet upgrades. No user data.
CREATE TABLE "mg_bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL
);

CREATE TABLE "mg_challenge_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge_id" integer NOT NULL,
	"year" integer NOT NULL,
	"progress" integer DEFAULT 0,
	"completed" boolean DEFAULT false,
	"reward_claimed" boolean DEFAULT false NOT NULL
);

CREATE TABLE "mg_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"month" integer NOT NULL,
	"filter_genre" text,
	"filter_category" text,
	"target" integer DEFAULT 3 NOT NULL,
	"xp_reward" integer DEFAULT 300 NOT NULL,
	"icon" text DEFAULT '🎬'
);

CREATE TABLE "mg_collab_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"added_by_id" integer NOT NULL,
	"votes" integer DEFAULT 0
);

CREATE TABLE "mg_collab_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"owner_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"parent_id" integer,
	"body" text NOT NULL,
	"spoiler" boolean DEFAULT false NOT NULL,
	"likes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp
);

CREATE TABLE "mg_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_game_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_hidden_achievement_awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_zone" text NOT NULL
);

ALTER TABLE "mg_hidden_achievement_awards" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "mg_hidden_achievement_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"movie_id" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_zone" text NOT NULL,
	"week_key" text NOT NULL
);

ALTER TABLE "mg_hidden_achievement_events" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "mg_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"body" text NOT NULL,
	"movie_id" integer,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_movie_club" (
	"id" serial PRIMARY KEY NOT NULL,
	"movie_id" integer NOT NULL,
	"week_start" text NOT NULL,
	"active" boolean DEFAULT true
);

CREATE TABLE "mg_movie_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"year" integer NOT NULL,
	"genre" text NOT NULL,
	"category" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"review_reason" text,
	"movie_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);

CREATE TABLE "mg_movies" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"genre" text NOT NULL,
	"studio" text,
	"year" integer NOT NULL,
	"age_rating" text,
	"end_year" integer,
	"ongoing" boolean DEFAULT false,
	"duration" integer NOT NULL,
	"episodes" integer,
	"mood" text DEFAULT '',
	"poster" text NOT NULL,
	"backdrop" text,
	"watch_url" text,
	"director" text,
	"cast" text DEFAULT '' NOT NULL,
	"franchise" text DEFAULT '' NOT NULL,
	"festival_recognized" boolean DEFAULT false NOT NULL,
	"country" text,
	"featured" boolean DEFAULT false,
	"views" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"actor_id" integer,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"value" real NOT NULL
);

CREATE TABLE "mg_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"comment_id" integer NOT NULL
);

CREATE TABLE "mg_user_title_awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "mg_user_title_awards" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "mg_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text,
	"provider" text DEFAULT 'email',
	"provider_id" text,
	"role" text DEFAULT 'visitor' NOT NULL,
	"bio" text DEFAULT 'Кино — это больше, чем история.',
	"avatar" text,
	"theme" text DEFAULT 'dark',
	"language" text DEFAULT 'ru',
	"header_style" integer DEFAULT 1,
	"header_image" text,
	"avatar_frame" text DEFAULT 'none',
	"header_frame" text DEFAULT 'none',
	"profile_effect" text DEFAULT 'none',
	"name_effect" text DEFAULT 'none',
	"name_color" text DEFAULT 'default',
	"tile_order" text DEFAULT 'stats,genres,history,achievements,friends',
	"xp" integer DEFAULT 0,
	"equipped_title" text,
	"quests" text DEFAULT '{}',
	"last_quest_date" text,
	"telegram_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mg_users_email_unique" UNIQUE("email"),
	CONSTRAINT "mg_users_username_unique" UNIQUE("username")
);

CREATE TABLE "mg_watch_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"state" text DEFAULT 'paused',
	"time" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "mg_watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"watched_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "mg_bookmarks" ADD CONSTRAINT "mg_bookmarks_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_bookmarks" ADD CONSTRAINT "mg_bookmarks_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_challenge_progress" ADD CONSTRAINT "mg_challenge_progress_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_challenge_progress" ADD CONSTRAINT "mg_challenge_progress_challenge_id_mg_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."mg_challenges"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_collab_items" ADD CONSTRAINT "mg_collab_items_list_id_mg_collab_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."mg_collab_lists"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_collab_items" ADD CONSTRAINT "mg_collab_items_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_collab_items" ADD CONSTRAINT "mg_collab_items_added_by_id_mg_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_collab_lists" ADD CONSTRAINT "mg_collab_lists_owner_id_mg_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_comments" ADD CONSTRAINT "mg_comments_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_comments" ADD CONSTRAINT "mg_comments_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_favorites" ADD CONSTRAINT "mg_favorites_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_favorites" ADD CONSTRAINT "mg_favorites_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_friendships" ADD CONSTRAINT "mg_friendships_from_id_mg_users_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_friendships" ADD CONSTRAINT "mg_friendships_to_id_mg_users_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_game_scores" ADD CONSTRAINT "mg_game_scores_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_hidden_achievement_awards" ADD CONSTRAINT "mg_hidden_achievement_awards_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mg_hidden_achievement_events" ADD CONSTRAINT "mg_hidden_achievement_events_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mg_messages" ADD CONSTRAINT "mg_messages_from_id_mg_users_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_messages" ADD CONSTRAINT "mg_messages_to_id_mg_users_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_messages" ADD CONSTRAINT "mg_messages_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_movie_club" ADD CONSTRAINT "mg_movie_club_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_movie_suggestions" ADD CONSTRAINT "mg_movie_suggestions_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_movie_suggestions" ADD CONSTRAINT "mg_movie_suggestions_reviewed_by_mg_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_movie_suggestions" ADD CONSTRAINT "mg_movie_suggestions_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_notifications" ADD CONSTRAINT "mg_notifications_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_notifications" ADD CONSTRAINT "mg_notifications_actor_id_mg_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_ratings" ADD CONSTRAINT "mg_ratings_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_ratings" ADD CONSTRAINT "mg_ratings_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_reactions" ADD CONSTRAINT "mg_reactions_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_reactions" ADD CONSTRAINT "mg_reactions_comment_id_mg_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."mg_comments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_user_title_awards" ADD CONSTRAINT "mg_user_title_awards_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mg_watch_rooms" ADD CONSTRAINT "mg_watch_rooms_host_id_mg_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_watch_rooms" ADD CONSTRAINT "mg_watch_rooms_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_watches" ADD CONSTRAINT "mg_watches_user_id_mg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mg_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mg_watches" ADD CONSTRAINT "mg_watches_movie_id_mg_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."mg_movies"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "mg_bookmark_unique" ON "mg_bookmarks" USING btree ("user_id","movie_id");
CREATE UNIQUE INDEX "mg_favorite_unique" ON "mg_favorites" USING btree ("user_id","movie_id");
CREATE UNIQUE INDEX "mg_hidden_award_unique" ON "mg_hidden_achievement_awards" USING btree ("user_id","achievement_id");
CREATE UNIQUE INDEX "mg_hidden_event_unique" ON "mg_hidden_achievement_events" USING btree ("user_id","kind","movie_id");
CREATE INDEX "mg_hidden_event_week" ON "mg_hidden_achievement_events" USING btree ("user_id","kind","week_key");
CREATE UNIQUE INDEX "mg_rating_unique" ON "mg_ratings" USING btree ("user_id","movie_id");
CREATE UNIQUE INDEX "mg_reaction_unique" ON "mg_reactions" USING btree ("user_id","comment_id");
CREATE UNIQUE INDEX "mg_user_title_unique" ON "mg_user_title_awards" USING btree ("user_id","title_id");
