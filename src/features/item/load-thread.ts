import pLimit from "p-limit";

import { fetchItem } from "@/lib/hn/client";
import { getItemsByIds, upsertItem } from "@/lib/db/queries";

type ItemRow = Awaited<ReturnType<typeof getItemsByIds>>[number];

export async function ensureItems(ids: number[]) {
  const existing = await getItemsByIds(ids);
  const byId = new Map(existing.map((x) => [x.id, x]));
  const missing = ids.filter((id) => !byId.has(id));

  if (missing.length > 0) {
    const limit = pLimit(12);
    await Promise.all(
      missing.map((id) =>
        limit(async () => {
          const hn = await fetchItem(id);
          if (!hn) return;
          await upsertItem(hn);
        })
      )
    );
  }

  const rows = await getItemsByIds(ids);
  return new Map<number, ItemRow>(rows.map((x) => [x.id, x]));
}

export async function loadThread(params: {
  storyId: number;
  maxNodes?: number;
}) {
  const { storyId, maxNodes = 200 } = params;

  // 确保 story 存在
  const storyMap = await ensureItems([storyId]);
  const story = storyMap.get(storyId);
  if (!story) return null;

  const seen = new Set<number>([storyId]);
  const stack: number[] = Array.isArray(story.kids) ? [...story.kids].reverse() : [];
  const all: number[] = [];

  // 深搜（更容易触达深层评论），按批次补拉 items
  while (stack.length > 0 && all.length < maxNodes) {
    const batch: number[] = [];

    while (stack.length > 0 && batch.length < 50 && all.length + batch.length < maxNodes) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      batch.push(id);
    }

    if (batch.length === 0) continue;

    const batchMap = await ensureItems(batch);

    for (const id of batch) {
      all.push(id);
      const item = batchMap.get(id);
      const kids = Array.isArray(item?.kids) ? item!.kids! : [];
      // 反向压栈，保证原顺序大致稳定
      for (let i = kids.length - 1; i >= 0; i--) {
        const kid = kids[i]!;
        if (all.length + stack.length >= maxNodes) break;
        if (!seen.has(kid)) stack.push(kid);
      }
      if (all.length >= maxNodes) break;
    }
  }

  const allIds = [storyId, ...all];
  const allMap = await ensureItems(allIds);

  return { storyId, allIds, items: allMap };
}

