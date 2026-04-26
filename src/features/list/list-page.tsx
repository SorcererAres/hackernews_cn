import Link from "next/link";
import { ExternalLink } from "lucide-react";
import pLimit from "p-limit";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchItem, fetchListIds } from "@/lib/hn/client";
import { type HnListName } from "@/lib/hn/types";
import { type Lang, t } from "@/lib/i18n/dictionary";
import {
  enqueueTranslation,
  getItemsByIds,
  getListIds,
  getValidTranslation,
  upsertItem,
  upsertList,
} from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/utils/relative-time";

const PAGE_SIZE = 30;

export async function ListPage(props: {
  lang: Lang;
  list: HnListName;
  page: number;
}) {
  const { lang, list, page } = props;
  const dict = t(lang);

  let ids = await getListIds(list);
  if (!ids) {
    ids = await fetchListIds(list);
    await upsertList(list, ids);
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageIds = ids.slice(start, start + PAGE_SIZE);

  // 批量补齐 items（缺失则回源 HN）
  const existing = await getItemsByIds(pageIds);
  const byId = new Map(existing.map((x) => [x.id, x]));
  const missing = pageIds.filter((id) => !byId.has(id));

  const limit = pLimit(10);
  await Promise.all(
    missing.map((id) =>
      limit(async () => {
        const hn = await fetchItem(id);
        if (!hn) return;
        await upsertItem(hn);
      })
    )
  );

  const rows = await getItemsByIds(pageIds);
  const rowById = new Map(rows.map((x) => [x.id, x]));

  const viewModels = [];
  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i];
    const item = rowById.get(id);
    if (!item) continue;

    const sourceHash = item.sourceHash;
    const tr =
      lang === "zh" ? await getValidTranslation(item.id, "zh", sourceHash) : null;

    if (lang === "zh" && !tr) {
      // 列表页只排队翻标题即可（不阻塞渲染）
      await enqueueTranslation({ itemId: item.id, lang: "zh", priority: 1 });
    }

    viewModels.push({
      id,
      idx: start + i + 1,
      url: item.url,
      title: stripHtml((lang === "zh" ? tr?.titleTranslated : null) || item.title || `#${item.id}`),
      domain: item.url ? safeDomain(item.url) : null,
      score: item.score ?? 0,
      by: item.by ?? "unknown",
      time: item.time ?? undefined,
      comments: item.descendants ?? 0,
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-600">
            {list.toUpperCase()} · {PAGE_SIZE} / {ids.length}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              className="underline underline-offset-2 text-zinc-700 hover:text-zinc-950"
              href={`/${lang}/${list}?p=${Math.max(1, page - 1)}`}
            >
              Prev
            </Link>
            <span className="text-zinc-400">/</span>
            <Link
              className="underline underline-offset-2 text-zinc-700 hover:text-zinc-950"
              href={`/${lang}/${list}?p=${page + 1}`}
            >
              Next
            </Link>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {viewModels.map((vm) => (
          <Card key={vm.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 shrink-0 text-right tabular-nums text-sm text-zinc-500">
                  {vm.idx}.
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {vm.url ? (
                      <a
                        href={vm.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-medium text-zinc-950 hover:underline underline-offset-4"
                      >
                        {vm.title}
                      </a>
                    ) : (
                      <Link
                        href={`/${lang}/item/${vm.id}`}
                        className="font-medium text-zinc-950 hover:underline underline-offset-4"
                      >
                        {vm.title}
                      </Link>
                    )}
                    {vm.domain ? (
                      <span className="text-xs text-zinc-500">({vm.domain})</span>
                    ) : null}
                    {vm.url ? (
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                    ) : null}
                  </div>

                  <div className="text-xs text-zinc-600 flex flex-wrap items-center gap-2">
                    <span>
                      {vm.score.toString()} {dict.points}
                    </span>
                    <Separator orientation="vertical" className="h-3" />
                    <Link
                      className="hover:underline underline-offset-2"
                      href={`/${lang}/user/${vm.by}`}
                    >
                      {dict.by} {vm.by}
                    </Link>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{formatRelativeTime(vm.time, lang)}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <Link
                      className="hover:underline underline-offset-2"
                      href={`/${lang}/item/${vm.id}`}
                    >
                      {vm.comments} {dict.comments}
                    </Link>
                  </div>
                </div>
              </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function stripHtml(s: string) {
  // HN title/text 可能含 HTML（很少），列表页直接粗暴去标签
  return s.replace(/<[^>]*>/g, "");
}

