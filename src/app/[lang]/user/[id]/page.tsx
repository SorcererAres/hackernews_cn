import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUser } from "@/lib/hn/client";
import { isLang, type Lang, t } from "@/lib/i18n/dictionary";
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

  const user = await fetchUser(id);
  if (!user) redirect(`/${lang}/top`);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{user.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-zinc-700">
            karma: <span className="font-medium text-zinc-950">{user.karma}</span>
          </div>
          <div className="text-zinc-700">
            created:{" "}
            <span className="font-medium text-zinc-950">
              {formatRelativeTime(user.created, lang)}
            </span>
          </div>
          {user.about ? (
            <div
              className="prose-hn text-sm leading-7"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(user.about) }}
            />
          ) : null}

          <div className="pt-2">
            <a
              className="underline underline-offset-2 text-zinc-700 hover:text-zinc-950"
              href={`https://news.ycombinator.com/user?id=${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {dict.viewOnHn}
            </a>
          </div>
        </CardContent>
      </Card>

      {Array.isArray(user.submitted) && user.submitted.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">submitted (latest 30)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc pl-5 space-y-1">
              {user.submitted.slice(0, 30).map((sid) => (
                <li key={sid}>
                  <Link
                    className="underline underline-offset-2 text-zinc-700 hover:text-zinc-950"
                    href={`/${lang}/item/${sid}`}
                  >
                    item {sid}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

