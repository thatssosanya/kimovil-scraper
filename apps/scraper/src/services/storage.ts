import { Effect, Layer, Context } from "effect";
import Database from "better-sqlite3";
import { createHash } from "crypto";

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
export type JobType = "scrape" | "process_raw" | "process_ai";
export type AiMode = "realtime" | "batch";

export interface JobQueueItem {
  id: number;
  slug: string;
  jobId: string | null;
  jobType: JobType;
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

/** @deprecated Use JobQueueItem instead */
export type ScrapeQueueItem = JobQueueItem;

export interface Job {
  id: string;
  jobType: JobType;
  mode: ScrapeMode;
  aiMode: AiMode | null;
  status: BulkJobStatus;
  filter: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  totalCount: number | null;
  queuedCount: number | null;
  batchRequestId: string | null;
  batchStatus: string | null;
}

/** @deprecated Use Job instead */
export type BulkJob = Job;

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
  readonly getRawDataSlugs: () => Effect.Effect<string[], StorageError>;
  readonly getAiDataSlugs: () => Effect.Effect<string[], StorageError>;

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
  readonly resetErrorQueueItems: (
    jobId: string,
  ) => Effect.Effect<number, StorageError>;
  readonly getErrorQueueItems: (
    jobId: string,
    limit?: number,
  ) => Effect.Effect<ScrapeQueueItem[], StorageError>;
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

  // Phone data storage (raw = selector only, no AI)
  readonly savePhoneDataRaw: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, StorageError>;
  readonly getPhoneDataRaw: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, StorageError>;
  readonly hasPhoneDataRaw: (
    slug: string,
  ) => Effect.Effect<boolean, StorageError>;
  readonly getPhoneDataRawCount: () => Effect.Effect<number, StorageError>;

  // Phone data storage (AI normalized)
  readonly savePhoneData: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, StorageError>;
  readonly getPhoneData: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, StorageError>;
  readonly hasPhoneData: (slug: string) => Effect.Effect<boolean, StorageError>;
  readonly getPhoneDataCount: () => Effect.Effect<number, StorageError>;

  // New job type queries
  readonly getSlugsNeedingExtraction: () => Effect.Effect<
    string[],
    StorageError
  >;
  readonly getSlugsNeedingAi: () => Effect.Effect<string[], StorageError>;
  readonly getPhoneDataRawBulk: (
    slugs: string[],
  ) => Effect.Effect<
    Array<{ slug: string; data: Record<string, unknown> }>,
    StorageError
  >;
  readonly updateJobBatchStatus: (
    jobId: string,
    batchRequestId: string,
    batchStatus: string,
  ) => Effect.Effect<void, StorageError>;
  readonly getRunningBatchJobs: () => Effect.Effect<Job[], StorageError>;

  // Job queue with job type
  readonly enqueueJobSlugs: (
    jobId: string,
    jobType: JobType,
    mode: ScrapeMode,
    slugs: string[],
    maxAttempts?: number,
  ) => Effect.Effect<{ queued: number }, StorageError>;
  readonly claimNextJobQueueItem: (
    jobId: string,
    jobType?: JobType,
  ) => Effect.Effect<JobQueueItem | null, StorageError>;

  // Job CRUD with new fields
  readonly createJob: (input: {
    id: string;
    jobType: JobType;
    mode: ScrapeMode;
    aiMode?: AiMode | null;
    filter?: string | null;
    totalCount?: number | null;
    queuedCount?: number | null;
  }) => Effect.Effect<Job, StorageError>;
  readonly getJob: (id: string) => Effect.Effect<Job | null, StorageError>;
  readonly getAllJobs: () => Effect.Effect<Job[], StorageError>;
  readonly updateJobStatus: (
    id: string,
    status: BulkJobStatus,
    error?: string,
  ) => Effect.Effect<void, StorageError>;
  readonly getJobStats: (id: string) => Effect.Effect<
    {
      total: number;
      pending: number;
      running: number;
      done: number;
      error: number;
    },
    StorageError
  >;
}

export const StorageService =
  Context.GenericTag<StorageService>("StorageService");

const DB_PATH = "./scraper-cache.sqlite";

const hashSlug = (slug: string): string => {
  return createHash("sha256").update(slug).digest("hex").slice(0, 16);
};

let dbInstance: Database.Database | null = null;

const ensureColumn = (
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  const hasColumn = columns.some((c) => c.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const tableExists = (db: Database.Database, table: string): boolean => {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined;
  return row !== undefined;
};

const migrateTableRename = (
  db: Database.Database,
  oldName: string,
  newName: string,
) => {
  if (tableExists(db, oldName) && !tableExists(db, newName)) {
    db.exec(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
    console.log(`[Storage] Migrated table ${oldName} → ${newName}`);
  }
};

const getRowCount = (db: Database.Database, table: string): number => {
  if (!tableExists(db, table)) return 0;
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
};

const migrateJobsData = (db: Database.Database) => {
  const oldJobsCount = getRowCount(db, "bulk_jobs");
  const newJobsCount = getRowCount(db, "jobs");
  if (oldJobsCount > 0 && newJobsCount === 0) {
    db.exec(`
      INSERT INTO jobs (id, mode, status, filter, created_at, started_at, completed_at, error_message, total_count, queued_count)
      SELECT id, mode, status, filter, created_at, started_at, completed_at, error_message, total_count, queued_count
      FROM bulk_jobs
    `);
    console.log(
      `[Storage] Migrated ${oldJobsCount} rows from bulk_jobs → jobs`,
    );
  }

  const oldQueueCount = getRowCount(db, "scrape_queue");
  const newQueueCount = getRowCount(db, "job_queue");
  if (oldQueueCount > 0 && newQueueCount === 0) {
    db.exec(`
      INSERT INTO job_queue (id, slug, job_id, job_type, mode, status, attempt, max_attempts, next_attempt_at, created_at, updated_at, started_at, completed_at, error_message, last_error_code)
      SELECT id, slug, job_id, 'scrape', mode, status, attempt, max_attempts, next_attempt_at, created_at, updated_at, started_at, completed_at, error_message, last_error_code
      FROM scrape_queue
    `);
    console.log(
      `[Storage] Migrated ${oldQueueCount} rows from scrape_queue → job_queue`,
    );
  }
};

const getDb = (): Database.Database => {
  if (dbInstance) return dbInstance;

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access and set busy timeout
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_html (
      slug TEXT PRIMARY KEY,
      html TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kimovil_devices_slug ON kimovil_devices(slug)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kimovil_prefix_state (
      prefix TEXT PRIMARY KEY,
      depth INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
      last_result_count INTEGER,
      last_run_at INTEGER
    )
  `);

  migrateTableRename(db, "scrape_queue", "job_queue");
  migrateTableRename(db, "bulk_jobs", "jobs");

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      job_id TEXT,
      job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai')),
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai')),
      mode TEXT NOT NULL CHECK (mode IN ('fast', 'complex')),
      ai_mode TEXT CHECK (ai_mode IS NULL OR ai_mode IN ('realtime', 'batch')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'done', 'error')),
      filter TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      started_at INTEGER,
      completed_at INTEGER,
      error_message TEXT,
      total_count INTEGER,
      queued_count INTEGER,
      batch_request_id TEXT,
      batch_status TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_verification (
      slug TEXT PRIMARY KEY,
      is_corrupted INTEGER NOT NULL DEFAULT 0,
      verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
      corruption_reason TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_data_raw (
      slug TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_data (
      slug TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Ensure columns exist (for migrations from older versions)
  ensureColumn(db, "job_queue", "job_id", "TEXT");
  ensureColumn(db, "job_queue", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
  ensureColumn(db, "job_queue", "attempt", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "job_queue", "max_attempts", "INTEGER NOT NULL DEFAULT 5");
  ensureColumn(db, "job_queue", "next_attempt_at", "INTEGER");
  ensureColumn(db, "job_queue", "updated_at", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "job_queue", "last_error_code", "TEXT");
  db.exec(`UPDATE job_queue SET updated_at = created_at WHERE updated_at = 0`);

  // Ensure columns exist for jobs table
  ensureColumn(db, "jobs", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
  ensureColumn(db, "jobs", "ai_mode", "TEXT");
  ensureColumn(db, "jobs", "batch_request_id", "TEXT");
  ensureColumn(db, "jobs", "batch_status", "TEXT");

  // Create indexes for job_queue
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_queue_slug ON job_queue(slug)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_job_queue_job_id ON job_queue(job_id)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_job_queue_next_attempt ON job_queue(next_attempt_at)`,
  );
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_job_slug ON job_queue(job_id, slug)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_job_queue_job_type ON job_queue(job_type)`,
  );

  db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_batch_request ON jobs(batch_request_id)`,
  );

  migrateJobsData(db);

  console.log("[Storage] SQLite database initialized at", DB_PATH);
  dbInstance = db;
  return db;
};

type QueueRow = {
  id: number;
  slug: string;
  job_id: string | null;
  job_type: JobType;
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

const mapQueueRow = (row: QueueRow): JobQueueItem => ({
  id: row.id,
  slug: row.slug,
  jobId: row.job_id ?? null,
  jobType: row.job_type ?? "scrape",
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

type JobRow = {
  id: string;
  job_type: JobType;
  mode: ScrapeMode;
  ai_mode: AiMode | null;
  status: BulkJobStatus;
  filter: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
  total_count: number | null;
  queued_count: number | null;
  batch_request_id: string | null;
  batch_status: string | null;
};

/** @deprecated Use JobRow instead */
type BulkJobRow = JobRow;

const mapJobRow = (row: JobRow): Job => ({
  id: row.id,
  jobType: row.job_type ?? "scrape",
  mode: row.mode,
  aiMode: row.ai_mode ?? null,
  status: row.status,
  filter: row.filter,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  errorMessage: row.error_message,
  totalCount: row.total_count,
  queuedCount: row.queued_count,
  batchRequestId: row.batch_request_id ?? null,
  batchStatus: row.batch_status ?? null,
});

/** @deprecated Use mapJobRow instead */
const mapBulkJobRow = mapJobRow;

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.sync(() => {
    const db = getDb();

    return StorageService.of({
      saveRawHtml: (slug: string, html: string) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT OR REPLACE INTO raw_html (slug, html, created_at) VALUES (?, ?, unixepoch())`,
            ).run(slug, html);
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
              .prepare(`SELECT html FROM raw_html WHERE slug = ?`)
              .get(slug) as { html: string } | undefined;
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
              .prepare(`SELECT html, created_at FROM raw_html WHERE slug = ?`)
              .get(slug) as { html: string; created_at: number } | undefined;
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
              .prepare(`SELECT html, created_at FROM raw_html WHERE slug = ?`)
              .get(slug) as { html: string; created_at: number } | undefined;
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
            db.prepare(
              `INSERT INTO kimovil_devices (id, slug, name, brand, is_rumor, raw, first_seen, last_seen)
               VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 name = excluded.name,
                 brand = excluded.brand,
                 is_rumor = excluded.is_rumor,
                 raw = excluded.raw,
                 last_seen = unixepoch()`,
            ).run(
              id,
              device.slug,
              device.name,
              device.brand,
              device.isRumor ? 1 : 0,
              device.raw,
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
              .prepare(`SELECT * FROM kimovil_devices WHERE slug = ?`)
              .get(slug) as
              | {
                  id: string;
                  slug: string;
                  name: string;
                  brand: string | null;
                  is_rumor: number;
                  raw: string;
                  first_seen: number;
                  last_seen: number;
                }
              | undefined;
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
              .prepare(`SELECT COUNT(*) as count FROM kimovil_devices`)
              .get() as { count: number } | undefined;
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
              .prepare(`SELECT * FROM kimovil_devices ORDER BY name`)
              .all() as {
              id: string;
              slug: string;
              name: string;
              brand: string | null;
              is_rumor: number;
              raw: string;
              first_seen: number;
              last_seen: number;
            }[];
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
            db.prepare(
              `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, ?, 'pending')`,
            ).run(prefix, depth);
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
              .prepare(
                `SELECT * FROM kimovil_prefix_state WHERE status = 'pending' ORDER BY depth, prefix LIMIT 1`,
              )
              .get() as
              | {
                  prefix: string;
                  depth: number;
                  status: "pending" | "done";
                  last_result_count: number | null;
                  last_run_at: number | null;
                }
              | undefined;
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
            db.prepare(
              `UPDATE kimovil_prefix_state SET status = 'done', last_result_count = ?, last_run_at = unixepoch() WHERE prefix = ?`,
            ).run(resultCount, prefix);
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
              .prepare(
                `SELECT COUNT(*) as count FROM kimovil_prefix_state WHERE status = 'pending'`,
              )
              .get() as { count: number } | undefined;
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
            const stmt = db.prepare(
              `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, 2, 'pending')`,
            );
            let count = 0;
            for (const c1 of chars) {
              for (const c2 of chars) {
                const prefix = c1 + c2;
                stmt.run(prefix);
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
            db.exec(`DELETE FROM kimovil_prefix_state`);
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

            let row: QueueRow | undefined;

            if (jobId) {
              row = db
                .prepare(
                  `INSERT INTO job_queue (slug, job_id, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
                   VALUES (?, ?, ?, 'pending', ?, ?, unixepoch(), unixepoch())
                   ON CONFLICT(job_id, slug) DO UPDATE SET updated_at = updated_at
                   RETURNING *`,
                )
                .get(slug, jobId, mode, maxAttempts, nextAttemptAt) as
                | QueueRow
                | undefined;
            } else {
              db.prepare(
                `INSERT INTO job_queue (slug, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
                 VALUES (?, ?, 'pending', ?, ?, unixepoch(), unixepoch())`,
              ).run(slug, mode, maxAttempts, nextAttemptAt);
              row = db
                .prepare(
                  `SELECT * FROM job_queue WHERE rowid = last_insert_rowid()`,
                )
                .get() as QueueRow | undefined;
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
              .prepare(`SELECT * FROM job_queue WHERE id = ?`)
              .get(id) as QueueRow | undefined;
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
              .prepare(
                `SELECT * FROM job_queue WHERE slug = ? ORDER BY created_at DESC LIMIT 1`,
              )
              .get(slug) as QueueRow | undefined;
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
            const rows = status
              ? (db
                  .prepare(
                    `SELECT * FROM job_queue WHERE status = ? ORDER BY created_at DESC`,
                  )
                  .all(status) as QueueRow[])
              : (db
                  .prepare(`SELECT * FROM job_queue ORDER BY created_at DESC`)
                  .all() as QueueRow[]);
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
              UPDATE job_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = (
                SELECT id FROM job_queue
                WHERE status = 'pending'
                  AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ${jobId ? "AND job_id = ?" : ""}
                ORDER BY created_at ASC
                LIMIT 1
              )
              RETURNING *
            `;
            const row = jobId
              ? (db.prepare(baseQuery).get(jobId) as QueueRow | undefined)
              : (db.prepare(baseQuery).get() as QueueRow | undefined);
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
            db.prepare(
              `UPDATE job_queue
               SET status = 'running',
                   started_at = unixepoch(),
                   updated_at = unixepoch(),
                   next_attempt_at = NULL
               WHERE id = ?`,
            ).run(id);
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
              db.prepare(
                `UPDATE job_queue
                 SET status = 'error',
                     completed_at = unixepoch(),
                     updated_at = unixepoch(),
                     error_message = ?
                 WHERE id = ?`,
              ).run(error, id);
            } else {
              db.prepare(
                `UPDATE job_queue
                 SET status = 'done',
                     completed_at = unixepoch(),
                     updated_at = unixepoch()
                 WHERE id = ?`,
              ).run(id);
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
            db.prepare(
              `UPDATE job_queue
               SET status = 'pending',
                   attempt = attempt + 1,
                   next_attempt_at = ?,
                   updated_at = unixepoch(),
                   error_message = ?,
                   last_error_code = ?
               WHERE id = ?`,
            ).run(nextAttemptAt, error, errorCode ?? null, id);
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
              .prepare(
                `SELECT * FROM job_queue
                 WHERE status = 'pending'
                   AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                 ORDER BY created_at ASC
                 LIMIT 1`,
              )
              .get() as QueueRow | undefined;
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
            db.prepare(`DELETE FROM raw_html WHERE slug = ?`).run(slug);
            db.prepare(`DELETE FROM job_queue WHERE slug = ?`).run(slug);
            db.prepare(`DELETE FROM phone_data_raw WHERE slug = ?`).run(slug);
            db.prepare(`DELETE FROM phone_data WHERE slug = ?`).run(slug);
            db.prepare(`DELETE FROM scrape_verification WHERE slug = ?`).run(
              slug,
            );
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
              .prepare(`SELECT COUNT(*) as count FROM raw_html WHERE slug = ?`)
              .get(slug) as { count: number } | undefined;
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
            db.prepare(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
            ).run(slug, isCorrupted ? 1 : 0, reason);
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
              .prepare(`SELECT html FROM raw_html WHERE slug = ?`)
              .get(slug) as { html: string } | undefined;

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
            } else if (!html.includes("<main")) {
              reason = "Missing main content element";
            } else if (
              !html.includes("k-dltable") &&
              !html.includes("container-sheet")
            ) {
              reason = "Missing expected content structure";
            }

            const isCorrupted = reason !== null;

            db.prepare(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
            ).run(slug, isCorrupted ? 1 : 0, reason);

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
              .prepare(
                `SELECT is_corrupted, corruption_reason FROM scrape_verification WHERE slug = ?`,
              )
              .get(slug) as
              | { is_corrupted: number; corruption_reason: string | null }
              | undefined;

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
              .prepare(
                `SELECT slug FROM scrape_verification WHERE is_corrupted = 1`,
              )
              .all() as { slug: string }[];
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
              .prepare(
                `SELECT slug FROM scrape_verification WHERE is_corrupted = 0`,
              )
              .all() as { slug: string }[];
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
            const rows = db.prepare(`SELECT slug FROM raw_html`).all() as {
              slug: string;
            }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get scraped slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawDataSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db.prepare(`SELECT slug FROM phone_data_raw`).all() as {
              slug: string;
            }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get raw data slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAiDataSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db.prepare(`SELECT slug FROM phone_data`).all() as {
              slug: string;
            }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get AI data slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      createBulkJob: (input) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO jobs (id, mode, status, filter, created_at, total_count, queued_count)
               VALUES (?, ?, 'pending', ?, unixepoch(), ?, ?)`,
            ).run(
              input.id,
              input.mode,
              input.filter ?? null,
              input.totalCount ?? null,
              input.queuedCount ?? null,
            );
            const row = db
              .prepare(`SELECT * FROM jobs WHERE id = ?`)
              .get(input.id) as BulkJobRow | undefined;
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
              `INSERT OR IGNORE INTO job_queue (slug, job_id, mode, status, max_attempts, created_at, updated_at)
               VALUES (?, ?, ?, 'pending', ?, unixepoch(), unixepoch())`,
            );
            const insertMany = db.transaction(() => {
              for (const slug of slugs) {
                stmt.run(slug, jobId, mode, maxAttempts);
              }
            });
            insertMany();
            const row = db
              .prepare(
                `SELECT COUNT(*) as count FROM job_queue WHERE job_id = ?`,
              )
              .get(jobId) as { count: number } | undefined;
            return { queued: row?.count ?? 0 };
          },
          catch: (error) => {
            return new StorageError(
              `Failed to enqueue bulk slugs: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        }),

      getBulkJob: (id: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT * FROM jobs WHERE id = ?`)
              .get(id) as BulkJobRow | undefined;
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
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     started_at = COALESCE(started_at, unixepoch()),
                     error_message = NULL
                 WHERE id = ?`,
              ).run(status, id);
              return;
            }
            if (status === "error") {
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = ?
                 WHERE id = ?`,
              ).run(status, error ?? "Unknown error", id);
              return;
            }
            if (status === "done") {
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = NULL
                 WHERE id = ?`,
              ).run(status, id);
              return;
            }
            db.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).run(
              status,
              id,
            );
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
            db.prepare(
              `UPDATE jobs SET total_count = ?, queued_count = ? WHERE id = ?`,
            ).run(totalCount, queuedCount, id);
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
              .prepare(
                `SELECT status, COUNT(*) as count
                 FROM job_queue
                 WHERE job_id = ?
                 GROUP BY status`,
              )
              .all(id) as { status: ScrapeStatus; count: number }[];
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
              .prepare(`SELECT * FROM jobs ORDER BY created_at DESC`)
              .all() as BulkJobRow[];
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
            const result = db
              .prepare(
                `UPDATE job_queue
               SET status = 'pending', started_at = NULL
               WHERE job_id = ? AND status = 'running'`,
              )
              .run(jobId);
            return result.changes;
          },
          catch: (error) =>
            new StorageError(
              `Failed to reset stuck queue items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      resetErrorQueueItems: (jobId: string) =>
        Effect.try({
          try: () => {
            const result = db
              .prepare(
                `UPDATE job_queue
               SET status = 'pending',
                   started_at = NULL,
                   completed_at = NULL,
                   attempt = 0,
                   next_attempt_at = NULL,
                   error_message = NULL,
                   last_error_code = NULL,
                   updated_at = unixepoch()
               WHERE job_id = ? AND status = 'error'`,
              )
              .run(jobId);
            return result.changes;
          },
          catch: (error) =>
            new StorageError(
              `Failed to reset error queue items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getErrorQueueItems: (jobId: string, limit = 100) =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT * FROM job_queue
                 WHERE job_id = ? AND status = 'error'
                 ORDER BY updated_at DESC
                 LIMIT ?`,
              )
              .all(jobId, limit) as QueueRow[];
            return rows.map(mapQueueRow);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get error queue items: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      unclaimRunningItems: (jobId: string) =>
        Effect.try({
          try: () => {
            const result = db
              .prepare(
                `UPDATE job_queue
               SET status = 'pending', started_at = NULL, attempt = attempt
               WHERE job_id = ? AND status = 'running'`,
              )
              .run(jobId);
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
              .prepare(
                `SELECT COUNT(*) as count
                 FROM job_queue
                 WHERE job_id = ? AND status = 'pending'
                   AND next_attempt_at IS NOT NULL AND next_attempt_at > ?`,
              )
              .get(jobId, now) as { count: number } | undefined;
            const nextRow = db
              .prepare(
                `SELECT slug, next_attempt_at
                 FROM job_queue
                 WHERE job_id = ? AND status = 'pending'
                   AND next_attempt_at IS NOT NULL AND next_attempt_at > ?
                 ORDER BY next_attempt_at ASC LIMIT 1`,
              )
              .get(jobId, now) as
              | { slug: string; next_attempt_at: number }
              | undefined;
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

      // Raw phone data (selector only, no AI)
      savePhoneDataRaw: (slug: string, data: Record<string, unknown>) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO phone_data_raw (slug, data, created_at, updated_at)
               VALUES (?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 data = excluded.data,
                 updated_at = unixepoch()`,
            ).run(slug, JSON.stringify(data));
          },
          catch: (error) =>
            new StorageError(
              `Failed to save raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPhoneDataRaw: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT data FROM phone_data_raw WHERE slug = ?`)
              .get(slug) as { data: string } | undefined;
            if (!row) return null;
            return JSON.parse(row.data) as Record<string, unknown>;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      hasPhoneDataRaw: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT 1 FROM phone_data_raw WHERE slug = ? LIMIT 1`)
              .get(slug);
            return row !== undefined;
          },
          catch: (error) =>
            new StorageError(
              `Failed to check raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPhoneDataRawCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM phone_data_raw`)
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get raw phone data count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      // AI normalized phone data
      savePhoneData: (slug: string, data: Record<string, unknown>) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO phone_data (slug, data, created_at, updated_at)
               VALUES (?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 data = excluded.data,
                 updated_at = unixepoch()`,
            ).run(slug, JSON.stringify(data));
          },
          catch: (error) =>
            new StorageError(
              `Failed to save phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPhoneData: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT data FROM phone_data WHERE slug = ?`)
              .get(slug) as { data: string } | undefined;
            if (!row) return null;
            return JSON.parse(row.data) as Record<string, unknown>;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      hasPhoneData: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT 1 FROM phone_data WHERE slug = ? LIMIT 1`)
              .get(slug);
            return row !== undefined;
          },
          catch: (error) =>
            new StorageError(
              `Failed to check phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPhoneDataCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM phone_data`)
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new StorageError(
              `Failed to get phone data count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      // New job type queries
      getSlugsNeedingExtraction: () =>
        Effect.try({
          try: () => {
            // Slugs that have HTML but no raw data
            const rows = db
              .prepare(
                `SELECT r.slug FROM raw_html r
                 LEFT JOIN phone_data_raw p ON r.slug = p.slug
                 WHERE p.slug IS NULL`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get slugs needing extraction: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getSlugsNeedingAi: () =>
        Effect.try({
          try: () => {
            // Slugs that have raw data but no AI data
            const rows = db
              .prepare(
                `SELECT r.slug FROM phone_data_raw r
                 LEFT JOIN phone_data p ON r.slug = p.slug
                 WHERE p.slug IS NULL`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get slugs needing AI: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPhoneDataRawBulk: (slugs: string[]) =>
        Effect.try({
          try: () => {
            if (slugs.length === 0) return [];
            const placeholders = slugs.map(() => "?").join(",");
            const rows = db
              .prepare(
                `SELECT slug, data FROM phone_data_raw WHERE slug IN (${placeholders})`,
              )
              .all(...slugs) as { slug: string; data: string }[];
            return rows.map((r) => ({
              slug: r.slug,
              data: JSON.parse(r.data) as Record<string, unknown>,
            }));
          },
          catch: (error) =>
            new StorageError(
              `Failed to get bulk raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      updateJobBatchStatus: (
        jobId: string,
        batchRequestId: string,
        batchStatus: string,
      ) =>
        Effect.try({
          try: () => {
            db.prepare(
              `UPDATE jobs SET batch_request_id = ?, batch_status = ? WHERE id = ?`,
            ).run(batchRequestId, batchStatus, jobId);
          },
          catch: (error) =>
            new StorageError(
              `Failed to update job batch status: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRunningBatchJobs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT * FROM jobs
                 WHERE job_type = 'process_ai'
                   AND ai_mode = 'batch'
                   AND status = 'running'
                   AND batch_request_id IS NOT NULL`,
              )
              .all() as JobRow[];
            return rows.map(mapJobRow);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get running batch jobs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      enqueueJobSlugs: (
        jobId: string,
        jobType: JobType,
        mode: ScrapeMode,
        slugs: string[],
        maxAttempts = 5,
      ) =>
        Effect.try({
          try: () => {
            const stmt = db.prepare(
              `INSERT OR IGNORE INTO job_queue (slug, job_id, job_type, mode, status, max_attempts, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pending', ?, unixepoch(), unixepoch())`,
            );
            const insertMany = db.transaction(() => {
              for (const slug of slugs) {
                stmt.run(slug, jobId, jobType, mode, maxAttempts);
              }
            });
            insertMany();
            const row = db
              .prepare(
                `SELECT COUNT(*) as count FROM job_queue WHERE job_id = ?`,
              )
              .get(jobId) as { count: number } | undefined;
            return { queued: row?.count ?? 0 };
          },
          catch: (error) =>
            new StorageError(
              `Failed to enqueue job slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      claimNextJobQueueItem: (jobId: string, jobType?: JobType) =>
        Effect.try({
          try: () => {
            const query = `
              UPDATE job_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = (
                SELECT id FROM job_queue
                WHERE status = 'pending'
                  AND job_id = ?
                  ${jobType ? "AND job_type = ?" : ""}
                  AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                ORDER BY created_at ASC
                LIMIT 1
              )
              RETURNING *
            `;
            const row = jobType
              ? (db.prepare(query).get(jobId, jobType) as QueueRow | undefined)
              : (db.prepare(query).get(jobId) as QueueRow | undefined);
            if (!row) return null;
            return mapQueueRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to claim next job queue item: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      createJob: (input) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO jobs (id, job_type, mode, ai_mode, status, filter, created_at, total_count, queued_count)
               VALUES (?, ?, ?, ?, 'pending', ?, unixepoch(), ?, ?)`,
            ).run(
              input.id,
              input.jobType,
              input.mode,
              input.aiMode ?? null,
              input.filter ?? null,
              input.totalCount ?? null,
              input.queuedCount ?? null,
            );
            const row = db
              .prepare(`SELECT * FROM jobs WHERE id = ?`)
              .get(input.id) as JobRow | undefined;
            if (!row) throw new Error("Failed to get inserted job");
            return mapJobRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to create job: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getJob: (id: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT * FROM jobs WHERE id = ?`)
              .get(id) as JobRow | undefined;
            if (!row) return null;
            return mapJobRow(row);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get job: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAllJobs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(`SELECT * FROM jobs ORDER BY created_at DESC`)
              .all() as JobRow[];
            return rows.map(mapJobRow);
          },
          catch: (error) =>
            new StorageError(
              `Failed to get all jobs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      updateJobStatus: (id: string, status: BulkJobStatus, error?: string) =>
        Effect.try({
          try: () => {
            if (status === "running") {
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     started_at = COALESCE(started_at, unixepoch()),
                     error_message = NULL
                 WHERE id = ?`,
              ).run(status, id);
              return;
            }
            if (status === "error") {
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = ?
                 WHERE id = ?`,
              ).run(status, error ?? "Unknown error", id);
              return;
            }
            if (status === "done") {
              db.prepare(
                `UPDATE jobs
                 SET status = ?,
                     completed_at = unixepoch(),
                     error_message = NULL
                 WHERE id = ?`,
              ).run(status, id);
              return;
            }
            db.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).run(
              status,
              id,
            );
          },
          catch: (error) =>
            new StorageError(
              `Failed to update job status: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getJobStats: (id: string) =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT status, COUNT(*) as count
                 FROM job_queue
                 WHERE job_id = ?
                 GROUP BY status`,
              )
              .all(id) as { status: ScrapeStatus; count: number }[];
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
              `Failed to get job stats: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),
    });
  }),
);
