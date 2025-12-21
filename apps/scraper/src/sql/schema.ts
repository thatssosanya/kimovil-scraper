import { Effect, Layer } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

const tableExists = (
  sql: SqlClient.SqlClient,
  table: string,
): Effect.Effect<boolean, SqlError.SqlError> =>
  sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`.pipe(
    Effect.map((rows) => rows.length > 0),
  );

const ensureColumn = (
  sql: SqlClient.SqlClient,
  table: string,
  column: string,
  definition: string,
): Effect.Effect<void, SqlError.SqlError> =>
  sql.unsafe(`PRAGMA table_info(${table})`).pipe(
    Effect.map((columns) =>
      (columns as Array<{ name: string }>).some((c) => c.name === column),
    ),
    Effect.flatMap((hasColumn) =>
      hasColumn
        ? Effect.void
        : sql.unsafe(
            `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
          ),
    ),
    Effect.asVoid,
  );

const migrateTableRename = (
  sql: SqlClient.SqlClient,
  oldName: string,
  newName: string,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.all([tableExists(sql, oldName), tableExists(sql, newName)]).pipe(
    Effect.flatMap(([oldExists, newExists]) =>
      oldExists && !newExists
        ? sql
            .unsafe(`ALTER TABLE ${oldName} RENAME TO ${newName}`)
            .pipe(
              Effect.tap(() =>
                Effect.logInfo(`Migrated table ${oldName} → ${newName}`),
              ),
            )
        : Effect.void,
    ),
    Effect.asVoid,
  );

const getRowCount = (
  sql: SqlClient.SqlClient,
  table: string,
): Effect.Effect<number, SqlError.SqlError> =>
  tableExists(sql, table).pipe(
    Effect.flatMap((exists) =>
      exists
        ? sql
            .unsafe(`SELECT COUNT(*) as count FROM ${table}`)
            .pipe(Effect.map((rows) => (rows[0] as { count: number }).count))
        : Effect.succeed(0),
    ),
  );

const migrateJobsData = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError.SqlError> =>
  Effect.all([
    getRowCount(sql, "bulk_jobs"),
    getRowCount(sql, "jobs"),
    getRowCount(sql, "scrape_queue"),
    getRowCount(sql, "job_queue"),
  ]).pipe(
    Effect.flatMap(
      ([oldJobsCount, newJobsCount, oldQueueCount, newQueueCount]) =>
        Effect.all([
          oldJobsCount > 0 && newJobsCount === 0
            ? sql
                .unsafe(
                  `INSERT INTO jobs (id, mode, status, filter, created_at, started_at, completed_at, error_message, total_count, queued_count)
             SELECT id, mode, status, filter, created_at, started_at, completed_at, error_message, total_count, queued_count
             FROM bulk_jobs`,
                )
                .pipe(
                  Effect.tap(() =>
                    Effect.logInfo(
                      `Migrated ${oldJobsCount} rows from bulk_jobs → jobs`,
                    ),
                  ),
                )
            : Effect.void,
          oldQueueCount > 0 && newQueueCount === 0
            ? sql
                .unsafe(
                  `INSERT INTO job_queue (id, slug, job_id, job_type, mode, status, attempt, max_attempts, next_attempt_at, created_at, updated_at, started_at, completed_at, error_message, last_error_code)
             SELECT id, slug, job_id, 'scrape', mode, status, attempt, max_attempts, next_attempt_at, created_at, updated_at, started_at, completed_at, error_message, last_error_code
             FROM scrape_queue`,
                )
                .pipe(
                  Effect.tap(() =>
                    Effect.logInfo(
                      `Migrated ${oldQueueCount} rows from scrape_queue → job_queue`,
                    ),
                  ),
                )
            : Effect.void,
        ]),
    ),
    Effect.asVoid,
  );

const dropLegacyTables = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.all([
    sql.unsafe(`DROP TABLE IF EXISTS bulk_jobs`),
    sql.unsafe(`DROP TABLE IF EXISTS scrape_queue`),
  ]).pipe(
    Effect.tap(() => Effect.logInfo("Dropped legacy tables (bulk_jobs, scrape_queue)")),
    Effect.asVoid,
  );

const initSchema = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    // PRAGMA settings are run once at schema init. WAL mode persists in the database file
    // and busy_timeout is set per-connection but we only have one connection in this app.
    yield* sql.unsafe(`PRAGMA journal_mode = WAL`);
    yield* sql.unsafe(`PRAGMA busy_timeout = 5000`);

    yield* migrateTableRename(sql, "scrape_queue", "job_queue");
    yield* migrateTableRename(sql, "bulk_jobs", "jobs");

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS raw_html (
        slug TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'kimovil',
        html TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (slug, source)
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS scrape_verification (
        slug TEXT PRIMARY KEY,
        is_corrupted INTEGER NOT NULL DEFAULT 0,
        verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
        corruption_reason TEXT
      )
    `);

    yield* ensureColumn(sql, "raw_html", "source", "TEXT NOT NULL DEFAULT 'kimovil'");

    yield* sql.unsafe(`
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

    yield* sql.unsafe(`
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

    yield* ensureColumn(sql, "job_queue", "job_id", "TEXT");
    yield* ensureColumn(sql, "job_queue", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
    yield* ensureColumn(sql, "job_queue", "attempt", "INTEGER NOT NULL DEFAULT 0");
    yield* ensureColumn(sql, "job_queue", "max_attempts", "INTEGER NOT NULL DEFAULT 5");
    yield* ensureColumn(sql, "job_queue", "next_attempt_at", "INTEGER");
    yield* ensureColumn(sql, "job_queue", "updated_at", "INTEGER NOT NULL DEFAULT 0");
    yield* ensureColumn(sql, "job_queue", "last_error_code", "TEXT");
    yield* sql.unsafe(`UPDATE job_queue SET updated_at = created_at WHERE updated_at = 0`);

    yield* ensureColumn(sql, "jobs", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
    yield* ensureColumn(sql, "jobs", "ai_mode", "TEXT");
    yield* ensureColumn(sql, "jobs", "batch_request_id", "TEXT");
    yield* ensureColumn(sql, "jobs", "batch_status", "TEXT");

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_slug ON job_queue(slug)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_id ON job_queue(job_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_next_attempt ON job_queue(next_attempt_at)`);
    yield* sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_job_slug ON job_queue(job_id, slug)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_type ON job_queue(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_batch_request ON jobs(batch_request_id)`);

    // Data migrations wrapped for atomicity - if one fails, rollback
    yield* sql.withTransaction(migrateJobsData(sql));

    // Drop legacy tables after successful data migration
    yield* dropLegacyTables(sql);

    yield* sql.unsafe(`
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

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_kimovil_devices_slug ON kimovil_devices(slug)`);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS kimovil_prefix_state (
        prefix TEXT PRIMARY KEY,
        depth INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
        last_result_count INTEGER,
        last_run_at INTEGER
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS phone_data_raw (
        slug TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS phone_data (
        slug TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS quarantine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        source_table TEXT NOT NULL,
        data TEXT NOT NULL,
        error TEXT NOT NULL,
        quarantined_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_quarantine_slug ON quarantine(slug)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_quarantine_source ON quarantine(source_table)`);

    yield* Effect.logInfo("Schema initialized");
  });

export const SchemaLive = Layer.effectDiscard(
  Effect.flatMap(SqlClient.SqlClient, initSchema),
);
