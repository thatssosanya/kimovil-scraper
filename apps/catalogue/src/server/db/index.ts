import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import { env } from "@/src/env.mjs";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const createDrizzleClient = () => {
  return drizzle(client, { schema });
};

const globalForDrizzle = globalThis as unknown as {
  db?: ReturnType<typeof createDrizzleClient>;
};

export const db = globalForDrizzle.db || createDrizzleClient();

if (env.NODE_ENV !== "production") globalForDrizzle.db = db;

export type Database = typeof db;
