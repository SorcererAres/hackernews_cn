CREATE TABLE "items" (
	"id" integer PRIMARY KEY NOT NULL,
	"type" text,
	"by" text,
	"time" bigint,
	"parent" integer,
	"story_id" integer,
	"kids" jsonb,
	"url" text,
	"score" integer,
	"title" text,
	"text_html" text,
	"descendants" integer,
	"source_hash" text NOT NULL,
	"deleted" boolean DEFAULT false,
	"dead" boolean DEFAULT false,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"name" text PRIMARY KEY NOT NULL,
	"ids" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phrase_cache" (
	"text_hash" text NOT NULL,
	"lang" text NOT NULL,
	"translation" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phrase_cache_text_hash_lang_pk" PRIMARY KEY("text_hash","lang")
);
--> statement-breakpoint
CREATE TABLE "translation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"lang" text NOT NULL,
	"priority" integer NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"item_id" integer NOT NULL,
	"lang" text NOT NULL,
	"source_hash" text NOT NULL,
	"title_translated" text,
	"text_translated_html" text,
	"model" text DEFAULT 'qwen-mt-plus' NOT NULL,
	"translated_at" timestamp with time zone,
	CONSTRAINT "translations_item_id_lang_pk" PRIMARY KEY("item_id","lang")
);
--> statement-breakpoint
CREATE INDEX "items_type_time_idx" ON "items" USING btree ("type","time");--> statement-breakpoint
CREATE INDEX "items_parent_idx" ON "items" USING btree ("parent");--> statement-breakpoint
CREATE INDEX "items_story_id_idx" ON "items" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "translation_jobs_queue_idx" ON "translation_jobs" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_jobs_item_lang_uq" ON "translation_jobs" USING btree ("item_id","lang");