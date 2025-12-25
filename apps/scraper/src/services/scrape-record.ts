import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import type { ScrapeStatus } from "@repo/scraper-domain";

export interface Scrape {
  id: number;
  deviceId: string | null;
  source: string;
  dataKind: string;
  externalId: string;
  url: string | null;
  requestedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  status: ScrapeStatus;
  errorMessage: string | null;
}

export class ScrapeRecordError extends Error {
  readonly _tag = "ScrapeRecordError";
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export interface ScrapeRecordService {
  readonly createScrape: (input: {
    deviceId?: string;
    source: string;
    dataKind: string;
    externalId: string;
    url?: string;
  }) => Effect.Effect<Scrape, ScrapeRecordError>;

  readonly startScrape: (id: number) => Effect.Effect<void, ScrapeRecordError>;
  readonly completeScrape: (
    id: number,
  ) => Effect.Effect<void, ScrapeRecordError>;
  readonly failScrape: (
    id: number,
    error: string,
  ) => Effect.Effect<void, ScrapeRecordError>;

  readonly getScrape: (
    id: number,
  ) => Effect.Effect<Scrape | null, ScrapeRecordError>;
  readonly getLatestScrape: (
    source: string,
    externalId: string,
    dataKind: string,
  ) => Effect.Effect<Scrape | null, ScrapeRecordError>;
}

export const ScrapeRecordService =
  Context.GenericTag<ScrapeRecordService>("ScrapeRecordService");

type ScrapeRow = {
  id: number;
  device_id: string | null;
  source: string;
  data_kind: string;
  external_id: string;
  url: string | null;
  requested_at: number;
  started_at: number | null;
  completed_at: number | null;
  status: ScrapeStatus;
  error_message: string | null;
};

const mapScrapeRow = (row: ScrapeRow): Scrape => ({
  id: row.id,
  deviceId: row.device_id,
  source: row.source,
  dataKind: row.data_kind,
  externalId: row.external_id,
  url: row.url,
  requestedAt: row.requested_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  status: row.status,
  errorMessage: row.error_message,
});

const wrapSqlError = (error: SqlError.SqlError): ScrapeRecordError =>
  new ScrapeRecordError(error.message, error);

export const ScrapeRecordServiceLive = Layer.effect(
  ScrapeRecordService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return ScrapeRecordService.of({
      createScrape: (input) =>
        Effect.gen(function* () {
          const deviceId = input.deviceId ?? null;
          const url = input.url ?? null;

          yield* sql`
            INSERT INTO scrapes (device_id, source, data_kind, external_id, url, requested_at, status)
            VALUES (${deviceId}, ${input.source}, ${input.dataKind}, ${input.externalId}, ${url}, unixepoch(), 'pending')
          `;

          const rows = yield* sql<ScrapeRow>`
            SELECT * FROM scrapes WHERE rowid = last_insert_rowid()
          `;
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(
              new ScrapeRecordError("Failed to get inserted scrape"),
            );
          }
          return mapScrapeRow(row);
        }).pipe(
          Effect.mapError((e) =>
            e instanceof ScrapeRecordError ? e : wrapSqlError(e),
          ),
        ),

      startScrape: (id: number) =>
        sql`
          UPDATE scrapes
          SET status = 'running', started_at = unixepoch()
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      completeScrape: (id: number) =>
        sql`
          UPDATE scrapes
          SET status = 'done', completed_at = unixepoch()
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      failScrape: (id: number, error: string) =>
        sql`
          UPDATE scrapes
          SET status = 'error', completed_at = unixepoch(), error_message = ${error}
          WHERE id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      getScrape: (id: number) =>
        sql<ScrapeRow>`SELECT * FROM scrapes WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapScrapeRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getLatestScrape: (source: string, externalId: string, dataKind: string) =>
        sql<ScrapeRow>`
          SELECT * FROM scrapes
          WHERE source = ${source}
            AND external_id = ${externalId}
            AND data_kind = ${dataKind}
            AND status = 'done'
          ORDER BY completed_at DESC
          LIMIT 1
        `.pipe(
          Effect.map((rows) => (rows[0] ? mapScrapeRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
