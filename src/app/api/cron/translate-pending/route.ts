import { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/api/cron-auth";
import { requireDb } from "@/lib/db/client";
import { items, translationJobs } from "@/lib/db/schema";
import {
  claimTranslationJobs,
  getPhraseCache,
  upsertPhraseCache,
  upsertTranslation,
} from "@/lib/db/queries";
import { extractTranslatableText } from "@/lib/translate/html";
import { translateBatch } from "@/lib/translate/qwen";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { sha256 } from "@/lib/utils/hash";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2_000;
const RATE_LIMIT_SLEEP_MS = 150;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempts: number) {
  // attempts 从 1 开始计数（claim 时已 +1）
  const exp = Math.min(8, Math.max(0, attempts - 1));
  const base = BASE_BACKOFF_MS * 2 ** exp;
  const jitter = base * (Math.random() * 0.4 - 0.2);
  return Math.max(0, Math.floor(base + jitter));
}

function cacheEligible(s: string) {
  const t = s.trim();
  if (t.length < 2) return false;
  if (t.length > 120) return false;
  if (t.includes("\n")) return false;
  return true;
}

async function translateWithPhraseCache(params: {
  texts: string[];
  lang: "zh" | "en";
}) {
  const { texts, lang } = params;
  if (texts.length === 0) return [];

  const hashes = texts.map((t) => (cacheEligible(t) ? sha256(t) : null));
  const want = hashes.filter((h): h is string => Boolean(h));

  const cached = want.length > 0 ? await getPhraseCache({ hashes: want, lang }) : [];
  const byHash = new Map(cached.map((r) => [r.textHash, r.translation]));

  const out: Array<string | null> = new Array(texts.length).fill(null);
  const missIdx: number[] = [];
  const missTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const h = hashes[i];
    if (!h) {
      missIdx.push(i);
      missTexts.push(texts[i]);
      continue;
    }
    const tr = byHash.get(h);
    if (tr) out[i] = tr;
    else {
      missIdx.push(i);
      missTexts.push(texts[i]);
    }
  }

  let missTranslated: string[] = [];
  if (missTexts.length > 0) {
    missTranslated = await translateBatch({ texts: missTexts, targetLang: lang });
    await sleep(RATE_LIMIT_SLEEP_MS);
  }

  const cacheWrites: Array<{ textHash: string; translation: string }> = [];

  // 回填 miss
  for (let j = 0; j < missIdx.length; j++) {
    const i = missIdx[j];
    const tr = missTranslated[j] ?? "";
    out[i] = tr;
    const h = hashes[i];
    if (h && cacheEligible(texts[i])) cacheWrites.push({ textHash: h, translation: tr });
  }

  // 对命中项也 +1 hits（用 upsert 同 translation）
  for (let i = 0; i < texts.length; i++) {
    const h = hashes[i];
    if (!h) continue;
    const tr = out[i];
    if (typeof tr === "string" && tr.length > 0) {
      cacheWrites.push({ textHash: h, translation: tr });
    }
  }

  // 去重（同 hash 多次出现只写一次）
  const uniq = new Map<string, string>();
  for (const e of cacheWrites) uniq.set(`${e.textHash}:${lang}`, e.translation);
  const entries = [
    ...uniq.entries(),
  ].map(([k, translation]) => ({ textHash: k.split(":")[0], translation }));

  await upsertPhraseCache({ lang, entries });

  return out.map((x) => (x ?? ""));
}


export async function GET(req: NextRequest) {
  const authRes = requireCronAuth(req);
  if (authRes) return authRes;

  const db = requireDb();
  const deadline = Date.now() + 45_000;
  const jobs = await claimTranslationJobs(10);

  const results: Array<{ id: number; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    if (Date.now() > deadline) break;
    const jobId = job.id;
    const itemId = job.itemId;
    const lang = (job.lang === "en" ? "en" : "zh") as "zh" | "en";

    try {
      const item = await db.query.items.findFirst({
        where: eq(items.id, itemId),
      });
      if (!item) throw new Error("item not found");

      const title = item.title ?? "";
      const textHtml = item.textHtml ?? "";

      const titleTrArr = title
        ? await translateWithPhraseCache({ texts: [stripHtml(title)], lang })
        : [""];
      const titleTranslated = title ? titleTrArr[0] ?? "" : null;

      let textTranslatedHtml: string | null = null;
      if (textHtml.trim().length > 0) {
        const extracted = extractTranslatableText(textHtml);
        const translatedTexts = await translateWithPhraseCache({
          texts: extracted.texts,
          lang,
        });
        textTranslatedHtml = sanitizeHtml(extracted.applyTranslations(translatedTexts));
      }

      await upsertTranslation({
        itemId,
        lang,
        sourceHash: item.sourceHash,
        titleTranslated,
        textTranslatedHtml,
      });

      await db
        .update(translationJobs)
        .set({ status: "done", finishedAt: new Date(), lastError: null })
        .where(eq(translationJobs.id, jobId));

      results.push({ id: jobId, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isBadModelJson = msg.startsWith("Unexpected translation output:");

      const attempts = typeof (job as any).attempts === "number" ? (job as any).attempts : 1;
      const shouldFail = !isBadModelJson && attempts >= MAX_ATTEMPTS;
      const nextRunAt = shouldFail
        ? new Date()
        : isBadModelJson
          ? new Date(Date.now() + 5_000)
          : new Date(Date.now() + backoffMs(attempts));

      // qwen 偶发输出不合法 JSON：不消耗 attempts，快速重试
      if (isBadModelJson) {
        await db.execute(sql`UPDATE translation_jobs SET attempts = GREATEST(attempts - 1, 0) WHERE id = ${jobId}`);
      }

      await db
        .update(translationJobs)
        .set({
          status: shouldFail ? "failed" : "pending",
          finishedAt: new Date(),
          lastError: msg,
          nextRunAt,
        })
        .where(eq(translationJobs.id, jobId));
      results.push({ id: jobId, ok: false, error: msg });
    }
  }

  return Response.json({ ok: true, processed: jobs.length, results });
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "");
}

