import { redirect } from "next/navigation";

import { ListPage } from "@/features/list/list-page";
import { isLang, type Lang } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) redirect("/zh/top");
  const lang: Lang = raw;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p ?? "1") || 1);
  return <ListPage lang={lang} list="ask" page={page} />;
}

