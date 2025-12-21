import { Effect, Layer, Console } from "effect";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-node";
import * as fs from "fs";
import * as path from "path";

const DB_PATH = "./scraper-cache.sqlite";
const BACKUP_SUFFIX = ".backup-double-encoded-fix";

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

const isDoubleEncodedArray = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed);
  } catch {
    return false;
  }
};

const isPipeDelimited = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) return false;
  try {
    JSON.parse(value);
    return false;
  } catch {
    return value.includes("|");
  }
};

const migrateDataObject = (
  data: Record<string, unknown>,
): { data: Record<string, unknown>; changed: boolean } => {
  let changed = false;
  const result = { ...data };

  for (const field of ARRAY_FIELDS) {
    const val = result[field];
    if (isDoubleEncodedArray(val)) {
      result[field] = JSON.parse(val);
      changed = true;
    } else if (isPipeDelimited(val)) {
      result[field] = (val as string).split("|").filter(Boolean);
      changed = true;
    }
  }

  // Fix skus[].marketId -> marketIds
  if (Array.isArray(result.skus)) {
    const newSkus = result.skus.map((sku: Record<string, unknown>) => {
      if ("marketId" in sku && typeof sku.marketId === "string") {
        const marketIds = sku.marketId.split("|").filter(Boolean);
        const { marketId, ...rest } = sku;
        changed = true;
        return { ...rest, marketIds };
      }
      if ("marketIds" in sku && typeof sku.marketIds === "string") {
        try {
          const parsed = JSON.parse(sku.marketIds);
          if (Array.isArray(parsed)) {
            changed = true;
            return { ...sku, marketIds: parsed };
          }
        } catch {
          const marketIds = (sku.marketIds as string).split("|").filter(Boolean);
          changed = true;
          return { ...sku, marketIds };
        }
      }
      return sku;
    });
    result.skus = newSkus;
  }

  // Fix cameras[].features
  if (Array.isArray(result.cameras)) {
    const newCameras = result.cameras.map((cam: Record<string, unknown>) => {
      const features = cam.features;
      if (typeof features === "string") {
        try {
          const parsed = JSON.parse(features);
          if (Array.isArray(parsed)) {
            changed = true;
            return { ...cam, features: parsed };
          }
        } catch {
          // Not JSON, check for pipe-delimited
        }
        if (features.includes("|")) {
          changed = true;
          return { ...cam, features: features.split("|").filter(Boolean) };
        } else if (features === "") {
          changed = true;
          return { ...cam, features: [] };
        }
      }
      return cam;
    });
    result.cameras = newCameras;
  }

  return { data: result, changed };
};

const migrateTable = (tableName: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const rows = yield* sql<{ slug: string; data: string }>`SELECT slug, data FROM ${sql.literal(tableName)}`;
    yield* Console.log(`\nProcessing ${tableName}: ${rows.length} rows`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        yield* Console.log(`  Skipping ${row.slug}: invalid JSON`);
        errorCount++;
        continue;
      }

      const { data: migrated, changed } = migrateDataObject(parsed);

      if (changed) {
        const newData = JSON.stringify(migrated);
        yield* sql`UPDATE ${sql.literal(tableName)} SET data = ${newData}, updated_at = ${Math.floor(Date.now() / 1000)} WHERE slug = ${row.slug}`;
        migratedCount++;
        yield* Console.log(`  Fixed: ${row.slug}`);
      }
    }

    yield* Console.log(`  Migrated: ${migratedCount}, Errors: ${errorCount}`);
    return { migratedCount, errorCount };
  });

const program = Effect.gen(function* () {
  yield* Console.log("=== Fix Double-Encoded JSON Migration ===\n");

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

  const rawResult = yield* migrateTable("phone_data_raw");
  const aiResult = yield* migrateTable("phone_data");

  yield* Console.log(`\n=== Migration Complete ===`);
  yield* Console.log(`phone_data_raw: ${rawResult.migratedCount} fixed`);
  yield* Console.log(`phone_data: ${aiResult.migratedCount} fixed`);
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
