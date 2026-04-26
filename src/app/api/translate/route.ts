import { NextRequest } from "next/server";
import { z } from "zod";

import { getItemsByIds, getTranslationsByIds, enqueueTranslation } from "@/lib/db/queries";

const QuerySchema = z.object({
  ids: z.string().min(1),
  lang: z.enum(["zh", "en"]).default("zh"),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    ids: url.searchParams.get("ids") ?? "",
    lang: url.searchParams.get("lang") ?? "zh",
  });
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const ids = parsed.data.ids
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));

  for (const id of ids) {
    await enqueueTranslation({ itemId: id, lang: parsed.data.lang, priority: 2 });
  }

  const items = await getItemsByIds(ids);
  const trs = await getTranslationsByIds({ ids, lang: parsed.data.lang });

  const trById = new Map(trs.map((x) => [x.itemId, x]));
  const out = items.map((it) => {
    const tr = trById.get(it.id);
    const valid = tr && tr.sourceHash === it.sourceHash ? tr : null;
    return {
      id: it.id,
      title: valid?.titleTranslated ?? null,
      html: valid?.textTranslatedHtml ?? null,
    };
  });

  return Response.json({ ok: true, items: out });
}

