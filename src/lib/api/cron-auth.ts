import { NextRequest } from "next/server";

export function requireCronAuth(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Missing CRON_SECRET");

  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

