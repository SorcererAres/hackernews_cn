import Link from "next/link";

import { Card } from "@/components/ui/card";
import { ViewOriginal } from "@/components/view-original";
import { type Lang, t } from "@/lib/i18n/dictionary";
import { enqueueTranslation, getTranslationsByIds } from "@/lib/db/queries";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { formatRelativeTime } from "@/lib/utils/relative-time";

type DbItem = {
  id: number;
  by: string | null;
  time: number | null;
  textHtml: string | null;
  kids: number[] | null;
  sourceHash: string;
  deleted: boolean | null;
  dead: boolean | null;
};

export async function CommentTree(props: {
  lang: Lang;
  storyId: number;
  items: Map<number, DbItem>;
  maxDepth?: number;
}) {
  const { lang, storyId, items, maxDepth = 20 } = props;
  const dict = t(lang);

  const story = items.get(storyId);
  const topKids = Array.isArray(story?.kids) ? story!.kids! : [];

  const allIds = [...items.keys()];
  const trRows =
    lang === "zh" ? await getTranslationsByIds({ ids: allIds, lang: "zh" }) : [];
  const trById = new Map(trRows.map((r) => [r.itemId, r]));

  function countSubtree(id: number, depth: number): number {
    const item = items.get(id);
    if (!item) return 0;
    if (depth > maxDepth) return 0;
    if (item.deleted || item.dead) return 0;
    const kids = Array.isArray(item.kids) ? item.kids : [];
    let n = 1;
    for (const k of kids) n += countSubtree(k, depth + 1);
    return n;
  }


  async function renderNode(id: number, depth: number) {
    const item = items.get(id);
    if (!item) return null;
    if (depth > maxDepth) return null;
    if (item.deleted || item.dead) return null;

    const tr = lang === "zh" ? trById.get(id) : null;
    const validTr = tr && tr.sourceHash === item.sourceHash ? tr : null;

    if (lang === "zh" && !validTr) {
      await enqueueTranslation({ itemId: id, lang: "zh", priority: 2 });
    }

    const html =
      lang === "zh"
        ? validTr?.textTranslatedHtml ?? null
        : item.textHtml ?? null;
    const original = item.textHtml ?? "";

    const kids = Array.isArray(item.kids) ? item.kids : [];

    const content = (
      <div key={id} className="space-y-2">
        <Card className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-600">
              <Link
                href={`/${lang}/user/${item.by ?? "unknown"}`}
                className="hover:underline underline-offset-2"
              >
                {item.by ?? "unknown"}
              </Link>
              <span className="mx-2 text-zinc-300">•</span>
              <span>{formatRelativeTime(item.time ?? undefined, lang)}</span>
            </div>
            {lang === "zh" && original ? (
              <ViewOriginal label={dict.viewOriginal} html={sanitizeHtml(original)} />
            ) : null}
          </div>

          <div className="mt-2 text-sm leading-6 text-zinc-950">
            {html ? (
              <div
                className="prose-hn"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
              />
            ) : (
              <div className="text-zinc-500 italic">
                {lang === "zh" ? dict.translating : ""}
              </div>
            )}
          </div>
        </Card>

        {kids.length > 0 ? (
          depth >= 3 ? (
            <details className="pl-4 border-l border-zinc-200">
              <summary className="cursor-pointer select-none text-xs text-zinc-600 hover:text-zinc-950">
                {dict.expandReplies} {kids.reduce((acc, k) => acc + countSubtree(k, depth + 1), 0)} {dict.comments}
              </summary>
              <div className="mt-2 space-y-2">
                {await Promise.all(kids.map((kid) => renderNode(kid, depth + 1)))}
                <div className="mt-2">
                  <span className="text-xs text-zinc-500">{dict.collapseReplies}</span>
                </div>
              </div>
            </details>
          ) : (
            <div className="pl-4 border-l border-zinc-200 space-y-2">
              {await Promise.all(kids.map((kid) => renderNode(kid, depth + 1)))}
            </div>
          )
        ) : null}
      </div>
    );

    if (depth > 3) {
      const hidden = countSubtree(id, depth);
      return (
        <details key={id} className="pl-4 border-l border-zinc-200">
          <summary className="cursor-pointer select-none text-xs text-zinc-600 hover:text-zinc-950">
            {dict.expandReplies} {hidden} {dict.comments}
          </summary>
          <div className="mt-2 space-y-2">{content}</div>
        </details>
      );
    }

    return content;
  }

  const rendered = await Promise.all(topKids.map((id) => renderNode(id, 1)));
  return <div className="space-y-3">{rendered}</div>;
}

