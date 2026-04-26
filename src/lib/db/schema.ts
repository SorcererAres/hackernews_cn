import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const items = pgTable(
  "items",
  {
    id: integer("id").primaryKey(),
    type: text("type"),
    by: text("by"),
    time: bigint("time", { mode: "number" }),
    parent: integer("parent"),
    storyId: integer("story_id"),
    kids: jsonb("kids").$type<number[]>(),
    url: text("url"),
    score: integer("score"),
    title: text("title"),
    textHtml: text("text_html"),
    descendants: integer("descendants"),
    sourceHash: text("source_hash").notNull(),
    deleted: boolean("deleted").default(false),
    dead: boolean("dead").default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  },
  (t) => ({
    idxTypeTime: index("items_type_time_idx").on(t.type, t.time),
    idxParent: index("items_parent_idx").on(t.parent),
    idxStoryId: index("items_story_id_idx").on(t.storyId),
  })
);

export const translations = pgTable(
  "translations",
  {
    itemId: integer("item_id").notNull(),
    lang: text("lang").notNull(), // 'zh' | 'en'(预留)
    sourceHash: text("source_hash").notNull(),
    titleTranslated: text("title_translated"),
    textTranslatedHtml: text("text_translated_html"),
    model: text("model").notNull().default("qwen-mt-plus"),
    translatedAt: timestamp("translated_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.itemId, t.lang] }),
  })
);

export const lists = pgTable("lists", {
  name: text("name").primaryKey(), // top/new/best/ask/show/job
  ids: jsonb("ids").$type<number[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const translationJobs = pgTable(
  "translation_jobs",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id").notNull(),
    lang: text("lang").notNull(),
    priority: integer("priority").notNull(), // 1/2/3
    status: text("status").notNull(), // pending|processing|done|failed
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    idxQueue: index("translation_jobs_queue_idx").on(t.status, t.nextRunAt, t.priority, t.createdAt),
    uqPending: uniqueIndex("translation_jobs_item_lang_uq").on(t.itemId, t.lang),
  })
);

export const phraseCache = pgTable(
  "phrase_cache",
  {
    textHash: text("text_hash").notNull(),
    lang: text("lang").notNull(),
    translation: text("translation").notNull(),
    hits: integer("hits").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.textHash, t.lang] }),
  })
);

