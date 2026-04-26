import { HnItem, HnListName, HnUser } from "@/lib/hn/types";

const BASE = process.env.HN_API_BASE ?? "https://hacker-news.firebaseio.com/v0";

function u(path: string) {
  return `${BASE}${path}.json`;
}

const listPath: Record<HnListName, string> = {
  top: "/topstories",
  new: "/newstories",
  best: "/beststories",
  ask: "/askstories",
  show: "/showstories",
  job: "/jobstories",
};

export async function fetchListIds(name: HnListName): Promise<number[]> {
  const res = await fetch(u(listPath[name]), {
    headers: {
      "user-agent": "HackerNews-CN/1.0",
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`HN list ${name} failed: ${res.status}`);
  return (await res.json()) as number[];
}

export async function fetchItem(id: number): Promise<HnItem | null> {
  const res = await fetch(u(`/item/${id}`), {
    headers: { "user-agent": "HackerNews-CN/1.0" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`HN item ${id} failed: ${res.status}`);
  return (await res.json()) as HnItem | null;
}

export async function fetchUser(id: string): Promise<HnUser | null> {
  const res = await fetch(u(`/user/${id}`), {
    headers: { "user-agent": "HackerNews-CN/1.0" },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`HN user ${id} failed: ${res.status}`);
  return (await res.json()) as HnUser | null;
}

