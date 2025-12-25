import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { Cron } from "croner";
import { JobQueueService, type JobType, type ScrapeMode } from "./job-queue";
import { DeviceRegistryService } from "./device-registry";

export class SchedulerError extends Data.TaggedError("SchedulerError")<{
  message: string;
  cause?: unknown;
}> {}

export type ScheduleStatus = "success" | "error" | "skipped";

export interface JobSchedule {
  id: number;
  name: string;
  source: string;
  dataKind: string;
  jobType: JobType;
  mode: ScrapeMode;
  filter: string | null;
  enabled: boolean;
  runOnce: boolean;
  cronExpression: string;
  timezone: string;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastStatus: ScheduleStatus | null;
  lastError: string | null;
  lastJobId: string | null;
  lockedUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertScheduleInput {
  id?: number;
  name: string;
  source: string;
  dataKind: string;
  jobType?: JobType;
  mode?: ScrapeMode;
  filter?: string | null;
  runOnce?: boolean;
  cronExpression: string;
  timezone?: string;
}

export interface ScheduleRunResult {
  status: "success" | "error" | "skipped";
  error?: string;
  jobId?: string;
}

export type ScheduleRunCaller = "scheduler" | "manual";

export interface RunScheduleOnceOptions {
  caller: ScheduleRunCaller;
  claimLock?: boolean;
  lockDurationSeconds?: number;
  respectExistingLock?: boolean;
  skipIfActiveJob?: boolean;
  requireEnabled?: boolean;
  swallowInternalErrors?: boolean;
}

export interface SchedulerService {
  readonly listSchedules: () => Effect.Effect<JobSchedule[], SchedulerError>;

  readonly getSchedule: (
    id: number,
  ) => Effect.Effect<JobSchedule | null, SchedulerError>;

  readonly upsertSchedule: (
    input: UpsertScheduleInput,
  ) => Effect.Effect<JobSchedule, SchedulerError>;

  readonly enableSchedule: (id: number) => Effect.Effect<void, SchedulerError>;

  readonly disableSchedule: (id: number) => Effect.Effect<void, SchedulerError>;

  readonly deleteSchedule: (id: number) => Effect.Effect<void, SchedulerError>;

  readonly triggerNow: (id: number) => Effect.Effect<string, SchedulerError>;

  readonly getDueSchedules: () => Effect.Effect<JobSchedule[], SchedulerError>;

  readonly claimSchedule: (
    id: number,
    lockDurationSeconds: number,
  ) => Effect.Effect<boolean, SchedulerError>;

  readonly releaseSchedule: (id: number) => Effect.Effect<void, SchedulerError>;

  readonly markScheduleResult: (
    id: number,
    result: ScheduleRunResult,
  ) => Effect.Effect<void, SchedulerError>;

  readonly computeNextRun: (
    cronExpression: string,
    timezone: string,
  ) => Effect.Effect<number, SchedulerError>;

  readonly getTargetsForSchedule: (
    schedule: JobSchedule,
  ) => Effect.Effect<Array<{ deviceId: string; externalId: string }>, SchedulerError>;
}

export const SchedulerService =
  Context.GenericTag<SchedulerService>("SchedulerService");

type ScheduleRow = {
  id: number;
  name: string;
  source: string;
  data_kind: string;
  job_type: JobType;
  mode: ScrapeMode;
  filter: string | null;
  enabled: number;
  run_once: number;
  cron_expression: string;
  timezone: string;
  next_run_at: number | null;
  last_run_at: number | null;
  last_status: ScheduleStatus | null;
  last_error: string | null;
  last_job_id: string | null;
  locked_until: number | null;
  created_at: number;
  updated_at: number;
};

const mapScheduleRow = (row: ScheduleRow): JobSchedule => ({
  id: row.id,
  name: row.name,
  source: row.source,
  dataKind: row.data_kind,
  jobType: row.job_type ?? "scrape",
  mode: row.mode ?? "fast",
  filter: row.filter,
  enabled: row.enabled === 1,
  runOnce: row.run_once === 1,
  cronExpression: row.cron_expression,
  timezone: row.timezone ?? "UTC",
  nextRunAt: row.next_run_at,
  lastRunAt: row.last_run_at,
  lastStatus: row.last_status,
  lastError: row.last_error,
  lastJobId: row.last_job_id,
  lockedUntil: row.locked_until,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const wrapSqlError = (error: SqlError.SqlError): SchedulerError =>
  new SchedulerError({ message: error.message, cause: error });

const generateJobId = () =>
  `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const computeNextRunTime = (cronExpression: string, timezone: string): number => {
  const cron = new Cron(cronExpression, { timezone });
  const next = cron.nextRun();
  if (!next) throw new Error(`Invalid cron expression: ${cronExpression}`);
  return Math.floor(next.getTime() / 1000);
};

export const SchedulerServiceLive = Layer.effect(
  SchedulerService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const jobQueue = yield* JobQueueService;
    const deviceRegistry = yield* DeviceRegistryService;

    const self: SchedulerService = {
      listSchedules: () =>
        sql<ScheduleRow>`
          SELECT * FROM job_schedules ORDER BY created_at DESC
        `.pipe(
          Effect.map((rows) => rows.map(mapScheduleRow)),
          Effect.mapError(wrapSqlError),
        ),

      getSchedule: (id) =>
        sql<ScheduleRow>`
          SELECT * FROM job_schedules WHERE id = ${id}
        `.pipe(
          Effect.map((rows) => (rows[0] ? mapScheduleRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      upsertSchedule: (input) =>
        Effect.gen(function* () {
          // Validate cron expression
          yield* Effect.try({
            try: () => {
              const cron = new Cron(input.cronExpression);
              if (!cron.nextRun()) {
                throw new Error("Cron expression has no future runs");
              }
            },
            catch: (error) =>
              new SchedulerError({
                message: `Invalid cron expression: ${input.cronExpression}`,
                cause: error,
              }),
          });

          // Validate timezone if provided
          if (input.timezone) {
            yield* Effect.try({
              try: () => {
                // Test if timezone is valid by using it with Intl.DateTimeFormat
                new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
              },
              catch: () =>
                new SchedulerError({ message: `Invalid timezone: ${input.timezone}` }),
            });
          }

          // Validate filter if provided
          if (input.filter !== undefined && input.filter !== null) {
            const filterValue = input.filter;
            yield* Effect.try({
              try: () => {
                const parsed = JSON.parse(filterValue);
                if (!Array.isArray(parsed)) {
                  throw new Error("Filter must be a JSON array");
                }
                if (!parsed.every((item) => typeof item === "string")) {
                  throw new Error("Filter must be an array of strings");
                }
              },
              catch: (error) =>
                new SchedulerError({
                  message: `Invalid filter: ${error instanceof Error ? error.message : String(error)}`,
                  cause: error,
                }),
            });
          }

          const jobType = input.jobType ?? "scrape";
          const mode = input.mode ?? "fast";
          const timezone = input.timezone ?? "UTC";
          const filter = input.filter ?? null;
          const runOnce = input.runOnce ? 1 : 0;

          if (input.id !== undefined) {
            yield* sql`
              UPDATE job_schedules
              SET name = ${input.name},
                  source = ${input.source},
                  data_kind = ${input.dataKind},
                  job_type = ${jobType},
                  mode = ${mode},
                  filter = ${filter},
                  run_once = ${runOnce},
                  cron_expression = ${input.cronExpression},
                  timezone = ${timezone},
                  updated_at = unixepoch()
              WHERE id = ${input.id}
            `;

            const rows = yield* sql<ScheduleRow>`
              SELECT * FROM job_schedules WHERE id = ${input.id}
            `;
            const row = rows[0];
            if (!row) {
              return yield* Effect.fail(
                new SchedulerError({ message: `Schedule ${input.id} not found` }),
              );
            }

            // After UPDATE, check if we need to recompute next_run_at
            if (row.enabled === 1) {
              const nextRunAt = yield* Effect.try({
                try: () => computeNextRunTime(input.cronExpression, timezone),
                catch: (error) =>
                  new SchedulerError({
                    message: `Invalid cron expression: ${input.cronExpression}`,
                    cause: error,
                  }),
              });

              yield* sql`
                UPDATE job_schedules
                SET next_run_at = ${nextRunAt}, updated_at = unixepoch()
                WHERE id = ${input.id}
              `.pipe(Effect.mapError(wrapSqlError));
            }

            return mapScheduleRow(row);
          }

          yield* sql`
            INSERT INTO job_schedules (name, source, data_kind, job_type, mode, filter, run_once, cron_expression, timezone, created_at, updated_at)
            VALUES (${input.name}, ${input.source}, ${input.dataKind}, ${jobType}, ${mode}, ${filter}, ${runOnce}, ${input.cronExpression}, ${timezone}, unixepoch(), unixepoch())
          `;

          const rows = yield* sql<ScheduleRow>`
            SELECT * FROM job_schedules WHERE rowid = last_insert_rowid()
          `;
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(
              new SchedulerError({ message: "Failed to get inserted schedule" }),
            );
          }
          return mapScheduleRow(row);
        }).pipe(
          Effect.mapError((e) =>
            e instanceof SchedulerError ? e : wrapSqlError(e),
          ),
        ),

      enableSchedule: (id) =>
        Effect.gen(function* () {
          // Get schedule to compute next_run_at
          const rows = yield* sql<ScheduleRow>`
            SELECT * FROM job_schedules WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));
          
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(
              new SchedulerError({ message: `Schedule ${id} not found` }),
            );
          }

          // Compute next run time from cron expression
          const nextRunAt = yield* Effect.try({
            try: () => computeNextRunTime(row.cron_expression, row.timezone ?? "UTC"),
            catch: (error) =>
              new SchedulerError({
                message: `Invalid cron expression: ${row.cron_expression}`,
                cause: error,
              }),
          });

          yield* sql`
            UPDATE job_schedules
            SET enabled = 1, next_run_at = ${nextRunAt}, locked_until = NULL, updated_at = unixepoch()
            WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));
        }),

      disableSchedule: (id) =>
        sql`
          UPDATE job_schedules
          SET enabled = 0, updated_at = unixepoch()
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      deleteSchedule: (id) =>
        sql`
          DELETE FROM job_schedules WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      triggerNow: (id) =>
        runScheduleOnce(id, {
          caller: "manual",
          claimLock: true,
          lockDurationSeconds: 300,
          respectExistingLock: true,
          skipIfActiveJob: true,
          requireEnabled: false,
          swallowInternalErrors: false,
        }).pipe(
          Effect.flatMap((result) => {
            if (result.status === "success" && result.jobId) {
              return Effect.succeed(result.jobId);
            }
            return Effect.fail(
              new SchedulerError({
                message: result.error ?? `Schedule ${id} did not start (status=${result.status})`,
              }),
            );
          }),
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(SchedulerService, self),
              Layer.succeed(JobQueueService, jobQueue),
            ),
          ),
        ),

      getDueSchedules: () =>
        Effect.gen(function* () {
          const now = Math.floor(Date.now() / 1000);
          const rows = yield* sql<ScheduleRow>`
            SELECT * FROM job_schedules
            WHERE enabled = 1
              AND next_run_at IS NOT NULL
              AND next_run_at <= ${now}
              AND (locked_until IS NULL OR locked_until < ${now})
            ORDER BY next_run_at ASC
          `;
          return rows.map(mapScheduleRow);
        }).pipe(Effect.mapError(wrapSqlError)),

      claimSchedule: (id, lockDurationSeconds) =>
        Effect.gen(function* () {
          const now = Math.floor(Date.now() / 1000);
          const lockedUntil = now + lockDurationSeconds;
          yield* sql`
            UPDATE job_schedules
            SET locked_until = ${lockedUntil},
                updated_at = unixepoch()
            WHERE id = ${id}
              AND (locked_until IS NULL OR locked_until < ${now})
          `;
          const result = yield* sql<{ changes: number }>`SELECT changes() as changes`;
          return (result[0]?.changes ?? 0) > 0;
        }).pipe(Effect.mapError(wrapSqlError)),

      releaseSchedule: (id) =>
        sql`
          UPDATE job_schedules
          SET locked_until = NULL,
              updated_at = unixepoch()
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      markScheduleResult: (id, result) =>
        Effect.gen(function* () {
          const schedule = yield* sql<ScheduleRow>`
            SELECT * FROM job_schedules WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));
          
          const row = schedule[0];
          if (!row) {
            return yield* Effect.fail(
              new SchedulerError({ message: `Schedule ${id} not found` }),
            );
          }

          const now = Math.floor(Date.now() / 1000);
          const isRunOnce = row.run_once === 1;

          if (isRunOnce) {
            yield* sql`
              UPDATE job_schedules
              SET last_run_at = ${now},
                  last_status = ${result.status},
                  last_error = ${result.error ?? null},
                  last_job_id = ${result.jobId ?? null},
                  next_run_at = NULL,
                  enabled = 0,
                  locked_until = NULL,
                  updated_at = unixepoch()
              WHERE id = ${id}
            `.pipe(Effect.mapError(wrapSqlError));

            yield* Effect.logInfo("Schedule auto-disabled after run_once execution").pipe(
              Effect.annotateLogs({ scheduleId: id, name: row.name }),
            );
            return;
          }

          const nextRunAt = yield* Effect.try({
            try: () => computeNextRunTime(row.cron_expression, row.timezone ?? "UTC"),
            catch: (error) =>
              new SchedulerError({
                message: `Invalid cron expression in schedule ${id}: ${row.cron_expression}`,
                cause: error,
              }),
          });

          yield* sql`
            UPDATE job_schedules
            SET last_run_at = ${now},
                last_status = ${result.status},
                last_error = CASE 
                  WHEN ${result.status} = 'error' THEN ${result.error ?? null}
                  WHEN ${result.status} = 'success' THEN NULL
                  ELSE last_error
                END,
                last_job_id = COALESCE(${result.jobId ?? null}, last_job_id),
                next_run_at = ${nextRunAt},
                locked_until = NULL,
                updated_at = unixepoch()
            WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));
        }),

      computeNextRun: (cronExpression, timezone) =>
        Effect.try({
          try: () => computeNextRunTime(cronExpression, timezone),
          catch: (error) =>
            new SchedulerError({
              message: `Invalid cron expression: ${cronExpression}`,
              cause: error,
            }),
        }),

      getTargetsForSchedule: (schedule) =>
        Effect.gen(function* () {
          if (schedule.filter) {
            try {
              const parsed = JSON.parse(schedule.filter) as string[];
              if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
                const targets: Array<{ deviceId: string; externalId: string }> = [];
                for (const externalId of parsed) {
                  const rows = yield* sql<{ device_id: string }>`
                    SELECT device_id FROM device_sources 
                    WHERE source = ${schedule.source} AND external_id = ${externalId} AND status = 'active'
                    LIMIT 1
                  `.pipe(Effect.mapError(e => new SchedulerError({ message: e.message, cause: e })));
                  if (rows[0]) {
                    targets.push({ deviceId: rows[0].device_id, externalId });
                  }
                }
                return targets;
              }
            } catch {
              yield* Effect.logWarning("Invalid filter JSON in schedule").pipe(
                Effect.annotateLogs({ scheduleId: schedule.id, filter: schedule.filter }),
              );
            }
          }

          const devices = yield* deviceRegistry.getDevicesBySource(schedule.source).pipe(
            Effect.mapError(
              (e) => new SchedulerError({ message: e.message, cause: e }),
            ),
          );
          return devices.map((d) => ({ deviceId: d.deviceId, externalId: d.externalId }));
        }),
    };

    return SchedulerService.of(self);
  }),
);

export const runScheduleOnce = (
  scheduleId: number,
  options: RunScheduleOnceOptions,
): Effect.Effect<ScheduleRunResult, SchedulerError, SchedulerService | JobQueueService> =>
  Effect.gen(function* () {
    const scheduler = yield* SchedulerService;
    const jobQueue = yield* JobQueueService;

    const claimLock = options.claimLock ?? true;
    const lockDurationSeconds = options.lockDurationSeconds ?? 300;
    const respectExistingLock = options.respectExistingLock ?? true;
    const skipIfActiveJob = options.skipIfActiveJob ?? true;
    const requireEnabled = options.requireEnabled ?? (options.caller === "scheduler");
    const swallowInternalErrors = options.swallowInternalErrors ?? true;

    const schedule = yield* scheduler.getSchedule(scheduleId);
    if (!schedule) {
      return yield* Effect.fail(
        new SchedulerError({ message: `Schedule ${scheduleId} not found` }),
      );
    }

    if (requireEnabled && !schedule.enabled) {
      yield* Effect.logDebug("runScheduleOnce: schedule disabled").pipe(
        Effect.annotateLogs({ scheduleId, name: schedule.name, caller: options.caller }),
      );
      return { status: "skipped" as const };
    }

    if (claimLock) {
      const claimed = yield* scheduler.claimSchedule(scheduleId, lockDurationSeconds);
      if (respectExistingLock && !claimed) {
        yield* Effect.logDebug("runScheduleOnce: schedule already claimed").pipe(
          Effect.annotateLogs({ scheduleId, name: schedule.name, caller: options.caller }),
        );
        return { status: "skipped" as const };
      }
    }

    if (skipIfActiveJob && schedule.lastJobId) {
      const lastJob = yield* jobQueue.getJob(schedule.lastJobId).pipe(
        Effect.mapError(
          (e) => new SchedulerError({ message: e.message, cause: e }),
        ),
      );

      if (lastJob && (lastJob.status === "running" || lastJob.status === "paused" || lastJob.status === "pausing")) {
        yield* Effect.logInfo("runScheduleOnce: skipping - previous job still active").pipe(
          Effect.annotateLogs({
            scheduleId,
            name: schedule.name,
            caller: options.caller,
            lastJobId: schedule.lastJobId,
            lastJobStatus: lastJob.status,
          }),
        );
        yield* scheduler.markScheduleResult(scheduleId, { status: "skipped" });
        return { status: "skipped" as const };
      }
    }

    const result = yield* Effect.gen(function* () {
      // 1. Get targets FIRST
      const targets = yield* scheduler.getTargetsForSchedule(schedule);

      if (targets.length === 0) {
        yield* Effect.logWarning("runScheduleOnce: no targets to enqueue").pipe(
          Effect.annotateLogs({ scheduleId, name: schedule.name, caller: options.caller }),
        );
        return { status: "skipped" as const };
      }

      // 2. Only create job if we have targets
      const jobId = generateJobId();
      yield* jobQueue.createJob({
        id: jobId,
        jobType: schedule.jobType,
        mode: schedule.mode,
        filter: schedule.filter,
        source: schedule.source,
        dataKind: schedule.dataKind,
      }).pipe(
        Effect.mapError(
          (e) => new SchedulerError({ message: e.message, cause: e }),
        ),
      );

      // 3. Enqueue targets
      yield* jobQueue.enqueueJobTargets(jobId, schedule.jobType, schedule.mode, targets, {
        source: schedule.source,
        dataKind: schedule.dataKind,
      }).pipe(
        Effect.mapError(
          (e) => new SchedulerError({ message: e.message, cause: e }),
        ),
      );

      yield* Effect.logInfo("runScheduleOnce: job created and targets enqueued").pipe(
        Effect.annotateLogs({
          scheduleId,
          name: schedule.name,
          caller: options.caller,
          jobId,
          targetCount: targets.length,
        }),
      );

      return { status: "success" as const, jobId };
    }).pipe(
      Effect.catchAll((error: SchedulerError) => {
        if (swallowInternalErrors) {
          return Effect.gen(function* () {
            yield* Effect.logError("runScheduleOnce: failed to create job").pipe(
              Effect.annotateLogs({
                scheduleId,
                name: schedule.name,
                caller: options.caller,
                error,
              }),
            );
            return {
              status: "error" as const,
              error: error.message,
            };
          });
        }
        // Release lock before failing when not swallowing errors
        return Effect.gen(function* () {
          if (claimLock) {
            yield* scheduler.releaseSchedule(scheduleId);
          }
          return yield* Effect.fail(error);
        });
      }),
    );

    yield* scheduler.markScheduleResult(scheduleId, result);
    return result;
  });

export const createSchedulerLoopIteration = Effect.gen(function* () {
  const scheduler = yield* SchedulerService;

  const dueSchedules = yield* scheduler.getDueSchedules();

  if (dueSchedules.length === 0) {
    return;
  }

  yield* Effect.logInfo("Scheduler: found due schedules").pipe(
    Effect.annotateLogs({ count: dueSchedules.length }),
  );

  for (const schedule of dueSchedules) {
    yield* runScheduleOnce(schedule.id, {
      caller: "scheduler",
      claimLock: true,
      lockDurationSeconds: 300,
      respectExistingLock: true,
      skipIfActiveJob: true,
      requireEnabled: true,
      swallowInternalErrors: true,
    });
  }
});

export const runSchedulerLoop = Effect.forever(
  createSchedulerLoopIteration.pipe(
    // Use catchAllCause to handle both typed errors and defects
    Effect.catchAllCause((cause) =>
      Effect.logError("Scheduler loop error").pipe(
        Effect.annotateLogs({ cause: cause.toString() }),
      ),
    ),
    Effect.delay("10 seconds"),
  ),
);
