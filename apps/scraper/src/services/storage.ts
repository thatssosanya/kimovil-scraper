import { Effect, Layer, Context } from "effect";
import { Database } from "bun:sqlite";

export class StorageError extends Error {
  readonly _tag = "StorageError";
}

export interface KimovilDevice {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  isRumor: boolean;
  raw: string;
  firstSeen: number;
  lastSeen: number;
}

export interface KimovilPrefixState {
  prefix: string;
  depth: number;
  status: "pending" | "done";
  lastResultCount: number | null;
  lastRunAt: number | null;
}

export type ScrapeMode = "fast" | "complex";
export type ScrapeStatus = "pending" | "running" | "done" | "error";
export type BulkJobStatus = "pending" | "running" | "paused" | "done" | "error";

export interface ScrapeQueueItem {
  id: number;
  slug: string;
  jobId: string | null;
  mode: ScrapeMode;
  status: ScrapeStatus;
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: number | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  lastErrorCode: string | null;
}

export interface BulkJob {
  id: string;
  mode: ScrapeMode;
  status: BulkJobStatus;
  filter: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  totalCount: number | null;
  queuedCount: number | null;
}

export interface RawHtmlCacheHit {
  html: string;
  createdAt: number;
  ageSeconds: number;
}

export interface StorageService {
  readonly saveRawHtml: (
    slug: string,
    html: string,
  ) => Effect.Effect<void, StorageError>;
  readonly getRawHtml: (
    slug: string,
  ) => Effect.Effect<string | null, StorageError>;
  readonly getRawHtmlIfFresh: (
    slug: string,
    maxAgeSeconds: number,
  ) => Effect.Effect<RawHtmlCacheHit | null, StorageError>;
  readonly getRawHtmlWithAge: (
    slug: string,
  ) => Effect.Effect<RawHtmlCacheHit | null, StorageError>;

  readonly upsertDevice: (device: {
    slug: string;
    name: string;
    brand: string | null;
    isRumor: boolean;
    raw: string;
  }) => Effect.Effect<void, StorageError>;
  readonly getDevice: (
    slug: string,
  ) => Effect.Effect<KimovilDevice | null, StorageError>;
  readonly getDeviceCount: () => Effect.Effect<number, StorageError>;
  readonly getAllDevices: () => Effect.Effect<KimovilDevice[], StorageError>;

  readonly enqueuePrefix: (
    prefix: string,
    depth: number,
  ) => Effect.Effect<void, StorageError>;
  readonly getNextPendingPrefix: () => Effect.Effect<
    KimovilPrefixState | null,
    StorageError
  >;
  readonly markPrefixDone: (
    prefix: string,
    resultCount: number,
  ) => Effect.Effect<void, StorageError>;
  readonly getPendingPrefixCount: () => Effect.Effect<number, StorageError>;
  readonly seedInitialPrefixes: () => Effect.Effect<void, StorageError>;
  readonly resetAllPrefixes: () => Effect.Effect<void, StorageError>;

  readonly queueScrape: (
    slug: string,
    mode: ScrapeMode,
    options?: {
      jobId?: string | null;
      maxAttempts?: number;
      nextAttemptAt?: number | null;
    },
  ) => Effect.Effect<ScrapeQueueItem, StorageError>;
  readonly getQueueItem: (
    id: number,
  ) => Effect.Effect<ScrapeQueueItem | null, StorageError>;
  readonly getQueueItemBySlug: (
    slug: string,
  ) => Effect.Effect<ScrapeQueueItem | null, StorageError>;
  readonly getQueueItems: (
    status?: ScrapeStatus,
  ) => Effect.Effect<ScrapeQueueItem[], StorageError>;
  readonly claimNextQueueItem: (
    jobId?: string,
  ) => Effect.Effect<ScrapeQueueItem | null, StorageError>;
  readonly startQueueItem: (id: number) => Effect.Effect<void, StorageError>;
  readonly completeQueueItem: (
    id: number,
    error?: string,
  ) => Effect.Effect<void, StorageError>;
  readonly rescheduleQueueItem: (
    id: number,
    nextAttemptAt: number,
    error: string,
    errorCode?: string,
  ) => Effect.Effect<void, StorageError>;
  readonly getNextPendingQueueItem: () => Effect.Effect<
    ScrapeQueueItem | null,
    StorageError
  >;
  readonly clearScrapeData: (slug: string) => Effect.Effect<void, StorageError>;
  readonly hasScrapedHtml: (
    slug: string,
  ) => Effect.Effect<boolean, StorageError>;
  readonly recordVerification: (
    slug: string,
    isCorrupted: boolean,
    reason: string | null,
  ) => Effect.Effect<void, StorageError>;
  readonly verifyHtml: (
    slug: string,
  ) => Effect.Effect<
    { isCorrupted: boolean; reason: string | null },
    StorageError
  >;
  readonly getVerificationStatus: (
    slug: string,
  ) => Effect.Effect<
    { isCorrupted: boolean; reason: string | null } | null,
    StorageError
  >;
  readonly getCorruptedSlugs: () => Effect.Effect<string[], StorageError>;
  readonly getValidSlugs: () => Effect.Effect<string[], StorageError>;
  readonly getScrapedSlugs: () => Effect.Effect<string[], StorageError>;

  readonly createBulkJob: (input: {
    id: string;
    mode: ScrapeMode;
    filter?: string | null;
    totalCount?: number | null;
    queuedCount?: number | null;
  }) => Effect.Effect<BulkJob, StorageError>;
  readonly enqueueBulkSlugs: (
    jobId: string,
    mode: ScrapeMode,
    slugs: string[],
    maxAttempts?: number,
  ) => Effect.Effect<{ queued: number }, StorageError>;
  readonly getBulkJob: (
    id: string,
  ) => Effect.Effect<BulkJob | null, StorageError>;
  readonly updateBulkJobStatus: (
    id: string,
    status: BulkJobStatus,
    error?: string,
  ) => Effect.Effect<void, StorageError>;
  readonly updateBulkJobCounts: (
    id: string,
    totalCount: number,
    queuedCount: number,
  ) => Effect.Effect<void, StorageError>;
  readonly getBulkJobStats: (id: string) => Effect.Effect<
    {
      total: number;
      pending: number;
      running: number;
      done: number;
      error: number;
    },
    StorageError
  >;
  readonly getAllBulkJobs: () => Effect.Effect<BulkJob[], StorageError>;
  readonly resetStuckQueueItems: (
    jobId: string,
  ) => Effect.Effect<number, StorageError>;
  readonly unclaimRunningItems: (
    jobId: string,
  ) => Effect.Effect<number, StorageError>;
  readonly getTimeoutStats: (jobId: string) => Effect.Effect<
    {
      count: number;
      nextRetryAt: number | null;
      nextRetrySlug: string | null;
    },
    StorageError
  >;
}

export const StorageService =
  Context.GenericTag<StorageService>("StorageService");

const DB_PATH = "./scraper-cache.sqlite";

const hashSlug = (slug: string): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(slug);
  return hasher.digest("hex").slice(0, 16);
};

let dbInstance: Database | null = null;

const ensureColumn = (
  db: Database,
  table: string,
  column: string,
  definition: string,
) => {
  const columns = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all();
  const hasColumn = columns.some((c) => c.name === column);
  if (!hasColumn) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const getDb = (): Database => {
  if (dbInstance) return dbInstance;

  const db = new Database(DB_PATH, { create: true });

  // Enable WAL mode for better concurrent access and set busy timeout
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");

  db.run(`
    CREATE TABLE IF NOT EXISTS raw_html (
      slug TEXT PRIMARY KEY,
      html TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS kimovil_devices (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      is_rumor INTEGER NOT NULL DEFAULT 0,
      raw TEXT,
      first_seen INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_kimovil_devices_slug ON kimovil_devices(slug)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS kimovil_prefix_state (
      prefix TEXT PRIMARY KEY,
      depth INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
      last_result_count INTEGER,
      last_run_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scrape_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      job_id TEXT,
      mode TEXT NOT NULL CHECK (mode IN ('fast', 'complex')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      next_attempt_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      started_at INTEGER,
      completed_at INTEGER,
      error_message TEXT,
      last_error_code TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bulk_jobs (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('fast', 'complex')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'done', 'error')),
      filter TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      started_at INTEGER,
      completed_at INTEGER,
      error_message TEXT,
      total_count INTEGER,
      queued_count INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scrape_verification (
      slug TEXT PRIMARY KEY,
      is_corrupted INTEGER NOT NULL DEFAULT 0,
      verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
      corruption_reason TEXT
    )
  `);

  ensureColumn(db, "scrape_queue", "job_id", "TEXT");
  ensureColumn(db, "scrape_queue", "attempt", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(
    db,
    "scrape_queue",
    "max_attempts",
    "INTEGER NOT NULL DEFAULT 5",
  );
  ensureColumn(db, "scrape_queue", "next_attempt_at", "INTEGER");
  ensureColumn(db, "scrape_queue", "updated_at", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "scrape_queue", "last_error_code", "TEXT");
  db.run(
    `UPDATE scrape_queue SET updated_at = created_at WHERE updated_at = 0`,
  );

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_scrape_queue_status ON scrape_queue(status)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_scrape_queue_slug ON scrape_queue(slug)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_scrape_queue_job_id ON scrape_queue(job_id)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_scrape_queue_next_attempt ON scrape_queue(next_attempt_at)`,
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_queue_job_slug ON scrape_queue(job_id, slug)`,
  );

  console.log("[Storage] SQLite database initialized at", DB_PATH);
  dbInstance = db;
  return db;
};

type QueueRow = {
  id: number;
  slug: string;
  job_id: string | null;
  mode: ScrapeMode;
  status: ScrapeStatus;
  attempt: number;
  max_attempts: number;
  next_attempt_at: number | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
  last_error_code: string | null;
};

const mapQueueRow = (row: QueueRow): ScrapeQueueItem => ({
  id: row.id,
  slug: row.slug,
  jobId: row.job_id ?? null,
  mode: row.mode,
  status: row.status,
  attempt: row.attempt ?? 0,
  maxAttempts: row.max_attempts ?? 5,
  nextAttemptAt: row.next_attempt_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  errorMessage: row.error_message,
  lastErrorCode: row.last_error_code ?? null,
});

type BulkJobRow = {
  id: string;
  mode: ScrapeMode;
  status: BulkJobStatus;
  filter: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
  total_count: number | null;
  queued_count: number | null;
};

const mapBulkJobRow = (row: BulkJobRow): BulkJob => ({
  id: row.id,
  mode: row.mode,
  status: row.status,
  filter: row.filter,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  errorMessage: row.error_message,
  totalCount: row.total_count,
  queuedCount: row.queued_count,
});

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.sync(() => {
    const db = getDb();

    return StorageService.of({
      saveRawHtml: (slug: string, html: string) =>
        Effect.try({
          try: () => {
            db.run(
              `INSERT OR REPLACE INTO raw_html (slug, html, created_at) VALUES (?, ?, unixepoch())`,
              [slug, html],
            );
            console.log(`[Storage] Saved raw HTML for slug: ${slug}`);
          },
          catch: (error) =>
            new StorageError(
              `Failed to save raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtml: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { html: string },
                [string]
              >(`SELECT html FROM raw_html WHERE slug = ?`)
              .get(slug);
            return row?.html ?? null;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtmlIfFresh: (slug: string, maxAgeSeconds: number) =>
        Effect.try({
          try: () => {
            const now = Math.floor(Date.now() / 1000);
            const row = db
              .query<
                { html: string; created_at: number },
                [string]
              >(`SELECT html, created_at FROM raw_html WHERE slug = ?`)
              .get(slug);
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            if (ageSeconds > maxAgeSeconds) return null;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get fresh raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtmlWithAge: (slug: string) =>
        Effect.try({
          try: () => {
            const now = Math.floor(Date.now() / 1000);
            const row = db
              .query<
                { html: string; created_at: number },
                [string]
              >(`SELECT html, created_at FROM raw_html WHERE slug = ?`)
              .get(slug);
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get raw HTML with age: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      upsertDevice: (device) =>
        Effect.try({
          try: () => {
            const id = hashSlug(device.slug);
            db.run(
              `INSERT INTO kimovil_devices (id, slug, name, brand, is_rumor, raw, first_seen, last_seen)
               VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 name = excluded.name,
                 brand = excluded.brand,
                 is_rumor = excluded.is_rumor,
                 raw = excluded.raw,
                 last_seen = unixepoch()`,
              [
                id,
                device.slug,
                device.name,
                device.brand,
                device.isRumor ? 1 : 0,
                device.raw,
              ],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to upsert device: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getDevice: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                {
                  id: string;
                  slug: string;
                  name: string;
                  brand: string | null;
                  is_rumor: number;
                  raw: string;
                  first_seen: number;
                  last_seen: number;
                },
                [string]
              >(`SELECT * FROM kimovil_devices WHERE slug = ?`)
              .get(slug);
            if (!row) return null;
            return {
              id: row.id,
              slug: row.slug,
              name: row.name,
              brand: row.brand,
              isRumor: row.is_rumor === 1,
              raw: row.raw,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
            };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get device: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getDeviceCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { count: number },
                []
              >(`SELECT COUNT(*) as count FROM kimovil_devices`)
              .get();
            return row?.count ?? 0;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get device count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAllDevices: () =>
        Effect.try({
          try: () => {
            const rows = db
              .query<
                {
                  id: string;
                  slug: string;
                  name: string;
                  brand: string | null;
                  is_rumor: number;
                  raw: string;
                  first_seen: number;
                  last_seen: number;
                },
                []
              >(`SELECT * FROM kimovil_devices ORDER BY name`)
              .all();
            return rows.map((row) => ({
              id: row.id,
              slug: row.slug,
              name: row.name,
              brand: row.brand,
              isRumor: row.is_rumor === 1,
              raw: row.raw,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
            }));
          },
          catch: (error) =>
            new StorageError(
              `Failed to get all devices: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      enqueuePrefix: (prefix: string, depth: number) =>
        Effect.try({
          try: () => {
            db.run(
              `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, ?, 'pending')`,
              [prefix, depth],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to enqueue prefix: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getNextPendingPrefix: () =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                {
                  prefix: string;
                  depth: number;
                  status: "pending" | "done";
                  last_result_count: number | null;
                  last_run_at: number | null;
                },
                []
              >(
                `SELECT * FROM kimovil_prefix_state WHERE status = 'pending' ORDER BY depth, prefix LIMIT 1`,
              )
              .get();
            if (!row) return null;
            return {
              prefix: row.prefix,
              depth: row.depth,
              status: row.status,
              lastResultCount: row.last_result_count,
              lastRunAt: row.last_run_at,
            };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get next pending prefix: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      markPrefixDone: (prefix: string, resultCount: number) =>
        Effect.try({
          try: () => {
            db.run(
              `UPDATE kimovil_prefix_state SET status = 'done', last_result_count = ?, last_run_at = unixepoch() WHERE prefix = ?`,
              [resultCount, prefix],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to mark prefix done: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPendingPrefixCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { count: number },
                []
              >(`SELECT COUNT(*) as count FROM kimovil_prefix_state WHERE status = 'pending'`)
              .get();
            return row?.count ?? 0;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get pending prefix count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      seedInitialPrefixes: () =>
        Effect.try({
          try: () => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
            let count = 0;
            for (const c1 of chars) {
              for (const c2 of chars) {
                const prefix = c1 + c2;
                db.run(
                  `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, 2, 'pending')`,
                  [prefix],
                );
                count++;
              }
            }
            console.log(
              `[Storage] Seeded ${count} initial prefixes (2-char combos)`,
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to seed initial prefixes: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      resetAllPrefixes: () =>
        Effect.try({
          try: () => {
            db.run(`DELETE FROM kimovil_prefix_state`);
            console.log("[Storage] Reset all prefixes");
          },
          catch: (error) =>
            new StorageError(
              `Failed to reset prefixes: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      queueScrape: (
        slug: string,
        mode: ScrapeMode,
        options?: {
          jobId?: string | null;
          maxAttempts?: number;
          nextAttemptAt?: number | null;
        },
      ) =>
        Effect.try({
          try: () => {
            const jobId = options?.jobId ?? null;
            const maxAttempts = options?.maxAttempts ?? 5;
            const nextAttemptAt = options?.nextAttemptAt ?? null;

            let row: QueueRow | null = null;

            if (jobId) {
              row = db
                .query<
                  QueueRow,
                  [string, string, ScrapeMode, number, number | null]
                >(
                  `INSERT INTO scrape_queue (slug, job_id, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
                   VALUES (?, ?, ?, 'pending', ?, ?, unixepoch(), unixepoch())
                   ON CONFLICT(job_id, slug) DO UPDATE SET updated_at = updated_at
                   RETURNING *`,
                )
                .get(slug, jobId, mode, maxAttempts, nextAttemptAt);
            } else {
              db.run(
                `INSERT INTO scrape_queue (slug, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
                 VALUES (?, ?, 'pending', ?, ?, unixepoch(), unixepoch())`,
                [slug, mode, maxAttempts, nextAttemptAt],
              );
              row = db
                .query<
                  QueueRow,
                  []
                >(`SELECT * FROM scrape_queue WHERE rowid = last_insert_rowid()`)
                .get();
            }
            if (!row) throw new Error("Failed to get inserted queue item");
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to queue scrape: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getQueueItem: (id: number) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                QueueRow,
                [number]
              >(`SELECT * FROM scrape_queue WHERE id = ?`)
              .get(id);
            if (!row) return null;
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getQueueItemBySlug: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                QueueRow,
                [string]
              >(`SELECT * FROM scrape_queue WHERE slug = ? ORDER BY created_at DESC LIMIT 1`)
              .get(slug);
            if (!row) return null;
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get queue item by slug: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getQueueItems: (status?: ScrapeStatus) =>
        Effect.try({
          try: () => {
            const query = status
              ? `SELECT * FROM scrape_queue WHERE status = ? ORDER BY created_at DESC`
              : `SELECT * FROM scrape_queue ORDER BY created_at DESC`;
            const rows = status
              ? db.query<QueueRow, [string]>(query).all(status)
              : db.query<QueueRow, []>(query).all();
            return rows.map(mapQueueRow);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get queue items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      claimNextQueueItem: (jobId?: string) =>
        Effect.try({
          try: () => {
            const baseQuery = `
              UPDATE scrape_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = (
                SELECT id FROM scrape_queue
                WHERE status = 'pending'
                  AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ${jobId ? "AND job_id = ?" : ""}
                ORDER BY created_at ASC
                LIMIT 1
              )
              RETURNING *
            `;
            const row = jobId
              ? db.query<QueueRow, [string]>(baseQuery).get(jobId)
              : db.query<QueueRow, []>(baseQuery).get();
            if (!row) return null;
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to claim next queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      startQueueItem: (id: number) =>
        Effect.try({
          try: () => {
            db.run(
              `UPDATE scrape_queue
               SET status = 'running',
                   started_at = unixepoch(),
                   updated_at = unixepoch(),
                   next_attempt_at = NULL
               WHERE id = ?`,
              [id],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to start queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      completeQueueItem: (id: number, error?: string) =>
        Effect.try({
          try: () => {
            if (error) {
              db.run(
                `UPDATE scrape_queue
                 SET status = 'error',
                     completed_at = unixepoch(),
                     updated_at = unixepoch(),
                     error_message = ?
                 WHERE id = ?`,
                [error, id],
              );
            } else {
              db.run(
                `UPDATE scrape_queue
                 SET status = 'done',
                     completed_at = unixepoch(),
                     updated_at = unixepoch()
                 WHERE id = ?`,
                [id],
              );
            }
          },
          catch: (error) =>
            new StorageError(
              `Failed to complete queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      rescheduleQueueItem: (
        id: number,
        nextAttemptAt: number,
        error: string,
        errorCode?: string,
      ) =>
        Effect.try({
          try: () => {
            db.run(
              `UPDATE scrape_queue
               SET status = 'pending',
                   attempt = attempt + 1,
                   next_attempt_at = ?,
                   updated_at = unixepoch(),
                   error_message = ?,
                   last_error_code = ?
               WHERE id = ?`,
              [nextAttemptAt, error, errorCode ?? null, id],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to reschedule queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getNextPendingQueueItem: () =>
        Effect.try({
          try: () => {
            const row = db
              .query<QueueRow, []>(
                `SELECT * FROM scrape_queue
                 WHERE status = 'pending'
                   AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                 ORDER BY created_at ASC
                 LIMIT 1`,
              )
              .get();
            if (!row) return null;
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get next pending queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      clearScrapeData: (slug: string) =>
        Effect.try({
          try: () => {
            db.run(`DELETE FROM raw_html WHERE slug = ?`, [slug]);
            db.run(`DELETE FROM scrape_queue WHERE slug = ?`, [slug]);
            console.log(`[Storage] Cleared scrape data for slug: ${slug}`);
          },
          catch: (error) =>
            new StorageError(
              `Failed to clear scrape data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      hasScrapedHtml: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { count: number },
                [string]
              >(`SELECT COUNT(*) as count FROM raw_html WHERE slug = ?`)
              .get(slug);
            return (row?.count ?? 0) > 0;
          },
          catch: (error) =>
            new StorageError(
              `Failed to check scraped HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      recordVerification: (
        slug: string,
        isCorrupted: boolean,
        reason: string | null,
      ) =>
        Effect.try({
          try: () => {
            db.run(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
              [slug, isCorrupted ? 1 : 0, reason],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to record verification: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      verifyHtml: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { html: string },
                [string]
              >(`SELECT html FROM raw_html WHERE slug = ?`)
              .get(slug);

            if (!row?.html) {
              return { isCorrupted: false, reason: null };
            }

            const html = row.html;
            let reason: string | null = null;

            if (html.includes("Enable JavaScript and cookies to continue")) {
              reason = "Bot protection: JavaScript/cookies required";
            } else if (html.includes("Please verify you are a human")) {
              reason = "Bot protection: Human verification required";
            } else if (html.includes("Access denied")) {
              reason = "Bot protection: Access denied";
            } else if (
              !html.includes("k-dltable") &&
              !html.includes("container-sheet")
            ) {
              reason = "Missing expected content structure";
            }

            const isCorrupted = reason !== null;

            db.run(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
              [slug, isCorrupted ? 1 : 0, reason],
            );

            return { isCorrupted, reason };
          },
          catch: (error) =>
            new StorageError(
              `Failed to verify HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getVerificationStatus: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                { is_corrupted: number; corruption_reason: string | null },
                [string]
              >(`SELECT is_corrupted, corruption_reason FROM scrape_verification WHERE slug = ?`)
              .get(slug);

            if (!row) return null;

            return {
              isCorrupted: row.is_corrupted === 1,
              reason: row.corruption_reason,
            };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get verification status: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getCorruptedSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .query<
                { slug: string },
                []
              >(`SELECT slug FROM scrape_verification WHERE is_corrupted = 1`)
              .all();
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get corrupted slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getValidSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .query<
                { slug: string },
                []
              >(`SELECT slug FROM scrape_verification WHERE is_corrupted = 0`)
              .all();
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get valid slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getScrapedSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .query<{ slug: string }, []>(`SELECT slug FROM raw_html`)
              .all();
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get scraped slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      createBulkJob: (input) =>
        Effect.try({
          try: () => {
            db.run(
              `INSERT INTO bulk_jobs (id, mode, status, filter, created_at, total_count, queued_count)
               VALUES (?, ?, 'pending', ?, unixepoch(), ?, ?)`,
              [
                input.id,
                input.mode,
                input.filter ?? null,
                input.totalCount ?? null,
                input.queuedCount ?? null,
              ],
            );
            const row = db
              .query<
                BulkJobRow,
                [string]
              >(`SELECT * FROM bulk_jobs WHERE id = ?`)
              .get(input.id);
            if (!row) throw new Error("Failed to get inserted bulk job");
            return mapBulkJobRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to create bulk job: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      enqueueBulkSlugs: (
        jobId: string,
        mode: ScrapeMode,
        slugs: string[],
        maxAttempts = 5,
      ) =>
        Effect.try({
          try: () => {
            const stmt = db.prepare(
              `INSERT OR IGNORE INTO scrape_queue (slug, job_id, mode, status, max_attempts, created_at, updated_at)
               VALUES (?, ?, ?, 'pending', ?, unixepoch(), unixepoch())`,
            );
            db.run("BEGIN");
            for (const slug of slugs) {
              stmt.run(slug, jobId, mode, maxAttempts);
            }
            db.run("COMMIT");
            const row = db
              .query<
                { count: number },
                [string]
              >(`SELECT COUNT(*) as count FROM scrape_queue WHERE job_id = ?`)
              .get(jobId);
            return { queued: row?.count ?? 0 };
          },
          catch: (error) => {
            try {
              db.run("ROLLBACK");
            } catch {
              // Ignore rollback errors from failed transactions
            }
            return new StorageError(
              `Failed to enqueue bulk slugs: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        }),

      getBulkJob: (id: string) =>
        Effect.try({
          try: () => {
            const row = db
              .query<
                BulkJobRow,
                [string]
              >(`SELECT * FROM bulk_jobs WHERE id = ?`)
              .get(id);
            if (!row) return null;
            return mapBulkJobRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get bulk job: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      updateBulkJobStatus: (
        id: string,
        status: BulkJobStatus,
        error?: string,
      ) =>
        Effect.try({
          try: () => {
            if (status === "running") {
              db.run(
                `UPDATE bulk_jobs
                 SET status = ?,
                     started_at = COALESCE(started_at, unixepoch()),
                     error_message = NULL
                 WHERE id = ?`,
                [status, id],
              );
              return;
            }
            if (status === "error") {
              db.run(
                `UPDATE bulk_jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = ?
                 WHERE id = ?`,
                [status, error ?? "Unknown error", id],
              );
              return;
            }
            if (status === "done") {
              db.run(
                `UPDATE bulk_jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = NULL
                 WHERE id = ?`,
                [status, id],
              );
              return;
            }
            db.run(`UPDATE bulk_jobs SET status = ? WHERE id = ?`, [
              status,
              id,
            ]);
          },
          catch: (error) =>
            new StorageError(
              `Failed to update bulk job status: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      updateBulkJobCounts: (
        id: string,
        totalCount: number,
        queuedCount: number,
      ) =>
        Effect.try({
          try: () => {
            db.run(
              `UPDATE bulk_jobs SET total_count = ?, queued_count = ? WHERE id = ?`,
              [totalCount, queuedCount, id],
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to update bulk job counts: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getBulkJobStats: (id: string) =>
        Effect.try({
          try: () => {
            const rows = db
              .query<{ status: ScrapeStatus; count: number }, [string]>(
                `SELECT status, COUNT(*) as count
                 FROM scrape_queue
                 WHERE job_id = ?
                 GROUP BY status`,
              )
              .all(id);
            const counts = {
              pending: 0,
              running: 0,
              done: 0,
              error: 0,
            };
            for (const row of rows) {
              if (row.status === "pending") counts.pending = row.count;
              if (row.status === "running") counts.running = row.count;
              if (row.status === "done") counts.done = row.count;
              if (row.status === "error") counts.error = row.count;
            }
            const total =
              counts.pending + counts.running + counts.done + counts.error;
            return { total, ...counts };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get bulk job stats: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAllBulkJobs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .query<
                BulkJobRow,
                []
              >(`SELECT * FROM bulk_jobs ORDER BY created_at DESC`)
              .all();
            return rows.map(mapBulkJobRow);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get all bulk jobs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      resetStuckQueueItems: (jobId: string) =>
        Effect.try({
          try: () => {
            const result = db.run(
              `UPDATE scrape_queue
               SET status = 'pending', started_at = NULL
               WHERE job_id = ? AND status = 'running'`,
              [jobId],
            );
            return result.changes;
          },
          catch: (error) =>
            new StorageError(
              `Failed to reset stuck queue items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      unclaimRunningItems: (jobId: string) =>
        Effect.try({
          try: () => {
            const result = db.run(
              `UPDATE scrape_queue
               SET status = 'pending', started_at = NULL, attempt = attempt
               WHERE job_id = ? AND status = 'running'`,
              [jobId],
            );
            return result.changes;
          },
          catch: (error) =>
            new StorageError(
              `Failed to unclaim running items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getTimeoutStats: (jobId: string) =>
        Effect.try({
          try: () => {
            const now = Math.floor(Date.now() / 1000);
            const countRow = db
              .query<{ count: number }, [string, number]>(
                `SELECT COUNT(*) as count
                 FROM scrape_queue
                 WHERE job_id = ? AND status = 'pending' 
                   AND next_attempt_at IS NOT NULL AND next_attempt_at > ?`,
              )
              .get(jobId, now);
            const nextRow = db
              .query<
                { slug: string; next_attempt_at: number },
                [string, number]
              >(
                `SELECT slug, next_attempt_at
                 FROM scrape_queue
                 WHERE job_id = ? AND status = 'pending' 
                   AND next_attempt_at IS NOT NULL AND next_attempt_at > ?
                 ORDER BY next_attempt_at ASC LIMIT 1`,
              )
              .get(jobId, now);
            return {
              count: countRow?.count ?? 0,
              nextRetryAt: nextRow?.next_attempt_at ?? null,
              nextRetrySlug: nextRow?.slug ?? null,
            };
          },
          catch: (error) =>
            new StorageError(
              `Failed to get timeout stats: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),
    });
  }),
);
