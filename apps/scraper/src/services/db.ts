import { Layer, Context } from "effect";
import Database from "better-sqlite3";

const DB_PATH = "./scraper-cache.sqlite";

export interface DatabaseService {
  readonly db: Database.Database;
}

export const DatabaseService =
  Context.GenericTag<DatabaseService>("DatabaseService");

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
    console.log(`[Database] Migrated table ${oldName} → ${newName}`);
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
      `[Database] Migrated ${oldJobsCount} rows from bulk_jobs → jobs`,
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
      `[Database] Migrated ${oldQueueCount} rows from scrape_queue → job_queue`,
    );
  }
};

const initSchema = (db: Database.Database) => {
  // Run table renames before creating tables
  migrateTableRename(db, "scrape_queue", "job_queue");
  migrateTableRename(db, "bulk_jobs", "jobs");

  // === HtmlCacheService tables ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_html (
      slug TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'kimovil',
      html TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (slug, source)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_verification (
      slug TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'kimovil',
      is_corrupted INTEGER NOT NULL DEFAULT 0,
      verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
      corruption_reason TEXT,
      PRIMARY KEY (slug, source)
    )
  `);

  ensureColumn(db, "scrape_verification", "source", "TEXT NOT NULL DEFAULT 'kimovil'");

  ensureColumn(db, "raw_html", "source", "TEXT NOT NULL DEFAULT 'kimovil'");

  // === JobQueueService tables ===
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

  ensureColumn(db, "job_queue", "job_id", "TEXT");
  ensureColumn(db, "job_queue", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
  ensureColumn(db, "job_queue", "attempt", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "job_queue", "max_attempts", "INTEGER NOT NULL DEFAULT 5");
  ensureColumn(db, "job_queue", "next_attempt_at", "INTEGER");
  ensureColumn(db, "job_queue", "updated_at", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "job_queue", "last_error_code", "TEXT");
  db.exec(`UPDATE job_queue SET updated_at = created_at WHERE updated_at = 0`);

  ensureColumn(db, "jobs", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
  ensureColumn(db, "jobs", "ai_mode", "TEXT");
  ensureColumn(db, "jobs", "batch_request_id", "TEXT");
  ensureColumn(db, "jobs", "batch_status", "TEXT");

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

  // === DeviceService tables ===
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

  // === PhoneDataService tables ===
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

  console.log("[Database] Schema initialized at", DB_PATH);
};

export const DatabaseServiceLive = Layer.sync(DatabaseService, () => {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  initSchema(db);

  return { db };
});
