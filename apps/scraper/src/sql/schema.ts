import { Effect, Layer } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { generateDeviceId } from "@repo/scraper-domain/server";

const tableExists = (
  sql: SqlClient.SqlClient,
  table: string,
)=>
  sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`.pipe(
    Effect.map((rows) => rows.length > 0),
  );

const ensureColumn = (
  sql: SqlClient.SqlClient,
  table: string,
  column: string,
  definition: string,
)=>
  Effect.gen(function* () {
    const columns = (yield* sql.unsafe(
      `PRAGMA table_info(${table})`,
    )) as Array<{ name: string }>;

    const hasColumn = columns.some((c) => c.name === column);
    if (hasColumn) return;

    yield* sql.unsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }).pipe(Effect.asVoid, Effect.mapError((e) => e as SqlError.SqlError));

const migrateTableRename = (
  sql: SqlClient.SqlClient,
  oldName: string,
  newName: string,
)=>
  Effect.gen(function* () {
    const oldExists = yield* tableExists(sql, oldName);
    const newExists = yield* tableExists(sql, newName);

    if (oldExists && !newExists) {
      yield* sql.unsafe(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
      yield* Effect.logInfo(`Migrated table ${oldName} → ${newName}`);
    }
  }).pipe(Effect.asVoid, Effect.mapError((e) => e as SqlError.SqlError));

const columnExists = (
  sql: SqlClient.SqlClient,
  table: string,
  column: string,
): Effect.Effect<boolean, SqlError.SqlError> =>
  sql.unsafe(`PRAGMA table_info(${table})`).pipe(
    Effect.map((columns) =>
      (columns as Array<{ name: string }>).some((c) => c.name === column),
    ),
  );

const migrateWidgetMappingsStatusConstraint = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const rows = yield* sql.unsafe(`SELECT sql FROM sqlite_master WHERE type='table' AND name='widget_model_mappings'`);
    const createSql = (rows[0] as { sql: string } | undefined)?.sql ?? "";
    const needsMigration = createSql.includes("status") && !createSql.includes("suggested");

    if (!needsMigration) return;

    yield* Effect.logInfo("Migrating widget_model_mappings table to update status constraint...");

    // Check which columns exist in the old table
    const hasUsageCount = yield* columnExists(sql, "widget_model_mappings", "usage_count");
    const hasFirstSeenAt = yield* columnExists(sql, "widget_model_mappings", "first_seen_at");
    const hasLastSeenAt = yield* columnExists(sql, "widget_model_mappings", "last_seen_at");

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(`
          CREATE TABLE widget_model_mappings_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL DEFAULT 'wordpress',
            raw_model TEXT NOT NULL,
            normalized_model TEXT,
            device_id TEXT REFERENCES devices(id),
            confidence REAL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'suggested', 'auto_confirmed', 'confirmed', 'ignored')),
            override_category_id INTEGER REFERENCES device_categories(id),
            locked INTEGER NOT NULL DEFAULT 0,
            usage_count INTEGER NOT NULL DEFAULT 0,
            first_seen_at INTEGER,
            last_seen_at INTEGER,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(source, raw_model)
          )
        `);

        // Build SELECT with fallbacks for missing columns
        const usageCountExpr = hasUsageCount ? "COALESCE(usage_count, 0)" : "0";
        const firstSeenExpr = hasFirstSeenAt ? "first_seen_at" : "NULL";
        const lastSeenExpr = hasLastSeenAt ? "last_seen_at" : "NULL";

        yield* sql.unsafe(`
          INSERT INTO widget_model_mappings_new
          SELECT id, source, raw_model, normalized_model, device_id, confidence,
            CASE WHEN status = 'ambiguous' THEN 'suggested' ELSE status END,
            override_category_id, locked,
            ${usageCountExpr}, ${firstSeenExpr}, ${lastSeenExpr},
            created_at, updated_at
          FROM widget_model_mappings
        `);

        yield* sql.unsafe(`DROP TABLE widget_model_mappings`);
        yield* sql.unsafe(`ALTER TABLE widget_model_mappings_new RENAME TO widget_model_mappings`);

        // Recreate indexes after table rename
        yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_mappings_device ON widget_model_mappings(device_id)`);
        yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_mappings_status ON widget_model_mappings(status)`);
      }),
    );

    yield* Effect.logInfo("Successfully migrated widget_model_mappings status constraint");
  });

const getRowCount = (
  sql: SqlClient.SqlClient,
  table: string,
)=>
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
            ? Effect.gen(function* () {
                // We need to populate job_queue.device_id. The legacy scrape_queue has only slug,
                // so we deterministically derive device_id from the slug (same logic as the registry).
                const legacyRows = (yield* sql.unsafe(
                  `SELECT id, slug, job_id, mode, status, attempt, max_attempts, next_attempt_at, created_at, updated_at, started_at, completed_at, error_message, last_error_code
                   FROM scrape_queue`,
                )) as Array<{
                  id: number;
                  slug: string;
                  job_id: string | null;
                  mode: string;
                  status: string;
                  attempt: number;
                  max_attempts: number;
                  next_attempt_at: number | null;
                  created_at: number;
                  updated_at: number;
                  started_at: number | null;
                  completed_at: number | null;
                  error_message: string | null;
                  last_error_code: string | null;
                }>;

                for (const row of legacyRows) {
                  const deviceId = generateDeviceId(row.slug);
                  yield* sql`
                    INSERT INTO job_queue (
                      id,
                      external_id,
                      device_id,
                      job_id,
                      job_type,
                      mode,
                      status,
                      attempt,
                      max_attempts,
                      next_attempt_at,
                      created_at,
                      updated_at,
                      started_at,
                      completed_at,
                      error_message,
                      last_error_code
                    )
                    VALUES (
                      ${row.id},
                      ${row.slug},
                      ${deviceId},
                      ${row.job_id},
                      'scrape',
                      ${row.mode as any},
                      ${row.status as any},
                      ${row.attempt},
                      ${row.max_attempts},
                      ${row.next_attempt_at},
                      ${row.created_at},
                      ${row.updated_at},
                      ${row.started_at},
                      ${row.completed_at},
                      ${row.error_message},
                      ${row.last_error_code}
                    )
                  `;
                }

                yield* Effect.logInfo(
                  `Migrated ${oldQueueCount} rows from scrape_queue → job_queue`,
                );
              })
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

const migrateJobTypeConstraint = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    // Check if jobs table has old CHECK constraint
    const rows = yield* sql.unsafe(`SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'`);
    const createSql = (rows[0] as { sql: string } | undefined)?.sql ?? "";
    // Check if the constraint is missing link_priceru
    const needsMigration = createSql.includes("job_type") && !createSql.includes("link_priceru");

    if (!needsMigration) return;

    yield* Effect.logInfo("Migrating jobs/job_queue tables to add new job_type values...");

    // Migrate jobs table
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS jobs_new (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai', 'clear_html', 'clear_raw', 'clear_processed', 'link_priceru')),
        mode TEXT NOT NULL CHECK (mode IN ('fast', 'complex')),
        ai_mode TEXT CHECK (ai_mode IS NULL OR ai_mode IN ('realtime', 'batch')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'pausing', 'paused', 'done', 'error')),
        filter TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        started_at INTEGER,
        completed_at INTEGER,
        error_message TEXT,
        total_count INTEGER,
        queued_count INTEGER,
        batch_request_id TEXT,
        batch_status TEXT,
        source TEXT NOT NULL DEFAULT 'kimovil',
        data_kind TEXT NOT NULL DEFAULT 'specs'
      )
    `);

    yield* sql.unsafe(`
      INSERT INTO jobs_new SELECT
        id, job_type, mode, ai_mode, status, filter, created_at, started_at, completed_at,
        error_message, total_count, queued_count, batch_request_id, batch_status,
        COALESCE(source, 'kimovil'), COALESCE(data_kind, 'specs')
      FROM jobs
    `);

    yield* sql.unsafe(`DROP TABLE jobs`);
    yield* sql.unsafe(`ALTER TABLE jobs_new RENAME TO jobs`);

    // Migrate job_queue table
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS job_queue_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT NOT NULL,
        device_id TEXT NOT NULL REFERENCES devices(id),
        job_id TEXT,
        job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai', 'clear_html', 'clear_raw', 'clear_processed', 'link_priceru')),
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
        last_error_code TEXT,
        source TEXT NOT NULL DEFAULT 'kimovil',
        data_kind TEXT NOT NULL DEFAULT 'specs',
        scrape_id INTEGER
      )
    `);

    yield* sql.unsafe(`
      INSERT INTO job_queue_new SELECT
        id, external_id, device_id, job_id, job_type, mode, status, attempt, max_attempts,
        next_attempt_at, created_at, updated_at, started_at, completed_at, error_message,
        last_error_code, COALESCE(source, 'kimovil'), COALESCE(data_kind, 'specs'), scrape_id
      FROM job_queue
    `);

    yield* sql.unsafe(`DROP TABLE job_queue`);
    yield* sql.unsafe(`ALTER TABLE job_queue_new RENAME TO job_queue`);

    // Recreate indexes
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_external_id ON job_queue(external_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_device_id ON job_queue(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_id ON job_queue(job_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_next_attempt ON job_queue(next_attempt_at)`);
    yield* sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_job_source_target ON job_queue(job_id, source, external_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_type ON job_queue(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_batch_request ON jobs(batch_request_id)`);

    yield* Effect.logInfo("Successfully migrated jobs/job_queue tables with new job_type CHECK constraint");
  });

interface KimovilDeviceRow {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  first_seen: number;
  last_seen: number;
}

interface PhoneDataRow {
  slug: string;
  data: string;
  created_at: number;
  updated_at: number;
}

const migratePhoneDataToEntityData = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const entityRawCount = yield* getRowCount(sql, "entity_data_raw");
    const entityFinalCount = yield* getRowCount(sql, "entity_data");
    const phoneRawCount = yield* getRowCount(sql, "phone_data_raw");
    const phoneFinalCount = yield* getRowCount(sql, "phone_data");

    // Skip if phone tables are empty (nothing to migrate)
    if (phoneRawCount === 0 && phoneFinalCount === 0) {
      return;
    }

    // Migrate phone_data_raw → entity_data_raw (if phone has more data)
    if (phoneRawCount > entityRawCount) {
      yield* Effect.logInfo(
        `Migrating ${phoneRawCount} rows from phone_data_raw → entity_data_raw`,
      );

      const phoneRawRows = (yield* sql.unsafe(
        `SELECT p.slug, p.data, p.created_at, p.updated_at
         FROM phone_data_raw p
         JOIN devices d ON d.slug = p.slug`,
      )) as PhoneDataRow[];

      let migrated = 0;
      for (const row of phoneRawRows) {
        yield* sql.unsafe(
          `INSERT OR IGNORE INTO entity_data_raw (device_id, source, data_kind, data, created_at, updated_at)
           SELECT d.id, 'kimovil', 'specs', ?, ?, ?
           FROM devices d WHERE d.slug = ?`,
          [row.data, row.created_at, row.updated_at, row.slug],
        );
        migrated++;
        if (migrated % 1000 === 0) {
          yield* Effect.logInfo(
            `Migrated ${migrated}/${phoneRawCount} phone_data_raw rows`,
          );
        }
      }

      yield* Effect.logInfo(
        `Completed migration: ${migrated} rows from phone_data_raw → entity_data_raw`,
      );
    }

    // Migrate phone_data → entity_data (if phone has more data)
    if (phoneFinalCount > entityFinalCount) {
      yield* Effect.logInfo(
        `Migrating ${phoneFinalCount} rows from phone_data → entity_data`,
      );

      const phoneFinalRows = (yield* sql.unsafe(
        `SELECT p.slug, p.data, p.created_at, p.updated_at
         FROM phone_data p
         JOIN devices d ON d.slug = p.slug`,
      )) as PhoneDataRow[];

      let migrated = 0;
      for (const row of phoneFinalRows) {
        yield* sql.unsafe(
          `INSERT OR IGNORE INTO entity_data (device_id, data_kind, data, created_at, updated_at)
           SELECT d.id, 'specs', ?, ?, ?
           FROM devices d WHERE d.slug = ?`,
          [row.data, row.created_at, row.updated_at, row.slug],
        );
        migrated++;
        if (migrated % 500 === 0) {
          yield* Effect.logInfo(
            `Migrated ${migrated}/${phoneFinalCount} phone_data rows`,
          );
        }
      }

      yield* Effect.logInfo(
        `Completed migration: ${migrated} rows from phone_data → entity_data`,
      );
    }
  });

const migrateKimovilDevices = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const devicesCount = yield* getRowCount(sql, "devices");
    const kimovilCount = yield* getRowCount(sql, "kimovil_devices");

    if (devicesCount > 0 || kimovilCount === 0) {
      return;
    }

    yield* Effect.logInfo(`Migrating ${kimovilCount} devices from kimovil_devices`);

    const kimovilDevices = (yield* sql.unsafe(
      `SELECT id, slug, name, brand, first_seen, last_seen FROM kimovil_devices`,
    )) as KimovilDeviceRow[];

    let migrated = 0;
    for (const row of kimovilDevices) {
      const deviceId = generateDeviceId(row.slug);

      yield* sql`
        INSERT OR IGNORE INTO devices (id, slug, name, brand, created_at, updated_at)
        VALUES (${deviceId}, ${row.slug}, ${row.name}, ${row.brand}, ${row.first_seen}, ${row.last_seen})
      `;

      yield* sql`
        INSERT OR IGNORE INTO device_sources (device_id, source, external_id, url, status, first_seen, last_seen)
        VALUES (${deviceId}, 'kimovil', ${row.slug}, NULL, 'active', ${row.first_seen}, ${row.last_seen})
      `;

      migrated++;
      if (migrated % 1000 === 0) {
        yield* Effect.logInfo(`Migrated ${migrated}/${kimovilCount} devices`);
      }
    }

    yield* Effect.logInfo(`Completed migration: ${migrated} devices from kimovil_devices`);
  });

const migrateKimovilPrefixState = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const oldExists = yield* tableExists(sql, "kimovil_prefix_state");
    const newCount = yield* getRowCount(sql, "discovery_queue");

    if (oldExists && newCount === 0) {
      yield* sql.unsafe(`
        INSERT INTO discovery_queue (source, query, depth, status, last_result_count, last_run_at, created_at)
        SELECT 'kimovil', prefix, depth, status, last_result_count, last_run_at, COALESCE(last_run_at, unixepoch())
        FROM kimovil_prefix_state
      `);
      const migrated = yield* getRowCount(sql, "discovery_queue");
      yield* Effect.logInfo(`Migrated ${migrated} rows from kimovil_prefix_state → discovery_queue`);
    }
  });

const migrateJobsStatusConstraint = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const rows = (yield* sql`
      SELECT sql FROM sqlite_master
      WHERE type = 'table' AND name = 'jobs'
    `) as Array<{ sql: string | null }>;

    if (rows.length === 0 || !rows[0].sql) {
      return;
    }

    const createSql = rows[0].sql;
    const oldCheck =
      "CHECK (status IN ('pending', 'running', 'paused', 'done', 'error'))";
    const newCheck =
      "CHECK (status IN ('pending', 'running', 'pausing', 'paused', 'done', 'error'))";

    if (!createSql.includes(oldCheck)) {
      return;
    }

    const newCreateSql = createSql.replace(oldCheck, newCheck);

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(`ALTER TABLE jobs RENAME TO jobs_old_status_check`);
        yield* sql.unsafe(newCreateSql);

        const columns = (yield* sql.unsafe(
          `PRAGMA table_info(jobs_old_status_check)`,
        )) as Array<{ name: string }>;
        const columnList = columns.map((c) => c.name).join(", ");

        yield* sql.unsafe(
          `INSERT INTO jobs (${columnList}) SELECT ${columnList} FROM jobs_old_status_check`,
        );
        yield* sql.unsafe(`DROP TABLE jobs_old_status_check`);
      }),
    );

    yield* Effect.logInfo(
      "Migrated jobs.status CHECK constraint to include 'pausing'",
    );
  });

const migrateDeviceSourcesRemoveUniqueConstraint = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const rows = (yield* sql`
      SELECT sql FROM sqlite_master
      WHERE type = 'table' AND name = 'device_sources'
    `) as Array<{ sql: string | null }>;

    if (rows.length === 0 || !rows[0].sql) {
      return;
    }

    const createSql = rows[0].sql;

    if (!createSql.includes("UNIQUE (device_id, source)")) {
      return;
    }

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(`ALTER TABLE device_sources RENAME TO device_sources_old`);

        yield* sql.unsafe(`
          CREATE TABLE device_sources (
            device_id TEXT NOT NULL REFERENCES devices(id),
            source TEXT NOT NULL,
            external_id TEXT NOT NULL,
            url TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','missing','deleted','conflict','not_found')),
            metadata TEXT,
            first_seen INTEGER NOT NULL DEFAULT (unixepoch()),
            last_seen INTEGER NOT NULL DEFAULT (unixepoch()),
            PRIMARY KEY (source, external_id)
          )
        `);

        yield* sql.unsafe(`
          INSERT INTO device_sources (device_id, source, external_id, url, status, first_seen, last_seen)
          SELECT device_id, source, external_id, url, status, first_seen, last_seen
          FROM device_sources_old
        `);

        yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_sources_device ON device_sources(device_id)`);

        yield* sql.unsafe(`DROP TABLE device_sources_old`);
      }),
    );

    yield* Effect.logInfo(
      "Migrated device_sources: removed UNIQUE(device_id, source) constraint",
    );
  });

const migrateDeviceSourcesAddNotFoundStatus = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const rows = (yield* sql`
      SELECT sql FROM sqlite_master
      WHERE type = 'table' AND name = 'device_sources'
    `) as Array<{ sql: string | null }>;

    if (rows.length === 0 || !rows[0].sql) {
      return;
    }

    const createSql = rows[0].sql;

    // Already migrated if 'not_found' is in the constraint
    if (createSql.includes("not_found")) {
      return;
    }

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(`ALTER TABLE device_sources RENAME TO device_sources_old`);

        yield* sql.unsafe(`
          CREATE TABLE device_sources (
            device_id TEXT NOT NULL REFERENCES devices(id),
            source TEXT NOT NULL,
            external_id TEXT NOT NULL,
            url TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','missing','deleted','conflict','not_found')),
            metadata TEXT,
            first_seen INTEGER NOT NULL DEFAULT (unixepoch()),
            last_seen INTEGER NOT NULL DEFAULT (unixepoch()),
            PRIMARY KEY (source, external_id)
          )
        `);

        yield* sql.unsafe(`
          INSERT INTO device_sources (device_id, source, external_id, url, status, metadata, first_seen, last_seen)
          SELECT device_id, source, external_id, url, status, metadata, first_seen, last_seen
          FROM device_sources_old
        `);

        yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_sources_device ON device_sources(device_id)`);

        yield* sql.unsafe(`DROP TABLE device_sources_old`);
      }),
    );

    yield* Effect.logInfo(
      "Migrated device_sources: added 'not_found' to status CHECK constraint",
    );
  });

const migrateJobQueueSlugToExternalId = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const hasSlug = yield* columnExists(sql, "job_queue", "slug");
    const hasExternalId = yield* columnExists(sql, "job_queue", "external_id");

    if (hasSlug && !hasExternalId) {
      yield* sql.unsafe(`ALTER TABLE job_queue RENAME COLUMN slug TO external_id`);
      yield* Effect.logInfo("Migrated job_queue: renamed slug → external_id");
    }

    yield* ensureColumn(sql, "job_queue", "device_id", "TEXT");

    yield* sql.unsafe(`DROP INDEX IF EXISTS idx_job_queue_slug`);
    yield* sql.unsafe(`DROP INDEX IF EXISTS idx_job_queue_job_slug`);
  });

const backfillJobQueueDeviceId = (
  sql: SqlClient.SqlClient,
): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    const missing = (yield* sql.unsafe(`
      SELECT DISTINCT external_id, source
      FROM job_queue
      WHERE device_id IS NULL OR device_id = ''
    `)) as Array<{ external_id: string; source: string | null }>;

    if (missing.length === 0) return;

    for (const row of missing) {
      const externalId = row.external_id;
      const source = row.source ?? "kimovil";

      const resolved = yield* sql<{ device_id: string }>`
        SELECT device_id FROM device_sources
        WHERE source = ${source} AND external_id = ${externalId}
        LIMIT 1
      `;

      let deviceId = resolved[0]?.device_id;
      if (!deviceId) {
        const canonicalSlug =
          source === "kimovil" ? externalId : `${source}:${externalId}`;
        deviceId = generateDeviceId(canonicalSlug);

        yield* sql`
          INSERT OR IGNORE INTO devices (id, slug, name, brand, created_at, updated_at)
          VALUES (${deviceId}, ${canonicalSlug}, ${canonicalSlug}, NULL, unixepoch(), unixepoch())
        `;

        yield* sql`
          INSERT INTO device_sources (device_id, source, external_id, url, status, first_seen, last_seen)
          VALUES (${deviceId}, ${source}, ${externalId}, NULL, 'active', unixepoch(), unixepoch())
          ON CONFLICT(source, external_id) DO UPDATE SET
            device_id = excluded.device_id,
            status = 'active',
            last_seen = unixepoch()
        `;
      }

      yield* sql`
        UPDATE job_queue
        SET device_id = ${deviceId}
        WHERE source = ${source} AND external_id = ${externalId}
          AND (device_id IS NULL OR device_id = '')
      `;
    }

    yield* Effect.logInfo("Backfilled job_queue.device_id for legacy rows").pipe(
      Effect.annotateLogs({ count: missing.length }),
    );
  });

const initSchema = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    // PRAGMA settings are run once at schema init. WAL mode persists in the database file
    // and busy_timeout is set per-connection but we only have one connection in this app.
    yield* sql.unsafe(`PRAGMA journal_mode = WAL`);
    yield* sql.unsafe(`PRAGMA busy_timeout = 5000`);

    yield* migrateTableRename(sql, "scrape_queue", "job_queue");
    yield* migrateTableRename(sql, "bulk_jobs", "jobs");

    yield* migrateJobsStatusConstraint(sql);
    yield* migrateDeviceSourcesRemoveUniqueConstraint(sql);
    yield* migrateDeviceSourcesAddNotFoundStatus(sql);
    yield* migrateJobQueueSlugToExternalId(sql);

    yield* sql.unsafe(`DROP TABLE IF EXISTS raw_html`);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS scrape_verification (
        slug TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'kimovil',
        is_corrupted INTEGER NOT NULL DEFAULT 0,
        verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
        corruption_reason TEXT,
        PRIMARY KEY (slug, source)
      )
    `);

    yield* ensureColumn(sql, "scrape_verification", "source", "TEXT NOT NULL DEFAULT 'kimovil'");

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT NOT NULL,
        device_id TEXT NOT NULL REFERENCES devices(id),
        job_id TEXT,
        job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai', 'clear_html', 'clear_raw', 'clear_processed', 'link_priceru')),
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
        job_type TEXT NOT NULL DEFAULT 'scrape' CHECK (job_type IN ('scrape', 'process_raw', 'process_ai', 'clear_html', 'clear_raw', 'clear_processed', 'link_priceru')),
        mode TEXT NOT NULL CHECK (mode IN ('fast', 'complex')),
        ai_mode TEXT CHECK (ai_mode IS NULL OR ai_mode IN ('realtime', 'batch')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'pausing', 'paused', 'done', 'error')),
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
    yield* ensureColumn(sql, "job_queue", "outcome", "TEXT");
    yield* ensureColumn(sql, "job_queue", "outcome_message", "TEXT");
    yield* sql.unsafe(`UPDATE job_queue SET updated_at = created_at WHERE updated_at = 0`);

    yield* ensureColumn(sql, "jobs", "job_type", "TEXT NOT NULL DEFAULT 'scrape'");
    yield* ensureColumn(sql, "jobs", "ai_mode", "TEXT");
    yield* ensureColumn(sql, "jobs", "batch_request_id", "TEXT");
    yield* ensureColumn(sql, "jobs", "batch_status", "TEXT");

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_external_id ON job_queue(external_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_device_id ON job_queue(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_id ON job_queue(job_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_next_attempt ON job_queue(next_attempt_at)`);
    yield* sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_job_source_target ON job_queue(job_id, source, external_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_queue_job_type ON job_queue(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_jobs_batch_request ON jobs(batch_request_id)`);

    // Data migrations wrapped for atomicity - if one fails, rollback
    yield* sql.withTransaction(migrateJobsData(sql));

    // Drop legacy tables after successful data migration
    yield* dropLegacyTables(sql);

    // Migrate jobs/job_queue CHECK constraints to include new job_type values
    yield* migrateJobTypeConstraint(sql);

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
      CREATE TABLE IF NOT EXISTS discovery_queue (
        source TEXT NOT NULL,
        query TEXT NOT NULL,
        depth INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
        last_result_count INTEGER,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (source, query)
      )
    `);

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_discovery_queue_source_status ON discovery_queue(source, status, depth, query)`);



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

    // Phase 1: Multi-source schema extensions
    // Add new columns to existing tables
    yield* ensureColumn(sql, "jobs", "source", "TEXT NOT NULL DEFAULT 'kimovil'");
    yield* ensureColumn(sql, "jobs", "data_kind", "TEXT NOT NULL DEFAULT 'specs'");
    yield* ensureColumn(sql, "job_queue", "source", "TEXT NOT NULL DEFAULT 'kimovil'");
    yield* ensureColumn(sql, "job_queue", "data_kind", "TEXT NOT NULL DEFAULT 'specs'");
    yield* ensureColumn(sql, "job_queue", "scrape_id", "INTEGER");
    
    yield* ensureColumn(sql, "scrape_verification", "scrape_id", "INTEGER");

    // Canonical device registry
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Links devices to external sources (allows multiple links per device per source)
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS device_sources (
        device_id TEXT NOT NULL REFERENCES devices(id),
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        url TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','missing','deleted','conflict','not_found')),
        metadata TEXT,
        first_seen INTEGER NOT NULL DEFAULT (unixepoch()),
        last_seen INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (source, external_id)
      )
    `);

    // Add metadata column if missing (for existing databases)
    yield* ensureColumn(sql, "device_sources", "metadata", "TEXT");

    // Individual scrape attempts
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS scrapes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT REFERENCES devices(id),
        source TEXT NOT NULL,
        data_kind TEXT NOT NULL,
        external_id TEXT NOT NULL,
        url TEXT,
        requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
        started_at INTEGER,
        completed_at INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
        error_message TEXT
      )
    `);

    // HTML artifacts keyed by scrape_id
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS scrape_html (
        scrape_id INTEGER PRIMARY KEY REFERENCES scrapes(id),
        html TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Source-specific extracted data
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS entity_data_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL REFERENCES devices(id),
        source TEXT NOT NULL,
        data_kind TEXT NOT NULL,
        scrape_id INTEGER REFERENCES scrapes(id),
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(device_id, source, data_kind)
      )
    `);

    // Normalized/merged data
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS entity_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL REFERENCES devices(id),
        data_kind TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(device_id, data_kind)
      )
    `);

    // Price quotes
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS price_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL REFERENCES devices(id),
        source TEXT NOT NULL,
        seller TEXT,
        price_minor_units INTEGER NOT NULL,
        currency TEXT NOT NULL,
        url TEXT,
        scraped_at INTEGER NOT NULL,
        scrape_id INTEGER REFERENCES scrapes(id),
        is_available INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Price summary
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS price_summary (
        device_id TEXT PRIMARY KEY REFERENCES devices(id),
        min_price_minor_units INTEGER,
        max_price_minor_units INTEGER,
        currency TEXT,
        updated_at INTEGER
      )
    `);

    // New indexes for multi-source tables
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_scrapes_device ON scrapes(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_scrapes_source_ext ON scrapes(source, external_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_quotes_device ON price_quotes(device_id, source, scraped_at)`);

    // Yandex.Market price scraping columns
    yield* ensureColumn(sql, "price_quotes", "seller_id", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "variant_key", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "variant_label", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "offer_id", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "external_id", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "redirect_type", "TEXT");
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_quotes_variant ON price_quotes(device_id, variant_key, scraped_at)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_quotes_link ON price_quotes(device_id, source, external_id, scraped_at)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entity_data_raw_device ON entity_data_raw(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entity_data_device ON entity_data(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_sources_device ON device_sources(device_id)`);

    // Add offer_count to price_summary for pre-computed price counts
    yield* ensureColumn(sql, "price_summary", "offer_count", "INTEGER DEFAULT 0");

    // URL refresh tracking for price.ru (URLs expire ~10 min)
    yield* ensureColumn(sql, "price_summary", "url_refreshed_at", "INTEGER");
    yield* ensureColumn(sql, "price_summary", "url_refresh_started_at", "INTEGER");

    // Backfill offer_count for existing price_summary records
    yield* sql.unsafe(`
      UPDATE price_summary
      SET offer_count = (
        SELECT COUNT(*) FROM price_quotes WHERE price_quotes.device_id = price_summary.device_id
      )
      WHERE offer_count IS NULL OR offer_count = 0
    `);

    // Price quote exclusions - prevents wrong model matches from reappearing after deletion
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS price_quote_exclusions (
        device_id TEXT NOT NULL REFERENCES devices(id),
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (device_id, source, external_id)
      )
    `);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_pq_excl_device ON price_quote_exclusions(device_id, source)`);

    yield* sql.withTransaction(migrateKimovilDevices(sql));
    yield* sql.withTransaction(backfillJobQueueDeviceId(sql));

    // Drop legacy kimovil_devices table after migration to devices/device_sources
    yield* sql.unsafe(`DROP TABLE IF EXISTS kimovil_devices`);

    // Migrate legacy phone_data_* tables to entity_data_* tables
    yield* sql.withTransaction(migratePhoneDataToEntityData(sql));

    // Drop legacy phone_data tables (migrated to entity_data_*)
    yield* sql.unsafe(`DROP TABLE IF EXISTS phone_data_raw`);
    yield* sql.unsafe(`DROP TABLE IF EXISTS phone_data`);

    // Migrate kimovil_prefix_state → discovery_queue
    yield* sql.withTransaction(migrateKimovilPrefixState(sql));
    yield* sql.unsafe(`DROP TABLE IF EXISTS kimovil_prefix_state`);

    // Job schedules for recurring cron jobs
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS job_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        data_kind TEXT NOT NULL,
        job_type TEXT NOT NULL DEFAULT 'scrape',
        mode TEXT NOT NULL DEFAULT 'fast',
        filter TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        run_once INTEGER NOT NULL DEFAULT 0,
        cron_expression TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        next_run_at INTEGER,
        last_run_at INTEGER,
        last_status TEXT,
        last_error TEXT,
        last_job_id TEXT,
        locked_until INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_schedules_enabled ON job_schedules(enabled)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_job_schedules_next_run ON job_schedules(next_run_at)`);
    yield* ensureColumn(sql, "job_schedules", "run_once", "INTEGER NOT NULL DEFAULT 0");

    // Device categories hierarchy
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS device_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES device_categories(id),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    // Note: slug already has implicit index from UNIQUE constraint
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_categories_parent ON device_categories(parent_id)`);

    // Add primary_category_id to devices table
    yield* ensureColumn(sql, "devices", "primary_category_id", "INTEGER REFERENCES device_categories(id)");
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_devices_primary_category ON devices(primary_category_id)`);

    // Join table for multi-category support
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS device_category_links (
        device_id TEXT NOT NULL REFERENCES devices(id),
        category_id INTEGER NOT NULL REFERENCES device_categories(id),
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (device_id, category_id)
      )
    `);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_category_links_category ON device_category_links(category_id)`);
    yield* sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_device_single_primary ON device_category_links(device_id) WHERE is_primary = 1`);

    // Add release_date to devices table (materialized from entity_data_raw JSON)
    yield* ensureColumn(sql, "devices", "release_date", "TEXT");
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_devices_release_date ON devices(release_date DESC, name)`);

    // Backfill release_date from entity_data_raw (runs once, skips if already populated)
    yield* sql.unsafe(`
      UPDATE devices
      SET release_date = (
        SELECT json_extract(edr.data, '$.releaseDate')
        FROM entity_data_raw edr
        WHERE edr.device_id = devices.id
          AND edr.source = 'kimovil'
          AND edr.data_kind = 'specs'
      )
      WHERE release_date IS NULL
    `);

    // Create triggers to keep release_date in sync with entity_data_raw
    yield* sql.unsafe(`DROP TRIGGER IF EXISTS entity_data_raw_release_ai`);
    yield* sql.unsafe(`
      CREATE TRIGGER entity_data_raw_release_ai
      AFTER INSERT ON entity_data_raw
      WHEN NEW.source = 'kimovil' AND NEW.data_kind = 'specs'
      BEGIN
        UPDATE devices
        SET release_date = json_extract(NEW.data, '$.releaseDate')
        WHERE id = NEW.device_id;
      END
    `);

    yield* sql.unsafe(`DROP TRIGGER IF EXISTS entity_data_raw_release_au`);
    yield* sql.unsafe(`
      CREATE TRIGGER entity_data_raw_release_au
      AFTER UPDATE OF data ON entity_data_raw
      WHEN NEW.source = 'kimovil' AND NEW.data_kind = 'specs'
      BEGIN
        UPDATE devices
        SET release_date = json_extract(NEW.data, '$.releaseDate')
        WHERE id = NEW.device_id;
      END
    `);

    // Widget model mappings for WordPress integration
    yield* migrateWidgetMappingsStatusConstraint(sql);
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS widget_model_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'wordpress',
        raw_model TEXT NOT NULL,
        normalized_model TEXT,
        device_id TEXT REFERENCES devices(id),
        confidence REAL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'suggested', 'auto_confirmed', 'confirmed', 'ignored')),
        override_category_id INTEGER REFERENCES device_categories(id),
        locked INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        first_seen_at INTEGER,
        last_seen_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(source, raw_model)
      )
    `);
    // Note: (source, raw_model) already has implicit index from UNIQUE constraint
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_mappings_device ON widget_model_mappings(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_mappings_status ON widget_model_mappings(status)`);

    // Migrations for widget_model_mappings
    yield* ensureColumn(sql, "widget_model_mappings", "usage_count", "INTEGER NOT NULL DEFAULT 0");
    yield* ensureColumn(sql, "widget_model_mappings", "first_seen_at", "INTEGER");
    yield* ensureColumn(sql, "widget_model_mappings", "last_seen_at", "INTEGER");

    yield* seedDeviceCategories(sql);

    // WordPress widget caching tables
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS sync_state (
        source TEXT PRIMARY KEY,
        last_synced_modified_gmt TEXT NOT NULL,
        last_run_at TEXT NOT NULL
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS wp_posts_cache (
        post_id INTEGER PRIMARY KEY,
        title TEXT,
        slug TEXT,
        status TEXT,
        post_date_gmt TEXT NOT NULL,
        post_modified_gmt TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        content_rendered TEXT,
        synced_at TEXT NOT NULL
      )
    `);

    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS wordpress_widget_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        search_text TEXT NOT NULL,
        occurrence_index INTEGER NOT NULL,
        post_date_gmt TEXT NOT NULL,
        post_modified_gmt TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        FOREIGN KEY (post_id) REFERENCES wp_posts_cache(post_id)
      )
    `);

    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_period ON wordpress_widget_cache(post_date_gmt, search_text)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_widget_post ON wordpress_widget_cache(post_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_posts_modified ON wp_posts_cache(post_modified_gmt)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_posts_date ON wp_posts_cache(post_date_gmt)`);

    // Cache for resolved catalogue links (kik.cat, ya.cc shorteners)
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS catalogue_link_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        original_url TEXT NOT NULL,
        resolved_url TEXT,
        is_yandex_market INTEGER NOT NULL DEFAULT 0,
        external_id TEXT,
        error TEXT,
        resolved_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(slug, original_url)
      )
    `);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_catalogue_link_cache_slug ON catalogue_link_cache(slug)`);

    // Widget creatives for Yandex affiliate links (erid/clid per device)
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS widget_creatives (
        device_id TEXT PRIMARY KEY,
        erid TEXT NOT NULL,
        clid INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Affiliate URL columns for price_quotes
    yield* ensureColumn(sql, "price_quotes", "affiliate_url", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "affiliate_url_created_at", "TEXT");
    yield* ensureColumn(sql, "price_quotes", "affiliate_error", "TEXT");

    // Device images - simple URL storage for device images
    // Migration: drop old schema if it has the legacy 'kind' column
    const hasOldSchema = yield* sql<{ name: string }>`
      SELECT name FROM pragma_table_info('device_images') WHERE name = 'kind'
    `.pipe(Effect.map((rows) => rows.length > 0));
    if (hasOldSchema) {
      yield* sql.unsafe(`DROP TABLE device_images`);
    }
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS device_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL REFERENCES devices(id),
        source TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(device_id, source, url)
      )
    `);
    
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_images_device ON device_images(device_id)`);
    yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_device_images_device_source ON device_images(device_id, source, position)`);

    // Backup table for entity_data_raw URLs before migration
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS entity_data_raw_backup (
        device_id    TEXT NOT NULL,
        source       TEXT NOT NULL,
        data_kind    TEXT NOT NULL,
        data         TEXT NOT NULL,
        backed_up_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (device_id, source, data_kind)
      )
    `);

    yield* Effect.logInfo("Schema initialized");
  });

const seedDeviceCategories = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError.SqlError> =>
  Effect.gen(function* () {
    // Root category
    yield* sql`INSERT OR IGNORE INTO device_categories (id, slug, name, parent_id) VALUES (1, 'electronics', 'Электроника', NULL)`;

    // Direct children of electronics (parent_id = 1)
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('smartphone', 'Смартфон', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('tablet', 'Планшет', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('laptop', 'Ноутбук', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('watch', 'Часы', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('tv', 'Телевизор', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('headphones', 'Наушники', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('console', 'Игровая консоль', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('hybrid', 'Гибрид', 1)`;
    yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('accessory', 'Аксессуар', 1)`;

    // Subcategories (need to look up parent IDs)
    const laptopRow = yield* sql`SELECT id FROM device_categories WHERE slug = 'laptop'`;
    const laptopId = (laptopRow[0] as { id: number } | undefined)?.id;
    if (laptopId) {
      yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('gaming_laptop', 'Игровой ноутбук', ${laptopId})`;
    }

    const watchRow = yield* sql`SELECT id FROM device_categories WHERE slug = 'watch'`;
    const watchId = (watchRow[0] as { id: number } | undefined)?.id;
    if (watchId) {
      yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('smartwatch', 'Смарт-часы', ${watchId})`;
    }

    const headphonesRow = yield* sql`SELECT id FROM device_categories WHERE slug = 'headphones'`;
    const headphonesId = (headphonesRow[0] as { id: number } | undefined)?.id;
    if (headphonesId) {
      yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('true_wireless', 'TWS-наушники', ${headphonesId})`;
      yield* sql`INSERT OR IGNORE INTO device_categories (slug, name, parent_id) VALUES ('over_ear', 'Полноразмерные', ${headphonesId})`;
    }
  });

export const SchemaLive = Layer.effectDiscard(
  Effect.flatMap(SqlClient.SqlClient, initSchema),
);
