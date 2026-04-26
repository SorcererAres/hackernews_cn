export type HnItemType = "job" | "story" | "comment" | "poll" | "pollopt";

export type HnItem = {
  id: number;
  deleted?: boolean;
  type?: HnItemType;
  by?: string;
  time?: number;
  text?: string; // HTML
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string; // HTML
  parts?: number[];
  descendants?: number;
};

export type HnUser = {
  id: string;
  created: number;
  karma: number;
  about?: string; // HTML
  submitted?: number[];
};

export type HnListName = "top" | "new" | "best" | "ask" | "show" | "job";

