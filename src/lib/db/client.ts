import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;

export const db = DATABASE_URL
  ? drizzle(neon(DATABASE_URL), { schema })
  : null;

export function requireDb() {
  if (!db) throw new Error("Missing DATABASE_URL");
  return db;
}

