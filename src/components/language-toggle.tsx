"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Toggle } from "@/components/ui/toggle";

function swapLang(pathname: string, nextLang: "zh" | "en") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return `/${nextLang}/top`;
  if (parts[0] === "zh" || parts[0] === "en") parts[0] = nextLang;
  else parts.unshift(nextLang);
  return "/" + parts.join("/");
}

export function LanguageToggle({ lang }: { lang: "zh" | "en" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4 text-zinc-600" />
      <Toggle
        pressed={lang === "zh"}
        onPressedChange={() => {
          const nextLang = lang === "zh" ? "en" : "zh";
          const nextPath = swapLang(pathname, nextLang);
          const qs = sp.toString();
          router.replace(qs ? `${nextPath}?${qs}` : nextPath);
          document.cookie = `lang=${nextLang}; path=/; max-age=15552000`;
        }}
        aria-label="Toggle language"
        className="h-8 px-2"
      >
        {lang === "zh" ? "中" : "EN"}
      </Toggle>
    </div>
  );
}

