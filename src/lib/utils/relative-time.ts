import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);

export function formatRelativeTime(unixSeconds: number | undefined, lang: "zh" | "en") {
  if (!unixSeconds) return "";
  const d = dayjs.unix(unixSeconds);
  if (lang === "zh") return d.locale("zh-cn").fromNow();
  return d.locale("en").fromNow();
}

