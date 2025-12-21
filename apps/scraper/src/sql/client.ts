import { SqliteClient } from "@effect/sql-sqlite-node";

const DB_PATH = process.env.SCRAPER_DB_PATH ?? "./scraper-cache.sqlite";

export const SqlClientLive = SqliteClient.layer({
  filename: DB_PATH,
  prepareCacheSize: 100,
  transformQueryNames: undefined,
  transformResultNames: undefined,
});
