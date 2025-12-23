import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { JobQueueService, type JobType, type ScrapeMode } from "./job-queue";

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
  cronExpression: string;
  timezone?: string;
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

export const SchedulerServiceLive = Layer.effect(
  SchedulerService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const jobQueue = yield* JobQueueService;

    return SchedulerService.of({
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
          const jobType = input.jobType ?? "scrape";
          const mode = input.mode ?? "fast";
          const timezone = input.timezone ?? "UTC";
          const filter = input.filter ?? null;

          if (input.id !== undefined) {
            yield* sql`
              UPDATE job_schedules
              SET name = ${input.name},
                  source = ${input.source},
                  data_kind = ${input.dataKind},
                  job_type = ${jobType},
                  mode = ${mode},
                  filter = ${filter},
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
            return mapScheduleRow(row);
          }

          yield* sql`
            INSERT INTO job_schedules (name, source, data_kind, job_type, mode, filter, cron_expression, timezone, created_at, updated_at)
            VALUES (${input.name}, ${input.source}, ${input.dataKind}, ${jobType}, ${mode}, ${filter}, ${input.cronExpression}, ${timezone}, unixepoch(), unixepoch())
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
        sql`
          UPDATE job_schedules
          SET enabled = 1, updated_at = unixepoch()
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

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
        Effect.gen(function* () {
          const rows = yield* sql<ScheduleRow>`
            SELECT * FROM job_schedules WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));

          const schedule = rows[0];
          if (!schedule) {
            return yield* Effect.fail(
              new SchedulerError({ message: `Schedule ${id} not found` }),
            );
          }

          const jobId = generateJobId();
          yield* jobQueue
            .createJob({
              id: jobId,
              jobType: schedule.job_type,
              mode: schedule.mode,
              filter: schedule.filter,
              source: schedule.source,
              dataKind: schedule.data_kind,
            })
            .pipe(
              Effect.mapError(
                (e) => new SchedulerError({ message: e.message, cause: e }),
              ),
            );

          yield* sql`
            UPDATE job_schedules
            SET last_job_id = ${jobId},
                updated_at = unixepoch()
            WHERE id = ${id}
          `.pipe(Effect.mapError(wrapSqlError));

          return jobId;
        }),
    });
  }),
);
