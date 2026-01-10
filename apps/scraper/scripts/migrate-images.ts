#!/usr/bin/env npx tsx
/**
 * Image Migration Script
 *
 * Migrates device images from imageExtractor local storage to Yandex S3.
 *
 * Usage:
 *   npx tsx scripts/migrate-images.ts --phase optimized --dry-run --limit 5
 *   npx tsx scripts/migrate-images.ts --phase original --concurrency 4
 *   npx tsx scripts/migrate-images.ts --phase all
 */

import "dotenv/config";
import { Effect, Layer, Chunk, Console } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import { SqlClient } from "@effect/sql";
import { SqlClientLive } from "../src/sql/client.js";
import { SchemaLive } from "../src/sql/schema.js";
import { StorageService, StorageServiceLive } from "../src/services/storage.js";

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const phase = (getArg("phase") ?? "all") as "optimized" | "original" | "all";
const dryRun = hasFlag("dry-run");
const concurrency = parseInt(getArg("concurrency") ?? "4", 10);
const limit = getArg("limit") ? parseInt(getArg("limit")!, 10) : undefined;

const EXTRACTOR_DB_PATH = path.join(
  process.env.HOME!,
  "projects/imageExtractor/extractor.sqlite"
);

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

interface ExtractorImage {
  id: number;
  source: string;
  data_kind: string;
  slug: string;
  image_index: number;
  original_url: string;
  original_ext: string | null;
  original_path: string | null;
  opt_hq_path: string | null;
  status: string;
}

interface ImageTask {
  slug: string;
  imageIndex: number;
  variant: "hq" | "med" | "mini" | "original";
  localPath: string;
  storageKey: string;
  originalUrl: string;
  format: string;
}

const readExtractorImages = (): ExtractorImage[] => {
  console.log(`Using extractor DB at: ${EXTRACTOR_DB_PATH}`);
  const db = new Database(EXTRACTOR_DB_PATH, { readonly: true });
  const rows = db
    .prepare(
      `SELECT id, source, data_kind, slug, image_index, original_url, original_ext, original_path, opt_hq_path, status
       FROM images
       WHERE source = 'kimovil' AND data_kind = 'specs' AND image_index = 0
       ORDER BY slug`
    )
    .all() as ExtractorImage[];
  db.close();
  return rows;
};

const buildTasks = (images: ExtractorImage[], targetPhase: typeof phase): ImageTask[] => {
  const tasks: ImageTask[] = [];

  for (const img of images) {
    // Flat URL structure: {slug}-{suffix}.{ext}
    // e.g., samsung-galaxy-s24-ultra-hq.avif, samsung-galaxy-s24-ultra-med.avif, samsung-galaxy-s24-ultra-mini.avif
    if (targetPhase === "optimized" || targetPhase === "all") {
      if (img.opt_hq_path && fs.existsSync(img.opt_hq_path)) {
        const baseDir = path.dirname(img.opt_hq_path);
        
        // HQ variant
        tasks.push({
          slug: img.slug,
          imageIndex: img.image_index,
          variant: "hq",
          localPath: img.opt_hq_path,
          storageKey: `${img.slug}-hq.avif`,
          originalUrl: img.original_url,
          format: "avif",
        });
        
        // Med variant
        const medPath = path.join(baseDir, "0-med.avif");
        if (fs.existsSync(medPath)) {
          tasks.push({
            slug: img.slug,
            imageIndex: img.image_index,
            variant: "med",
            localPath: medPath,
            storageKey: `${img.slug}-med.avif`,
            originalUrl: img.original_url,
            format: "avif",
          });
        }
        
        // Mini variant
        const miniPath = path.join(baseDir, "0-mini.avif");
        if (fs.existsSync(miniPath)) {
          tasks.push({
            slug: img.slug,
            imageIndex: img.image_index,
            variant: "mini",
            localPath: miniPath,
            storageKey: `${img.slug}-mini.avif`,
            originalUrl: img.original_url,
            format: "avif",
          });
        }
      }
    }

    if (targetPhase === "original" || targetPhase === "all") {
      if (img.original_path && fs.existsSync(img.original_path)) {
        const ext = img.original_ext ?? path.extname(img.original_path).slice(1);
        tasks.push({
          slug: img.slug,
          imageIndex: img.image_index,
          variant: "original",
          localPath: img.original_path,
          storageKey: `${img.slug}-original.${ext}`,
          originalUrl: img.original_url,
          format: ext,
        });
      }
    }
  }

  return tasks;
};

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const storage = yield* StorageService;

  yield* Console.log(`=== Image Migration Script ===`);
  yield* Console.log(`Phase: ${phase}`);
  yield* Console.log(`Dry run: ${dryRun}`);
  yield* Console.log(`Concurrency: ${concurrency}`);
  if (limit) yield* Console.log(`Limit: ${limit}`);
  yield* Console.log(``);

  // Read imageExtractor DB
  yield* Console.log(`Reading imageExtractor database...`);
  const extractorImages = readExtractorImages();
  yield* Console.log(`Found ${extractorImages.length} images in extractor DB`);

  // Build upload tasks
  const allTasks = buildTasks(extractorImages, phase);
  yield* Console.log(`Built ${allTasks.length} upload tasks`);

  // Apply limit
  const tasks = limit ? allTasks.slice(0, limit) : allTasks;
  yield* Console.log(`Processing ${tasks.length} tasks`);
  yield* Console.log(``);

  // Get existing uploads to skip
  const existingRows = (yield* sql`
    SELECT device_id, variant
    FROM device_images
    WHERE source = 'kimovil'
      AND kind = 'primary'
      AND image_index = 0
      AND status = 'uploaded'
  `) as Array<{ device_id: string; variant: string }>;

  // Build device_id -> slug mapping for lookup
  const deviceRows = (yield* sql`
    SELECT id, slug FROM devices
  `) as Array<{ id: string; slug: string }>;

  const slugToDeviceId = new Map(deviceRows.map((r) => [r.slug, r.id]));
  const existingSet = new Set(existingRows.map((r) => `${r.device_id}:${r.variant}`));

  yield* Console.log(`Found ${existingSet.size} already-uploaded images to skip`);

  // Filter out already-uploaded
  const pendingTasks = tasks.filter((t) => {
    const deviceId = slugToDeviceId.get(t.slug);
    if (!deviceId) return true; // Will fail later with "device not found"
    return !existingSet.has(`${deviceId}:${t.variant}`);
  });

  yield* Console.log(`${pendingTasks.length} tasks remaining after filtering`);
  yield* Console.log(``);

  if (pendingTasks.length === 0) {
    yield* Console.log(`Nothing to do!`);
    return;
  }

  let processed = 0;
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  const processTask = (task: ImageTask) =>
    Effect.gen(function* () {
      const deviceId = slugToDeviceId.get(task.slug);

      if (!deviceId) {
        yield* Effect.logWarning(`Device not found for slug: ${task.slug}`);
        skipped++;
        return;
      }

      if (dryRun) {
        yield* Console.log(`[DRY RUN] Would upload: ${task.storageKey}`);
        processed++;
        return;
      }

      // Read file
      const buffer = yield* Effect.try({
        try: () => fs.readFileSync(task.localPath),
        catch: (e) => new Error(`Failed to read file ${task.localPath}: ${e}`),
      });

      const contentType = CONTENT_TYPES[task.format.toLowerCase()] ?? "application/octet-stream";

      // Upload to S3 - returns true on success, false on failure
      const uploadOk = yield* storage
        .putObject({
          key: task.storageKey,
          contentType,
          body: buffer,
        })
        .pipe(
          Effect.as(true),
          Effect.catchAll((e) =>
            Effect.gen(function* () {
              yield* Effect.logError(`Upload failed for ${task.storageKey}: ${e.message}`);
              // Record error in DB
              yield* sql`
                INSERT INTO device_images (
                  device_id, source, kind, image_index, variant,
                  storage_key, cdn_url, original_url, format, status, last_error
                ) VALUES (
                  ${deviceId}, 'kimovil', 'primary', ${task.imageIndex}, ${task.variant},
                  ${task.storageKey}, '', ${task.originalUrl}, ${task.format},
                  'error', ${e.message}
                )
                ON CONFLICT (device_id, source, kind, image_index, variant)
                DO UPDATE SET status = 'error', last_error = ${e.message}, updated_at = unixepoch()
              `;
              errors++;
              processed++;
              return false as const;
            })
          )
        );

      if (!uploadOk) {
        return; // Don't mark as uploaded
      }

      // Record success only if upload succeeded
      const cdnUrl = storage.publicUrl(task.storageKey);
      yield* sql`
        INSERT INTO device_images (
          device_id, source, kind, image_index, variant,
          storage_key, cdn_url, original_url, format, status
        ) VALUES (
          ${deviceId}, 'kimovil', 'primary', ${task.imageIndex}, ${task.variant},
          ${task.storageKey}, ${cdnUrl}, ${task.originalUrl}, ${task.format},
          'uploaded'
        )
        ON CONFLICT (device_id, source, kind, image_index, variant)
        DO UPDATE SET
          storage_key = ${task.storageKey},
          cdn_url = ${cdnUrl},
          status = 'uploaded',
          last_error = NULL,
          updated_at = unixepoch()
      `;

      processed++;
      uploaded++;

      // Progress logging
      if (processed % 50 === 0) {
        yield* Console.log(`Progress: ${processed}/${pendingTasks.length} (uploaded: ${uploaded}, errors: ${errors})`);
      }
    }).pipe(
      Effect.catchAll((e) =>
        Effect.gen(function* () {
          yield* Effect.logError(`Task failed for ${task.slug}: ${e}`);
          errors++;
          processed++;
        })
      )
    );

  // Process in batches with concurrency
  const chunks = Chunk.fromIterable(pendingTasks);
  yield* Effect.forEach(
    Chunk.toReadonlyArray(chunks),
    processTask,
    { concurrency }
  );

  yield* Console.log(``);
  yield* Console.log(`=== Migration Complete ===`);
  yield* Console.log(`Processed: ${processed}`);
  yield* Console.log(`Uploaded: ${uploaded}`);
  yield* Console.log(`Skipped: ${skipped}`);
  yield* Console.log(`Errors: ${errors}`);
});

const SqlLayer = SchemaLive.pipe(Layer.provideMerge(SqlClientLive));

const MainLive = Layer.mergeAll(SqlLayer, StorageServiceLive);

const runnable = program.pipe(Effect.provide(MainLive));

Effect.runPromise(runnable).catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
