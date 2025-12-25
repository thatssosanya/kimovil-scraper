import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import type { ScrapeMode, ScrapeStatus, JobStatus, JobType, AiMode } from "@repo/scraper-domain";
import { ScrapeRecordService } from "./scrape-record";

export type { ScrapeMode, ScrapeStatus, JobType, AiMode };
export type BulkJobStatus = JobStatus;

export interface JobQueueItem {
  id: number;
  externalId: string;
  deviceId: string;
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
  source: string;
  dataKind: string;
  scrapeId: number | null;
}

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
  source: string;
  dataKind: string;
}

export interface JobStats {
  total: number;
  pending: number;
  running: number;
  done: number;
  error: number;
}

export interface TimeoutStats {
  count: number;
  nextRetryAt: number | null;
  nextRetryExternalId: string | null;
}

export class JobQueueError extends Error {
  readonly _tag = "JobQueueError";
}

export interface JobQueueService {
  readonly createJob: (input: {
    id: string;
    jobType: JobType;
    mode: ScrapeMode;
    aiMode?: AiMode | null;
    filter?: string | null;
    totalCount?: number | null;
    queuedCount?: number | null;
    source?: string;
    dataKind?: string;
  }) => Effect.Effect<Job, JobQueueError>;

  readonly getJob: (id: string) => Effect.Effect<Job | null, JobQueueError>;
  readonly getAllJobs: () => Effect.Effect<Job[], JobQueueError>;

  readonly updateJobStatus: (
    id: string,
    status: BulkJobStatus,
    error?: string,
  ) => Effect.Effect<void, JobQueueError>;

  readonly updateJobCounts: (
    id: string,
    totalCount: number,
    queuedCount: number,
  ) => Effect.Effect<void, JobQueueError>;

  readonly getJobStats: (id: string) => Effect.Effect<JobStats, JobQueueError>;

  readonly enqueueJobTargets: (
    jobId: string,
    jobType: JobType,
    mode: ScrapeMode,
    targets: Array<{ deviceId: string; externalId: string }>,
    options?: {
      maxAttempts?: number;
      source?: string;
      dataKind?: string;
    },
  ) => Effect.Effect<{ queued: number }, JobQueueError>;

  readonly claimNextJobQueueItem: (
    jobId: string,
    jobType?: JobType,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly claimNextByPipeline: (
    jobId: string,
    source: string,
    dataKind: string,
    jobType?: JobType,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly completeQueueItem: (
    id: number,
    error?: string,
  ) => Effect.Effect<void, JobQueueError>;

  readonly rescheduleQueueItem: (
    id: number,
    nextAttemptAt: number,
    error: string,
    errorCode?: string,
  ) => Effect.Effect<void, JobQueueError>;

  readonly resetStuckQueueItems: (
    jobId: string,
  ) => Effect.Effect<number, JobQueueError>;

  readonly resetErrorQueueItems: (
    jobId: string,
  ) => Effect.Effect<number, JobQueueError>;

  readonly getErrorQueueItems: (
    jobId: string,
    limit?: number,
  ) => Effect.Effect<JobQueueItem[], JobQueueError>;

  readonly unclaimRunningItems: (
    jobId: string,
  ) => Effect.Effect<number, JobQueueError>;

  readonly getTimeoutStats: (
    jobId: string,
  ) => Effect.Effect<TimeoutStats, JobQueueError>;

  readonly updateJobBatchStatus: (
    jobId: string,
    batchRequestId: string,
    batchStatus: string,
  ) => Effect.Effect<void, JobQueueError>;

  readonly getRunningBatchJobs: () => Effect.Effect<Job[], JobQueueError>;

  readonly queueScrape: (
    externalId: string,
    deviceId: string,
    mode: ScrapeMode,
    options?: {
      jobId?: string | null;
      maxAttempts?: number;
      nextAttemptAt?: number | null;
      source?: string;
      dataKind?: string;
      scrapeId?: number;
    },
  ) => Effect.Effect<JobQueueItem, JobQueueError>;

  readonly getQueueItem: (
    id: number,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly getQueueItemByTarget: (
    source: string,
    externalId: string,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly getQueueItems: (
    status?: ScrapeStatus,
  ) => Effect.Effect<JobQueueItem[], JobQueueError>;

  readonly claimNextQueueItem: (
    jobId?: string,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly startQueueItem: (id: number) => Effect.Effect<void, JobQueueError>;

  readonly getNextPendingQueueItem: () => Effect.Effect<
    JobQueueItem | null,
    JobQueueError
  >;

  readonly clearScrapeData: (
    source: string,
    externalId: string,
  ) => Effect.Effect<void, JobQueueError>;
}

export const JobQueueService =
  Context.GenericTag<JobQueueService>("JobQueueService");

type QueueRow = {
  id: number;
  external_id: string;
  device_id: string;
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
  source: string;
  data_kind: string;
  scrape_id: number | null;
};

const mapQueueRow = (row: QueueRow): JobQueueItem => ({
  id: row.id,
  externalId: row.external_id,
  deviceId: row.device_id,
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
  source: row.source ?? "kimovil",
  dataKind: row.data_kind ?? "specs",
  scrapeId: row.scrape_id ?? null,
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
  source: string;
  data_kind: string;
};

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
  source: row.source ?? "kimovil",
  dataKind: row.data_kind ?? "specs",
});

const wrapSqlError = (error: SqlError.SqlError): JobQueueError =>
  new JobQueueError(error.message);

export const JobQueueServiceLive = Layer.effect(
  JobQueueService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const scrapeRecord = yield* ScrapeRecordService;

    return JobQueueService.of({
      createJob: (input) =>
        Effect.gen(function* () {
          const source = input.source ?? "kimovil";
          const dataKind = input.dataKind ?? "specs";
          yield* sql`
            INSERT INTO jobs (id, job_type, mode, ai_mode, status, filter, created_at, total_count, queued_count, source, data_kind)
            VALUES (${input.id}, ${input.jobType}, ${input.mode}, ${input.aiMode ?? null}, 'pending', ${input.filter ?? null}, unixepoch(), ${input.totalCount ?? null}, ${input.queuedCount ?? null}, ${source}, ${dataKind})
          `;
          const rows = yield* sql<JobRow>`SELECT * FROM jobs WHERE id = ${input.id}`;
          const row = rows[0];
          if (!row) return yield* Effect.fail(new JobQueueError("Failed to get inserted job"));
          return mapJobRow(row);
        }).pipe(Effect.mapError((e) => e instanceof JobQueueError ? e : wrapSqlError(e))),

      getJob: (id: string) =>
        sql<JobRow>`SELECT * FROM jobs WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapJobRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getAllJobs: () =>
        sql<JobRow>`SELECT * FROM jobs ORDER BY created_at DESC`.pipe(
          Effect.map((rows) => rows.map(mapJobRow)),
          Effect.mapError(wrapSqlError),
        ),

      updateJobStatus: (id: string, status: BulkJobStatus, error?: string) =>
        Effect.gen(function* () {
          if (status === "running") {
            yield* sql`
              UPDATE jobs
              SET status = ${status},
                  started_at = COALESCE(started_at, unixepoch()),
                  error_message = NULL
              WHERE id = ${id}
            `;
            return;
          }
          if (status === "error") {
            yield* sql`
              UPDATE jobs
              SET status = ${status},
                  completed_at = unixepoch(),
                  error_message = ${error ?? "Unknown error"}
              WHERE id = ${id}
            `;
            return;
          }
          if (status === "done") {
            yield* sql`
              UPDATE jobs
              SET status = ${status},
                  completed_at = unixepoch(),
                  error_message = NULL
              WHERE id = ${id}
            `;
            return;
          }
          yield* sql`UPDATE jobs SET status = ${status} WHERE id = ${id}`;
        }).pipe(Effect.mapError(wrapSqlError)),

      updateJobCounts: (id: string, totalCount: number, queuedCount: number) =>
        sql`
          UPDATE jobs SET total_count = ${totalCount}, queued_count = ${queuedCount} WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      getJobStats: (id: string) =>
        sql<{ status: ScrapeStatus; count: number }>`
          SELECT status, COUNT(*) as count
          FROM job_queue
          WHERE job_id = ${id}
          GROUP BY status
        `.pipe(
          Effect.map((rows) => {
            const counts = { pending: 0, running: 0, done: 0, error: 0 };
            for (const row of rows) {
              if (row.status === "pending") counts.pending = row.count;
              if (row.status === "running") counts.running = row.count;
              if (row.status === "done") counts.done = row.count;
              if (row.status === "error") counts.error = row.count;
            }
            const total =
              counts.pending + counts.running + counts.done + counts.error;
            return { total, ...counts };
          }),
          Effect.mapError(wrapSqlError),
        ),

      enqueueJobTargets: (
        jobId: string,
        jobType: JobType,
        mode: ScrapeMode,
        targets: Array<{ deviceId: string; externalId: string }>,
        options,
      ) =>
        sql.withTransaction(
          Effect.gen(function* () {
            const maxAttempts = options?.maxAttempts ?? 5;
            const source = options?.source ?? "kimovil";
            const dataKind = options?.dataKind ?? "specs";
            for (const target of targets) {
              const scrape = yield* scrapeRecord.createScrape({
                deviceId: target.deviceId,
                source,
                dataKind,
                externalId: target.externalId,
                url: source === "kimovil" ? `https://www.kimovil.com/en/where-to-buy-${target.externalId}` : undefined,
              });
              yield* sql`
                INSERT OR IGNORE INTO job_queue (external_id, device_id, job_id, job_type, mode, status, max_attempts, created_at, updated_at, source, data_kind, scrape_id)
                VALUES (${target.externalId}, ${target.deviceId}, ${jobId}, ${jobType}, ${mode}, 'pending', ${maxAttempts}, unixepoch(), unixepoch(), ${source}, ${dataKind}, ${scrape.id})
              `;
            }
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM job_queue WHERE job_id = ${jobId}
            `;
            return { queued: countRows[0]?.count ?? 0 };
          }),
        ).pipe(Effect.mapError((e) => {
          if (e instanceof JobQueueError) return e;
          if (e instanceof Error) return new JobQueueError(e.message);
          return wrapSqlError(e as SqlError.SqlError);
        })),

      claimNextJobQueueItem: (jobId: string, jobType?: JobType) =>
        sql.withTransaction(
          Effect.gen(function* () {
            // Select the next pending item
            const selectRows = jobType
              ? yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND job_id = ${jobId}
                    AND job_type = ${jobType}
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ORDER BY created_at ASC
                  LIMIT 1
                `
              : yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND job_id = ${jobId}
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ORDER BY created_at ASC
                  LIMIT 1
                `;

            const row = selectRows[0];
            if (!row) return null;

            // Claim it atomically within transaction
            yield* sql`
              UPDATE job_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = ${row.id} AND status = 'pending'
            `;

            const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
            if ((countRows[0]?.count ?? 0) === 0) return null;

            // Re-fetch to get fresh timestamps
            const updatedRows = yield* sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${row.id}`;
            const updatedRow = updatedRows[0];
            if (!updatedRow) return null;
            return mapQueueRow(updatedRow);
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

      claimNextByPipeline: (jobId: string, source: string, dataKind: string, jobType?: JobType) =>
        sql.withTransaction(
          Effect.gen(function* () {
            const selectRows = jobType
              ? yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND job_id = ${jobId}
                    AND job_type = ${jobType}
                    AND source = ${source}
                    AND data_kind = ${dataKind}
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ORDER BY created_at ASC
                  LIMIT 1
                `
              : yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND job_id = ${jobId}
                    AND source = ${source}
                    AND data_kind = ${dataKind}
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ORDER BY created_at ASC
                  LIMIT 1
                `;

            const row = selectRows[0];
            if (!row) return null;

            yield* sql`
              UPDATE job_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = ${row.id} AND status = 'pending'
            `;

            const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
            if ((countRows[0]?.count ?? 0) === 0) return null;

            const updatedRows = yield* sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${row.id}`;
            const updatedRow = updatedRows[0];
            if (!updatedRow) return null;
            return mapQueueRow(updatedRow);
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

      completeQueueItem: (id: number, error?: string) =>
        (error
          ? sql`
              UPDATE job_queue
              SET status = 'error',
                  completed_at = unixepoch(),
                  updated_at = unixepoch(),
                  error_message = ${error}
              WHERE id = ${id}
            `
          : sql`
              UPDATE job_queue
              SET status = 'done',
                  completed_at = unixepoch(),
                  updated_at = unixepoch()
              WHERE id = ${id}
            `
        ).pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      rescheduleQueueItem: (
        id: number,
        nextAttemptAt: number,
        error: string,
        errorCode?: string,
      ) =>
        Effect.gen(function* () {
          // Check if max attempts exceeded
          const rows = yield* sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${id}`;
          const row = rows[0];
          if (!row) return;

          if (row.attempt + 1 >= row.max_attempts) {
            // Max attempts reached, mark as error
            yield* sql`
              UPDATE job_queue
              SET status = 'error',
                  attempt = attempt + 1,
                  completed_at = unixepoch(),
                  updated_at = unixepoch(),
                  error_message = ${error},
                  last_error_code = ${errorCode ?? null}
              WHERE id = ${id}
            `;
          } else {
            // Still have retries left
            yield* sql`
              UPDATE job_queue
              SET status = 'pending',
                  attempt = attempt + 1,
                  next_attempt_at = ${nextAttemptAt},
                  updated_at = unixepoch(),
                  error_message = ${error},
                  last_error_code = ${errorCode ?? null}
              WHERE id = ${id}
            `;
          }
        }).pipe(Effect.mapError(wrapSqlError)),

      resetStuckQueueItems: (jobId: string) =>
        sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              UPDATE job_queue
              SET status = 'pending', started_at = NULL, updated_at = unixepoch()
              WHERE job_id = ${jobId} AND status = 'running'
            `;
            const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
            return countRows[0]?.count ?? 0;
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

      resetErrorQueueItems: (jobId: string) =>
        sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              UPDATE job_queue
              SET status = 'pending',
                  started_at = NULL,
                  completed_at = NULL,
                  attempt = 0,
                  next_attempt_at = NULL,
                  error_message = NULL,
                  last_error_code = NULL,
                  updated_at = unixepoch()
              WHERE job_id = ${jobId} AND status = 'error'
            `;
            const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
            return countRows[0]?.count ?? 0;
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

      getErrorQueueItems: (jobId: string, limit = 100) =>
        sql<QueueRow>`
          SELECT * FROM job_queue
          WHERE job_id = ${jobId} AND status = 'error'
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `.pipe(
          Effect.map((rows) => rows.map(mapQueueRow)),
          Effect.mapError(wrapSqlError),
        ),

      unclaimRunningItems: (jobId: string) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE job_queue
            SET status = 'pending', started_at = NULL, updated_at = unixepoch()
            WHERE job_id = ${jobId} AND status = 'running'
          `;
          const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
          return countRows[0]?.count ?? 0;
        }).pipe(Effect.mapError(wrapSqlError)),

      getTimeoutStats: (jobId: string) =>
        Effect.gen(function* () {
          const now = Math.floor(Date.now() / 1000);
          const countRows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count
            FROM job_queue
            WHERE job_id = ${jobId} AND status = 'pending'
              AND next_attempt_at IS NOT NULL AND next_attempt_at > ${now}
          `;
          const nextRows = yield* sql<{ external_id: string; next_attempt_at: number }>`
            SELECT external_id, next_attempt_at
            FROM job_queue
            WHERE job_id = ${jobId} AND status = 'pending'
              AND next_attempt_at IS NOT NULL AND next_attempt_at > ${now}
            ORDER BY next_attempt_at ASC LIMIT 1
          `;
          return {
            count: countRows[0]?.count ?? 0,
            nextRetryAt: nextRows[0]?.next_attempt_at ?? null,
            nextRetryExternalId: nextRows[0]?.external_id ?? null,
          };
        }).pipe(Effect.mapError(wrapSqlError)),

      updateJobBatchStatus: (
        jobId: string,
        batchRequestId: string,
        batchStatus: string,
      ) =>
        sql`
          UPDATE jobs SET batch_request_id = ${batchRequestId}, batch_status = ${batchStatus} WHERE id = ${jobId}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      getRunningBatchJobs: () =>
        sql<JobRow>`
          SELECT * FROM jobs
          WHERE job_type = 'process_ai'
            AND ai_mode = 'batch'
            AND status = 'running'
            AND batch_request_id IS NOT NULL
        `.pipe(
          Effect.map((rows) => rows.map(mapJobRow)),
          Effect.mapError(wrapSqlError),
        ),

      queueScrape: (
        externalId: string,
        deviceId: string,
        mode: ScrapeMode,
        options?: {
          jobId?: string | null;
          maxAttempts?: number;
          nextAttemptAt?: number | null;
          source?: string;
          dataKind?: string;
          scrapeId?: number;
        },
      ) =>
        Effect.gen(function* () {
          const jobId = options?.jobId ?? null;
          const maxAttempts = options?.maxAttempts ?? 5;
          const nextAttemptAt = options?.nextAttemptAt ?? null;
          const source = options?.source ?? "kimovil";
          const dataKind = options?.dataKind ?? "specs";
          const scrapeId = options?.scrapeId ?? null;

          if (jobId) {
            yield* sql`
              INSERT INTO job_queue (external_id, device_id, job_id, mode, status, max_attempts, next_attempt_at, created_at, updated_at, source, data_kind, scrape_id)
              VALUES (${externalId}, ${deviceId}, ${jobId}, ${mode}, 'pending', ${maxAttempts}, ${nextAttemptAt}, unixepoch(), unixepoch(), ${source}, ${dataKind}, ${scrapeId})
              ON CONFLICT(job_id, source, external_id) DO UPDATE SET
                status = 'pending',
                next_attempt_at = excluded.next_attempt_at,
                updated_at = unixepoch(),
                scrape_id = COALESCE(excluded.scrape_id, job_queue.scrape_id)
            `;
            const rows = yield* sql<QueueRow>`
              SELECT * FROM job_queue WHERE job_id = ${jobId} AND source = ${source} AND external_id = ${externalId}
            `;
            const row = rows[0];
            if (!row) {
              return yield* Effect.fail(new JobQueueError("Failed to get inserted queue item"));
            }
            return mapQueueRow(row);
          } else {
            yield* sql`
              INSERT INTO job_queue (external_id, device_id, mode, status, max_attempts, next_attempt_at, created_at, updated_at, data_kind, scrape_id)
              VALUES (${externalId}, ${deviceId}, ${mode}, 'pending', ${maxAttempts}, ${nextAttemptAt}, unixepoch(), unixepoch(), ${dataKind}, ${scrapeId})
            `;
            const rows = yield* sql<QueueRow>`
              SELECT * FROM job_queue WHERE rowid = last_insert_rowid()
            `;
            const row = rows[0];
            if (!row) {
              return yield* Effect.fail(new JobQueueError("Failed to get inserted queue item"));
            }
            return mapQueueRow(row);
          }
        }).pipe(
          Effect.mapError((e) =>
            e instanceof JobQueueError ? e : wrapSqlError(e),
          ),
        ),

      getQueueItem: (id: number) =>
        sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapQueueRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getQueueItemByTarget: (source: string, externalId: string) =>
        sql<QueueRow>`
          SELECT * FROM job_queue WHERE source = ${source} AND external_id = ${externalId} ORDER BY created_at DESC LIMIT 1
        `.pipe(
          Effect.map((rows) => (rows[0] ? mapQueueRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getQueueItems: (status?: ScrapeStatus) =>
        (status
          ? sql<QueueRow>`
              SELECT * FROM job_queue WHERE status = ${status} ORDER BY created_at DESC
            `
          : sql<QueueRow>`SELECT * FROM job_queue ORDER BY created_at DESC`
        ).pipe(
          Effect.map((rows) => rows.map(mapQueueRow)),
          Effect.mapError(wrapSqlError),
        ),

      claimNextQueueItem: (jobId?: string) =>
        sql.withTransaction(
          Effect.gen(function* () {
            // Select the next pending item
            const selectRows = jobId
              ? yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                    AND job_id = ${jobId}
                  ORDER BY created_at ASC
                  LIMIT 1
                `
              : yield* sql<QueueRow>`
                  SELECT * FROM job_queue
                  WHERE status = 'pending'
                    AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
                  ORDER BY created_at ASC
                  LIMIT 1
                `;

            const row = selectRows[0];
            if (!row) return null;

            // Claim it atomically within transaction
            yield* sql`
              UPDATE job_queue
              SET status = 'running',
                  started_at = unixepoch(),
                  updated_at = unixepoch(),
                  next_attempt_at = NULL
              WHERE id = ${row.id} AND status = 'pending'
            `;

            const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
            if ((countRows[0]?.count ?? 0) === 0) return null;

            // Re-fetch to get fresh timestamps
            const updatedRows = yield* sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${row.id}`;
            const updatedRow = updatedRows[0];
            if (!updatedRow) return null;
            return mapQueueRow(updatedRow);
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

      startQueueItem: (id: number) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE job_queue
            SET status = 'running',
                started_at = unixepoch(),
                updated_at = unixepoch(),
                next_attempt_at = NULL
            WHERE id = ${id} AND status = 'pending'
          `;
          const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
          if ((countRows[0]?.count ?? 0) === 0) {
            return yield* Effect.fail(new JobQueueError(`Failed to claim queue item ${id}: already claimed or not pending`));
          }
        }).pipe(Effect.mapError((e) => e instanceof JobQueueError ? e : wrapSqlError(e))),

      getNextPendingQueueItem: () =>
        sql<QueueRow>`
          SELECT * FROM job_queue
          WHERE status = 'pending'
            AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
          ORDER BY created_at ASC
          LIMIT 1
        `.pipe(
          Effect.map((rows) => (rows[0] ? mapQueueRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      clearScrapeData: (source: string, externalId: string) =>
        sql`DELETE FROM job_queue WHERE source = ${source} AND external_id = ${externalId}`.pipe(
          Effect.tap(() =>
            Effect.logInfo(`[JobQueue] Cleared queue data for source: ${source}, externalId: ${externalId}`),
          ),
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
