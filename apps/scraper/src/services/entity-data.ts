import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { safeParseJson } from "./shared/json";

export class EntityDataError extends Error {
  readonly _tag = "EntityDataError";
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export interface EntityDataService {
  readonly saveRawData: (input: {
    deviceId: string;
    source: string;
    dataKind: string;
    data: unknown;
    scrapeId?: number;
  }) => Effect.Effect<void, EntityDataError>;

  readonly getRawData: (
    deviceId: string,
    source: string,
    dataKind: string,
  ) => Effect.Effect<unknown | null, EntityDataError>;

  readonly saveFinalData: (input: {
    deviceId: string;
    dataKind: string;
    data: unknown;
  }) => Effect.Effect<void, EntityDataError>;

  readonly getFinalData: (
    deviceId: string,
    dataKind: string,
  ) => Effect.Effect<unknown | null, EntityDataError>;

  readonly getDevicesNeedingProcessing: (
    source: string,
    dataKind: string,
    limit?: number,
  ) => Effect.Effect<string[], EntityDataError>;

  readonly deleteRawData: (
    deviceId: string,
    source: string,
    dataKind: string,
  ) => Effect.Effect<boolean, EntityDataError>;

  readonly deleteFinalData: (
    deviceId: string,
    dataKind: string,
  ) => Effect.Effect<boolean, EntityDataError>;
}

export const EntityDataService =
  Context.GenericTag<EntityDataService>("EntityDataService");

type RawDataRow = {
  id: number;
  device_id: string;
  source: string;
  data_kind: string;
  scrape_id: number | null;
  data: string;
  created_at: number;
  updated_at: number;
};

type FinalDataRow = {
  id: number;
  device_id: string;
  data_kind: string;
  data: string;
  created_at: number;
  updated_at: number;
};

const wrapSqlError = (error: SqlError.SqlError): EntityDataError =>
  new EntityDataError(error.message, error);

export const EntityDataServiceLive = Layer.effect(
  EntityDataService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return EntityDataService.of({
      saveRawData: (input) => {
        const dataJson = JSON.stringify(input.data);
        const scrapeId = input.scrapeId ?? null;

        return sql`
          INSERT INTO entity_data_raw (device_id, source, data_kind, scrape_id, data, created_at, updated_at)
          VALUES (${input.deviceId}, ${input.source}, ${input.dataKind}, ${scrapeId}, ${dataJson}, unixepoch(), unixepoch())
          ON CONFLICT(device_id, source, data_kind) DO UPDATE SET
            scrape_id = COALESCE(excluded.scrape_id, entity_data_raw.scrape_id),
            data = excluded.data,
            updated_at = unixepoch()
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError));
      },

      getRawData: (deviceId: string, source: string, dataKind: string) =>
        sql<RawDataRow>`
          SELECT * FROM entity_data_raw
          WHERE device_id = ${deviceId} AND source = ${source} AND data_kind = ${dataKind}
        `.pipe(
          Effect.map((rows) => {
            const row = rows[0];
            if (!row) return null;
            return safeParseJson(row.data);
          }),
          Effect.mapError(wrapSqlError),
        ),

      saveFinalData: (input) => {
        const dataJson = JSON.stringify(input.data);

        return sql`
          INSERT INTO entity_data (device_id, data_kind, data, created_at, updated_at)
          VALUES (${input.deviceId}, ${input.dataKind}, ${dataJson}, unixepoch(), unixepoch())
          ON CONFLICT(device_id, data_kind) DO UPDATE SET
            data = excluded.data,
            updated_at = unixepoch()
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError));
      },

      getFinalData: (deviceId: string, dataKind: string) =>
        sql<FinalDataRow>`
          SELECT * FROM entity_data
          WHERE device_id = ${deviceId} AND data_kind = ${dataKind}
        `.pipe(
          Effect.map((rows) => {
            const row = rows[0];
            if (!row) return null;
            return safeParseJson(row.data);
          }),
          Effect.mapError(wrapSqlError),
        ),

      getDevicesNeedingProcessing: (
        source: string,
        dataKind: string,
        limit = 100,
      ) =>
        sql<{ device_id: string }>`
          SELECT r.device_id
          FROM entity_data_raw r
          LEFT JOIN entity_data f ON r.device_id = f.device_id AND f.data_kind = ${dataKind}
          WHERE r.source = ${source} AND r.data_kind = ${dataKind} AND f.device_id IS NULL
          LIMIT ${limit}
        `.pipe(
          Effect.map((rows) => rows.map((r) => r.device_id)),
          Effect.mapError(wrapSqlError),
        ),

      deleteRawData: (deviceId: string, source: string, dataKind: string) =>
        Effect.gen(function* () {
          yield* sql`
            DELETE FROM entity_data_raw
            WHERE device_id = ${deviceId} AND source = ${source} AND data_kind = ${dataKind}
          `;
          const rows = yield* sql<{ count: number }>`SELECT changes() as count`;
          return (rows[0]?.count ?? 0) > 0;
        }).pipe(Effect.mapError(wrapSqlError)),

      deleteFinalData: (deviceId: string, dataKind: string) =>
        Effect.gen(function* () {
          yield* sql`
            DELETE FROM entity_data
            WHERE device_id = ${deviceId} AND data_kind = ${dataKind}
          `;
          const rows = yield* sql<{ count: number }>`SELECT changes() as count`;
          return (rows[0]?.count ?? 0) > 0;
        }).pipe(Effect.mapError(wrapSqlError)),
    });
  }),
);
