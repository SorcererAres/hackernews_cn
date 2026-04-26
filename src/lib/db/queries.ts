import { and, eq, inArray, sql } from "drizzle-orm";

import { requireDb } from "@/lib/db/client";
import { items, lists, phraseCache, translations, translationJobs } from "@/lib/db/schema";
import { sha256 } from "@/lib/utils/hash";
import { type HnItem } from "@/lib/hn/types";

export async function upsertList(name: string, ids: number[]) {
  const db = requireDb();
  await db
    .insert(lists)
    .values({ name, ids, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: lists.name,
      set: { ids, updatedAt: new Date() },
    });
}

export async function getListIds(name: string): Promise<number[] | null> {
  const db = requireDb();
  const row = await db.query.lists.findFirst({
    where: eq(lists.name, name),
  });
  return row?.ids ?? null;
}

export function computeSourceHash(hn: HnItem) {
  return sha256(`${hn.title ?? ""}\n${hn.text ?? ""}`);
}

export async function upsertItem(hn: HnItem) {
  const db = requireDb();
  const sourceHash = computeSourceHash(hn);
  await db
    .insert(items)
    .values({
      id: hn.id,
      type: hn.type ?? null,
      by: hn.by ?? null,
      time: hn.time ?? null,
      parent: hn.parent ?? null,
      kids: hn.kids ?? null,
      url: hn.url ?? null,
      score: hn.score ?? null,
      title: hn.title ?? null,
      textHtml: hn.text ?? null,
      descendants: hn.descendants ?? null,
      deleted: hn.deleted ?? false,
      dead: hn.dead ?? false,
      sourceHash,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: items.id,
      set: {
        type: hn.type ?? null,
        by: hn.by ?? null,
        time: hn.time ?? null,
        parent: hn.parent ?? null,
        kids: hn.kids ?? null,
        url: hn.url ?? null,
        score: hn.score ?? null,
        title: hn.title ?? null,
        textHtml: hn.text ?? null,
        descendants: hn.descendants ?? null,
        deleted: hn.deleted ?? false,
        dead: hn.dead ?? false,
        sourceHash,
        fetchedAt: new Date(),
      },
    });
  return sourceHash;
}

export async function getItemsByIds(ids: number[]) {
  const db = requireDb();
  if (ids.length === 0) return [];
  return db.query.items.findMany({
    where: inArray(items.id, ids),
  });
}

export async function getTranslationsByIds(params: {
  ids: number[];
  lang: string;
}) {
  const db = requireDb();
  const { ids, lang } = params;
  if (ids.length === 0) return [];
  return db.query.translations.findMany({
    where: and(inArray(translations.itemId, ids), eq(translations.lang, lang)),
  });
}

export async function getStoryWithKids(storyId: number) {
  const db = requireDb();
  const story = await db.query.items.findFirst({ where: eq(items.id, storyId) });
  if (!story) return null;
  return story;
}

export async function getValidTranslation(itemId: number, lang: string, sourceHash: string) {
  const db = requireDb();
  const tr = await db.query.translations.findFirst({
    where: and(eq(translations.itemId, itemId), eq(translations.lang, lang)),
  });
  if (!tr) return null;
  if (tr.sourceHash !== sourceHash) return null;
  return tr;
}

export async function upsertTranslation(params: {
  itemId: number;
  lang: string;
  sourceHash: string;
  titleTranslated?: string | null;
  textTranslatedHtml?: string | null;
}) {
  const db = requireDb();
  const { itemId, lang, sourceHash, titleTranslated, textTranslatedHtml } = params;

  await db
    .insert(translations)
    .values({
      itemId,
      lang,
      sourceHash,
      titleTranslated: titleTranslated ?? null,
      textTranslatedHtml: textTranslatedHtml ?? null,
      model: "qwen-mt-plus",
      translatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [translations.itemId, translations.lang],
      set: {
        sourceHash,
        titleTranslated: titleTranslated ?? null,
        textTranslatedHtml: textTranslatedHtml ?? null,
        model: "qwen-mt-plus",
        translatedAt: new Date(),
      },
    });
}

export async function enqueueTranslation(params: {
  itemId: number;
  lang: string;
  priority: number;
}) {
  const db = requireDb();
  const { itemId, lang, priority } = params;
  await db
    .insert(translationJobs)
    .values({
      itemId,
      lang,
      priority,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [translationJobs.itemId, translationJobs.lang],
      set: {
        priority,
        status: "pending",
        lastError: null,
        attempts: 0,
        nextRunAt: new Date(),
        startedAt: null,
        finishedAt: null,
      },
    });
}

export async function claimTranslationJobs(limit: number) {
  const db = requireDb();
  // drizzle 没有直接暴露 SKIP LOCKED builder，这里用 raw SQL 最简单
  const rows = await db.execute(sql`
    UPDATE translation_jobs
    SET status = 'processing', started_at = NOW(), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM translation_jobs
      WHERE status = 'pending' AND next_run_at <= NOW()
      ORDER BY priority DESC, next_run_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *;
  `);
  const raw = rows.rows as Array<Record<string, unknown>>;
  return raw.map((r) => ({
    id: Number(r.id),
    itemId: Number(r.item_id),
    lang: String(r.lang),
    priority: Number(r.priority),
    attempts: Number(r.attempts ?? 0),
    nextRunAt: new Date(String(r.next_run_at)),
  }));
}



export async function getPhraseCache(params: {
  hashes: string[];
  lang: string;
}) {
  const db = requireDb();
  const { hashes, lang } = params;
  if (hashes.length === 0) return [];
  return db.query.phraseCache.findMany({
    where: and(inArray(phraseCache.textHash, hashes), eq(phraseCache.lang, lang)),
  });
}

export async function upsertPhraseCache(params: {
  lang: string;
  entries: Array<{ textHash: string; translation: string }>;
}) {
  const db = requireDb();
  const { lang, entries } = params;
  if (entries.length === 0) return;
  // 批量 upsert：命中则 hits+1，否则插入 hits=1
  await db.insert(phraseCache).values(
    entries.map((e) => ({
      textHash: e.textHash,
      lang,
      translation: e.translation,
      hits: 1,
      updatedAt: new Date(),
    }))
  ).onConflictDoUpdate({
    target: [phraseCache.textHash, phraseCache.lang],
    set: {
      translation: sql`excluded.translation`,
      hits: sql`${phraseCache.hits} + 1`,
      updatedAt: new Date(),
    },
  });
}
