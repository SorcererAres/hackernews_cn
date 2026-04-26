import { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/api/cron-auth";
import { fetchItem } from "@/lib/hn/client";
import { getListIds, upsertItem } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LISTS = ["top", "new", "best", "ask", "show", "job"] as const;

const STORIES_PER_LIST = 15;
const KIDS_PER_STORY = 20;
const GRANDKIDS_PER_KID = 10;
const MAX_TOTAL_UPSERT = 250;


export async function GET(req: NextRequest) {
  const authRes = requireCronAuth(req);
  if (authRes) return authRes;

  const url = new URL(req.url);
  const storiesPerList = Number(url.searchParams.get("stories") ?? "") || STORIES_PER_LIST;
  const kidsPerStory = Number(url.searchParams.get("kids") ?? "") || KIDS_PER_STORY;
  const grandKidsPerKid = Number(url.searchParams.get("gkids") ?? "") || GRANDKIDS_PER_KID;
  const maxTotal = Number(url.searchParams.get("budget") ?? "") || MAX_TOTAL_UPSERT;

  let processed = 0;

  // 预拉 kids：只对热门 story，限制层级/数量，避免把 cron 拉爆
  async function upsertWithKids(storyId: number) {
    const story = await fetchItem(storyId);
    if (!story) return;
    await upsertItem(story);
    processed++;
    if (processed >= maxTotal) return;

    const kids = Array.isArray(story.kids) ? story.kids.slice(0, kidsPerStory) : [];
    for (const kidId of kids) {
      if (processed >= maxTotal) break;
      const kid = await fetchItem(kidId);
      if (!kid) continue;
      await upsertItem(kid);
      processed++;

      const grandKids = Array.isArray(kid.kids)
        ? kid.kids.slice(0, grandKidsPerKid)
        : [];
      for (const gkId of grandKids) {
        if (processed >= maxTotal) break;
        const gk = await fetchItem(gkId);
        if (!gk) continue;
        await upsertItem(gk);
        processed++;
      }
    }
  }

  for (const list of LISTS) {
    const ids = await getListIds(list);
    if (!ids) continue;

    for (const id of ids.slice(0, storiesPerList)) {
      if (processed >= maxTotal) break;
      await upsertWithKids(id);
    }

    if (processed >= maxTotal) break;
  }

  return Response.json({ ok: true, processed });
}

