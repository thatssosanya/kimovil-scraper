import { Effect, Layer, Context } from "effect";
import { SqlClient } from "@effect/sql";

export interface DiscoveryQuery {
  source: string;
  query: string;
  depth: number;
  status: "pending" | "done";
  resultCount: number | null;
  completedAt: number | null;
  createdAt: number;
}

export class DeviceDiscoveryError extends Error {
  readonly _tag = "DeviceDiscoveryError";
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
  }
}

export interface DeviceDiscoveryService {
  readonly enqueueQuery: (
    source: string,
    query: string,
    depth: number,
  ) => Effect.Effect<void, DeviceDiscoveryError>;

  readonly getNextPendingQuery: (
    source: string,
  ) => Effect.Effect<DiscoveryQuery | null, DeviceDiscoveryError>;

  readonly completeQuery: (
    source: string,
    query: string,
    resultCount: number,
  ) => Effect.Effect<boolean, DeviceDiscoveryError>;

  readonly getPendingCount: (
    source: string,
  ) => Effect.Effect<number, DeviceDiscoveryError>;

  readonly resetQueries: (
    source: string,
  ) => Effect.Effect<void, DeviceDiscoveryError>;
}

export const DeviceDiscoveryService =
  Context.GenericTag<DeviceDiscoveryService>("DeviceDiscoveryService");

type DiscoveryQueryRow = {
  source: string;
  query: string;
  depth: number;
  status: "pending" | "done";
  last_result_count: number | null;
  last_run_at: number | null;
  created_at: number;
};

const mapRow = (row: DiscoveryQueryRow): DiscoveryQuery => ({
  source: row.source,
  query: row.query,
  depth: row.depth,
  status: row.status,
  resultCount: row.last_result_count,
  completedAt: row.last_run_at,
  createdAt: row.created_at,
});

const wrapError =
  (message: string) =>
  (error: unknown): DeviceDiscoveryError =>
    new DeviceDiscoveryError(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );

export const DeviceDiscoveryServiceLive = Layer.effect(
  DeviceDiscoveryService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return DeviceDiscoveryService.of({
      enqueueQuery: (source: string, query: string, depth: number) =>
        sql`
          INSERT OR IGNORE INTO discovery_queue (source, query, depth, status, created_at)
          VALUES (${source}, ${query}, ${depth}, 'pending', unixepoch())
        `.pipe(
          Effect.asVoid,
          Effect.mapError(wrapError("Failed to enqueue query")),
        ),

      getNextPendingQuery: (source: string) =>
        Effect.gen(function* () {
          const rows = yield* sql<DiscoveryQueryRow>`
            SELECT * FROM discovery_queue 
            WHERE source = ${source} AND status = 'pending' 
            ORDER BY depth, query 
            LIMIT 1
          `;
          if (rows.length === 0) return null;
          return mapRow(rows[0]!);
        }).pipe(Effect.mapError(wrapError("Failed to get next pending query"))),

      completeQuery: (source: string, query: string, resultCount: number) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE discovery_queue 
            SET status = 'done', last_result_count = ${resultCount}, last_run_at = unixepoch()
            WHERE source = ${source} AND query = ${query} AND status = 'pending'
          `;
          const result = yield* sql<{ count: number }>`SELECT changes() as count`;
          return result[0]?.count === 1;
        }).pipe(Effect.mapError(wrapError("Failed to complete query"))),

      getPendingCount: (source: string) =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM discovery_queue 
            WHERE source = ${source} AND status = 'pending'
          `;
          return rows[0]?.count ?? 0;
        }).pipe(Effect.mapError(wrapError("Failed to get pending count"))),

      resetQueries: (source: string) =>
        Effect.gen(function* () {
          yield* sql`DELETE FROM discovery_queue WHERE source = ${source}`;
          yield* Effect.logInfo("Reset discovery queries").pipe(
            Effect.annotateLogs({ service: "DeviceDiscovery", source }),
          );
        }).pipe(
          Effect.asVoid,
          Effect.mapError(wrapError("Failed to reset queries")),
        ),
    });
  }),
);
