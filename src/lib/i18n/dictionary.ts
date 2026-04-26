export type Lang = "zh" | "en";

export function isLang(v: string): v is Lang {
  return v === "zh" || v === "en";
}

export function t(lang: Lang) {
  const zh = {
    top: "Top",
    new: "最新",
    best: "最佳",
    ask: "Ask",
    show: "Show",
    jobs: "Jobs",
    points: "分",
    by: "来自",
    comments: "评论",
    viewOnHn: "在 HN 查看",
    viewOriginal: "查看原文",
    translating: "翻译中…",
    expandReplies: "展开",
    collapseReplies: "收起",
  } as const;

  const en = {
    top: "Top",
    new: "New",
    best: "Best",
    ask: "Ask",
    show: "Show",
    jobs: "Jobs",
    points: "points",
    by: "by",
    comments: "comments",
    viewOnHn: "View on HN",
    viewOriginal: "View original",
    translating: "Translating…",
    expandReplies: "Show",
    collapseReplies: "Hide",
  } as const;

  return lang === "zh" ? zh : en;
}

