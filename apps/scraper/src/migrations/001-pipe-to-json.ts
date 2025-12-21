import { Effect, Layer, Console } from "effect";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-node";
import * as fs from "fs";
import * as path from "path";

const DB_PATH = "./scraper-cache.sqlite";
const BACKUP_SUFFIX = ".backup-pipe-migration";

const ARRAY_FIELDS = [
  "aliases",
  "images",
  "materials",
  "colors",
  "displayFeatures",
  "cpuCores",
  "sim",
  "cameraFeatures",
  "others",
] as const;

const needsMigration = (value: unknown): boolean => {
  if (typeof value !== "string" || !value) return false;
  try {
    JSON.parse(value);
    return false;
  } catch {
    return value.includes("|");
  }
};

const migrateValue = (value: string): string =>
  JSON.stringify(value.split("|").filter(Boolean));

const migrateDataObject = (data: Record<string, unknown>): { data: Record<string, unknown>; changed: boolean } => {
  let changed = false;
  const result = { ...data };

  for (const field of ARRAY_FIELDS) {
    if (needsMigration(result[field])) {
      result[field] = migrateValue(result[field] as string);
      changed = true;
    }
  }

  return { data: result, changed };
};

const program = Effect.gen(function* () {
  yield* Console.log("=== Pipe to JSON Migration ===\n");

  const dbExists = fs.existsSync(DB_PATH);
  if (!dbExists) {
    yield* Console.log("Database not found at " + DB_PATH);
    return;
  }

  const backupPath = DB_PATH + BACKUP_SUFFIX;
  if (!fs.existsSync(backupPath)) {
    yield* Console.log(`Creating backup: ${backupPath}`);
    fs.copyFileSync(DB_PATH, backupPath);
  } else {
    yield* Console.log(`Backup already exists: ${backupPath}`);
  }

  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ slug: string; data: string }>`SELECT slug, data FROM phone_data_raw`;
  yield* Console.log(`Total rows in phone_data_raw: ${rows.length}`);

  let needsMigrationCount = 0;
  let migratedCount = 0;

  for (const row of rows) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.data);
    } catch {
      yield* Console.log(`  Skipping ${row.slug}: invalid JSON`);
      continue;
    }

    const { data: migrated, changed } = migrateDataObject(parsed);

    if (changed) {
      needsMigrationCount++;
      const newData = JSON.stringify(migrated);
      yield* sql`UPDATE phone_data_raw SET data = ${newData}, updated_at = ${Math.floor(Date.now() / 1000)} WHERE slug = ${row.slug}`;
      migratedCount++;
      yield* Console.log(`  Migrated: ${row.slug}`);
    }
  }

  yield* Console.log(`\n=== Migration Complete ===`);
  yield* Console.log(`Rows needing migration: ${needsMigrationCount}`);
  yield* Console.log(`Rows migrated: ${migratedCount}`);

  const verifyRows = yield* sql<{ slug: string; data: string }>`SELECT slug, data FROM phone_data_raw`;
  let validJsonCount = 0;
  for (const row of verifyRows) {
    try {
      const parsed = JSON.parse(row.data);
      let allFieldsValid = true;
      for (const field of ARRAY_FIELDS) {
        const val = parsed[field];
        if (typeof val === "string" && val.includes("|")) {
          allFieldsValid = false;
          break;
        }
      }
      if (allFieldsValid) validJsonCount++;
    } catch {
      // Invalid JSON
    }
  }
  yield* Console.log(`\nPost-check: ${validJsonCount}/${verifyRows.length} rows have valid JSON (no pipe-delimited fields)`);

  if (needsMigrationCount === 0) {
    yield* Console.log("\nNo data needed migration - all fields already in correct format.");
  }
});

const SqliteLive = SqliteClient.layer({
  filename: path.resolve(DB_PATH),
});

const main = program.pipe(
  Effect.provide(SqliteLive),
  Effect.catchAllCause((cause) =>
    Console.error(`Migration failed: ${cause.toString()}`),
  ),
);

Effect.runPromise(main);
