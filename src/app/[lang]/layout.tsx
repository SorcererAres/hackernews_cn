import Link from "next/link";
import { redirect } from "next/navigation";

import { LanguageToggle } from "@/components/language-toggle";
import { Separator } from "@/components/ui/separator";
import { isLang, t, type Lang } from "@/lib/i18n/dictionary";

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) redirect("/zh/top");
  const lang: Lang = raw;
  const dict = t(lang);

  const nav = [
    ["top", dict.top],
    ["new", dict.new],
    ["best", dict.best],
    ["ask", dict.ask],
    ["show", dict.show],
    ["jobs", dict.jobs],
  ] as const;

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/${lang}/top`}
              className="font-semibold tracking-tight text-zinc-950"
            >
              HackerNews CN
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              {nav.map(([key, label]) => (
                <Link
                  key={key}
                  href={`/${lang}/${key}`}
                  className="text-zinc-600 hover:text-zinc-950"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <LanguageToggle lang={lang} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-zinc-500 flex items-center justify-between">
          <span>Data: Hacker News API</span>
          <a
            className="underline underline-offset-2 hover:text-zinc-700"
            href="https://github.com/HackerNews/API"
            target="_blank"
            rel="noopener noreferrer"
          >
            API Docs
          </a>
        </div>
      </footer>
    </div>
  );
}

