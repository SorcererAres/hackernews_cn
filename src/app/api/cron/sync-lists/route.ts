import { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/api/cron-auth";
import { fetchItem, fetchListIds } from "@/lib/hn/client";
import { type HnListName } from "@/lib/hn/types";
import { enqueueTranslation, upsertItem, upsertList } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LISTS: HnListName[] = ["top", "new", "best", "ask", "show", "job"];

export async function GET(req: NextRequest) {
  const authRes = requireCronAuth(req);
  if (authRes) return authRes;

  for (const name of LISTS) {
    const ids = await fetchListIds(name);
    await upsertList(name, ids);

    const head = ids.slice(0, 30);
    for (const id of head) {
      const item = await fetchItem(id);
      if (!item) continue;
      await upsertItem(item);
      await enqueueTranslation({ itemId: id, lang: "zh", priority: 1 });
    }
  }

  return Response.json({ ok: true, lists: LISTS });
}

