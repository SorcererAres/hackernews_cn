import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { CommentTree } from "@/components/comment-tree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ViewOriginal } from "@/components/view-original";
import { loadThread } from "@/features/item/load-thread";
import { isLang, type Lang, t } from "@/lib/i18n/dictionary";
import {
  enqueueTranslation,
  getValidTranslation,
} from "@/lib/db/queries";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { formatRelativeTime } from "@/lib/utils/relative-time";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  if (!isLang(rawLang)) redirect("/zh/top");
  const lang: Lang = rawLang;
  const dict = t(lang);

  const storyId = Number(id);
  if (!Number.isFinite(storyId)) redirect(`/${lang}/top`);

  const thread = await loadThread({ storyId, maxNodes: 200 });
  if (!thread) redirect(`/${lang}/top`);

  const story = thread.items.get(storyId)!;

  const storyTr =
    lang === "zh" ? await getValidTranslation(storyId, "zh", story.sourceHash) : null;

  if (lang === "zh" && !storyTr) {
    await enqueueTranslation({ itemId: storyId, lang: "zh", priority: 2 });
  }

  const title = stripHtml(
    (lang === "zh" ? storyTr?.titleTranslated : null) || story.title || `#${storyId}`
  );

  const bodyHtml =
    lang === "zh"
      ? storyTr?.textTranslatedHtml ?? null
      : story.textHtml ?? null;

  const originalBody = story.textHtml ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg leading-7">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <span>{(story.score ?? 0).toString()} {dict.points}</span>
            <Separator orientation="vertical" className="h-3" />
            <Link
              className="hover:underline underline-offset-2"
              href={`/${lang}/user/${story.by ?? "unknown"}`}
            >
              {dict.by} {story.by ?? "unknown"}
            </Link>
            <Separator orientation="vertical" className="h-3" />
            <span>{formatRelativeTime(story.time ?? undefined, lang)}</span>
            <Separator orientation="vertical" className="h-3" />
            <Link className="hover:underline underline-offset-2" href={`https://news.ycombinator.com/item?id=${storyId}`} target="_blank" rel="noopener noreferrer">
              {dict.viewOnHn}
            </Link>
            {story.url ? (
              <>
                <Separator orientation="vertical" className="h-3" />
                <a
                  className="hover:underline underline-offset-2 inline-flex items-center gap-1"
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            ) : null}
            {lang === "zh" && originalBody ? (
              <>
                <Separator orientation="vertical" className="h-3" />
                <ViewOriginal label={dict.viewOriginal} html={sanitizeHtml(originalBody)} />
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {bodyHtml ? (
            <div
              className="prose-hn text-sm leading-7"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
            />
          ) : (
            <div className="text-sm text-zinc-500 italic">
              {lang === "zh" ? dict.translating : ""}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm font-semibold text-zinc-900">
        {(story.descendants ?? 0).toString()} {dict.comments}
      </div>

      <CommentTree lang={lang} storyId={storyId} items={thread.items} />
    </div>
  );
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "");
}

