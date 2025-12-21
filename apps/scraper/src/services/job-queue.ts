import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

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
  nextRetrySlug: string | null;
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

  readonly enqueueJobSlugs: (
    jobId: string,
    jobType: JobType,
    mode: ScrapeMode,
    slugs: string[],
    maxAttempts?: number,
  ) => Effect.Effect<{ queued: number }, JobQueueError>;

  readonly claimNextJobQueueItem: (
    jobId: string,
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
    slug: string,
    mode: ScrapeMode,
    options?: {
      jobId?: string | null;
      maxAttempts?: number;
      nextAttemptAt?: number | null;
    },
  ) => Effect.Effect<JobQueueItem, JobQueueError>;

  readonly getQueueItem: (
    id: number,
  ) => Effect.Effect<JobQueueItem | null, JobQueueError>;

  readonly getQueueItemBySlug: (
    slug: string,
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
    slug: string,
  ) => Effect.Effect<void, JobQueueError>;
}

export const JobQueueService =
  Context.GenericTag<JobQueueService>("JobQueueService");

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

const wrapSqlError = (error: SqlError.SqlError): JobQueueError =>
  new JobQueueError(error.message);

export const JobQueueServiceLive = Layer.effect(
  JobQueueService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return JobQueueService.of({
      createJob: (input) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO jobs (id, job_type, mode, ai_mode, status, filter, created_at, total_count, queued_count)
            VALUES (${input.id}, ${input.jobType}, ${input.mode}, ${input.aiMode ?? null}, 'pending', ${input.filter ?? null}, unixepoch(), ${input.totalCount ?? null}, ${input.queuedCount ?? null})
          `;
          const rows = yield* sql<JobRow>`SELECT * FROM jobs WHERE id = ${input.id}`;
          const row = rows[0];
          if (!row) throw new Error("Failed to get inserted job");
          return mapJobRow(row);
        }).pipe(Effect.mapError(wrapSqlError)),

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

      enqueueJobSlugs: (
        jobId: string,
        jobType: JobType,
        mode: ScrapeMode,
        slugs: string[],
        maxAttempts = 5,
      ) =>
        sql.withTransaction(
          Effect.gen(function* () {
            for (const slug of slugs) {
              yield* sql`
                INSERT OR IGNORE INTO job_queue (slug, job_id, job_type, mode, status, max_attempts, created_at, updated_at)
                VALUES (${slug}, ${jobId}, ${jobType}, ${mode}, 'pending', ${maxAttempts}, unixepoch(), unixepoch())
              `;
            }
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM job_queue WHERE job_id = ${jobId}
            `;
            return { queued: countRows[0]?.count ?? 0 };
          }),
        ).pipe(Effect.mapError(wrapSqlError)),

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

            return mapQueueRow({ ...row, status: "running" });
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
        sql`
          UPDATE job_queue
          SET status = 'pending',
              attempt = attempt + 1,
              next_attempt_at = ${nextAttemptAt},
              updated_at = unixepoch(),
              error_message = ${error},
              last_error_code = ${errorCode ?? null}
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      resetStuckQueueItems: (jobId: string) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE job_queue
            SET status = 'pending', started_at = NULL, updated_at = unixepoch()
            WHERE job_id = ${jobId} AND status = 'running'
          `;
          const countRows = yield* sql<{ count: number }>`SELECT changes() as count`;
          return countRows[0]?.count ?? 0;
        }).pipe(Effect.mapError(wrapSqlError)),

      resetErrorQueueItems: (jobId: string) =>
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
        }).pipe(Effect.mapError(wrapSqlError)),

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
          const nextRows = yield* sql<{ slug: string; next_attempt_at: number }>`
            SELECT slug, next_attempt_at
            FROM job_queue
            WHERE job_id = ${jobId} AND status = 'pending'
              AND next_attempt_at IS NOT NULL AND next_attempt_at > ${now}
            ORDER BY next_attempt_at ASC LIMIT 1
          `;
          return {
            count: countRows[0]?.count ?? 0,
            nextRetryAt: nextRows[0]?.next_attempt_at ?? null,
            nextRetrySlug: nextRows[0]?.slug ?? null,
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
        slug: string,
        mode: ScrapeMode,
        options?: {
          jobId?: string | null;
          maxAttempts?: number;
          nextAttemptAt?: number | null;
        },
      ) =>
        Effect.gen(function* () {
          const jobId = options?.jobId ?? null;
          const maxAttempts = options?.maxAttempts ?? 5;
          const nextAttemptAt = options?.nextAttemptAt ?? null;

          if (jobId) {
            yield* sql`
              INSERT INTO job_queue (slug, job_id, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
              VALUES (${slug}, ${jobId}, ${mode}, 'pending', ${maxAttempts}, ${nextAttemptAt}, unixepoch(), unixepoch())
              ON CONFLICT(job_id, slug) DO UPDATE SET
                status = 'pending',
                next_attempt_at = excluded.next_attempt_at,
                updated_at = unixepoch()
            `;
            const rows = yield* sql<QueueRow>`
              SELECT * FROM job_queue WHERE job_id = ${jobId} AND slug = ${slug}
            `;
            const row = rows[0];
            if (!row) throw new Error("Failed to get inserted queue item");
            return mapQueueRow(row);
          } else {
            yield* sql`
              INSERT INTO job_queue (slug, mode, status, max_attempts, next_attempt_at, created_at, updated_at)
              VALUES (${slug}, ${mode}, 'pending', ${maxAttempts}, ${nextAttemptAt}, unixepoch(), unixepoch())
            `;
            const rows = yield* sql<QueueRow>`
              SELECT * FROM job_queue WHERE rowid = last_insert_rowid()
            `;
            const row = rows[0];
            if (!row) throw new Error("Failed to get inserted queue item");
            return mapQueueRow(row);
          }
        }).pipe(Effect.mapError(wrapSqlError)),

      getQueueItem: (id: number) =>
        sql<QueueRow>`SELECT * FROM job_queue WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapQueueRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getQueueItemBySlug: (slug: string) =>
        sql<QueueRow>`
          SELECT * FROM job_queue WHERE slug = ${slug} ORDER BY created_at DESC LIMIT 1
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

            return mapQueueRow({ ...row, status: "running" });
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
            throw new JobQueueError(`Failed to claim queue item ${id}: already claimed or not pending`);
          }
        }).pipe(Effect.mapError(wrapSqlError)),

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

      clearScrapeData: (slug: string) =>
        sql`DELETE FROM job_queue WHERE slug = ${slug}`.pipe(
          Effect.tap(() =>
            Effect.logInfo(`[JobQueue] Cleared queue data for slug: ${slug}`),
          ),
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
