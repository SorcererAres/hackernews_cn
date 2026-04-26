import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

async function resolveLang() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLang = cookieStore.get("lang")?.value;
  if (cookieLang === "zh" || cookieLang === "en") return cookieLang;

  const accept = headerStore.get("accept-language") || "";
  return accept.toLowerCase().includes("zh") ? "zh" : "en";
}

export default async function Home() {
  const lang = await resolveLang();
  redirect(`/${lang}/top`);
}
