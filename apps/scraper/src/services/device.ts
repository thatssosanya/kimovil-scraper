import { Effect, Layer, Context } from "effect";
import { createHash } from "crypto";
import { SqlClient } from "@effect/sql";

export interface KimovilDevice {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  isRumor: boolean;
  raw: string;
  firstSeen: number;
  lastSeen: number;
}

export interface KimovilPrefixState {
  prefix: string;
  depth: number;
  status: "pending" | "done";
  lastResultCount: number | null;
  lastRunAt: number | null;
}

export class DeviceError extends Error {
  readonly _tag = "DeviceError";
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
  }
}

export interface DeviceService {
  readonly upsertDevice: (device: {
    slug: string;
    name: string;
    brand: string | null;
    isRumor: boolean;
    raw: string;
  }) => Effect.Effect<void, DeviceError>;

  readonly getDevice: (
    slug: string,
  ) => Effect.Effect<KimovilDevice | null, DeviceError>;

  readonly getDeviceCount: () => Effect.Effect<number, DeviceError>;

  readonly getAllDevices: () => Effect.Effect<KimovilDevice[], DeviceError>;

  readonly enqueuePrefix: (
    prefix: string,
    depth: number,
  ) => Effect.Effect<void, DeviceError>;

  readonly getNextPendingPrefix: () => Effect.Effect<
    KimovilPrefixState | null,
    DeviceError
  >;

  readonly markPrefixDone: (
    prefix: string,
    resultCount: number,
  ) => Effect.Effect<boolean, DeviceError>;

  readonly getPendingPrefixCount: () => Effect.Effect<number, DeviceError>;

  readonly seedInitialPrefixes: () => Effect.Effect<void, DeviceError>;

  readonly resetAllPrefixes: () => Effect.Effect<void, DeviceError>;
}

export const DeviceService = Context.GenericTag<DeviceService>("DeviceService");

const hashSlug = (slug: string): string => {
  return createHash("sha256").update(slug).digest("hex").slice(0, 16);
};

type DeviceRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  is_rumor: number;
  raw: string;
  first_seen: number;
  last_seen: number;
};

type PrefixRow = {
  prefix: string;
  depth: number;
  status: "pending" | "done";
  last_result_count: number | null;
  last_run_at: number | null;
};

const mapDeviceRow = (row: DeviceRow): KimovilDevice => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  brand: row.brand,
  isRumor: row.is_rumor === 1,
  raw: row.raw,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
});

const mapPrefixRow = (row: PrefixRow): KimovilPrefixState => ({
  prefix: row.prefix,
  depth: row.depth,
  status: row.status,
  lastResultCount: row.last_result_count,
  lastRunAt: row.last_run_at,
});

const wrapError =
  (message: string) =>
  (error: unknown): DeviceError =>
    new DeviceError(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );

export const DeviceServiceLive = Layer.effect(
  DeviceService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return DeviceService.of({
      upsertDevice: (device) =>
        Effect.gen(function* () {
          const id = hashSlug(device.slug);
          const isRumor = device.isRumor ? 1 : 0;
          yield* sql`
            INSERT INTO kimovil_devices (id, slug, name, brand, is_rumor, raw, first_seen, last_seen)
            VALUES (${id}, ${device.slug}, ${device.name}, ${device.brand}, ${isRumor}, ${device.raw}, unixepoch(), unixepoch())
            ON CONFLICT(slug) DO UPDATE SET
              name = excluded.name,
              brand = excluded.brand,
              is_rumor = excluded.is_rumor,
              raw = excluded.raw,
              last_seen = unixepoch()
          `;
        }).pipe(Effect.asVoid, Effect.mapError(wrapError("Failed to upsert device"))),

      getDevice: (slug: string) =>
        Effect.gen(function* () {
          const rows = yield* sql<DeviceRow>`
            SELECT * FROM kimovil_devices WHERE slug = ${slug}
          `;
          if (rows.length === 0) return null;
          return mapDeviceRow(rows[0]!);
        }).pipe(Effect.mapError(wrapError("Failed to get device"))),

      getDeviceCount: () =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM kimovil_devices
          `;
          return rows[0]?.count ?? 0;
        }).pipe(Effect.mapError(wrapError("Failed to get device count"))),

      getAllDevices: () =>
        Effect.gen(function* () {
          const rows = yield* sql<DeviceRow>`
            SELECT * FROM kimovil_devices ORDER BY name
          `;
          return rows.map(mapDeviceRow);
        }).pipe(Effect.mapError(wrapError("Failed to get all devices"))),

      enqueuePrefix: (prefix: string, depth: number) =>
        sql`
          INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (${prefix}, ${depth}, 'pending')
        `.pipe(Effect.asVoid, Effect.mapError(wrapError("Failed to enqueue prefix"))),

      getNextPendingPrefix: () =>
        Effect.gen(function* () {
          const rows = yield* sql<PrefixRow>`
            SELECT * FROM kimovil_prefix_state WHERE status = 'pending' ORDER BY depth, prefix LIMIT 1
          `;
          if (rows.length === 0) return null;
          return mapPrefixRow(rows[0]!);
        }).pipe(Effect.mapError(wrapError("Failed to get next pending prefix"))),

      markPrefixDone: (prefix: string, resultCount: number) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE kimovil_prefix_state 
            SET status = 'done', last_result_count = ${resultCount}, last_run_at = unixepoch()
            WHERE prefix = ${prefix} AND status = 'pending'
          `;
          const result = yield* sql<{ count: number }>`SELECT changes() as count`;
          return result[0]?.count === 1;
        }).pipe(Effect.mapError(wrapError("Failed to mark prefix done"))),

      getPendingPrefixCount: () =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM kimovil_prefix_state WHERE status = 'pending'
          `;
          return rows[0]?.count ?? 0;
        }).pipe(Effect.mapError(wrapError("Failed to get pending prefix count"))),

      seedInitialPrefixes: () =>
        Effect.gen(function* () {
          const chars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
          let count = 0;
          for (const c1 of chars) {
            for (const c2 of chars) {
              const prefix = c1 + c2;
              yield* sql`
                INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (${prefix}, 2, 'pending')
              `;
              count++;
            }
          }
          yield* Effect.logInfo(`Seeded ${count} initial prefixes (2-char combos)`).pipe(
            Effect.annotateLogs({ service: "Device" }),
          );
        }).pipe(Effect.asVoid, Effect.mapError(wrapError("Failed to seed initial prefixes"))),

      resetAllPrefixes: () =>
        Effect.gen(function* () {
          yield* sql`DELETE FROM kimovil_prefix_state`;
          yield* Effect.logInfo("Reset all prefixes").pipe(
            Effect.annotateLogs({ service: "Device" }),
          );
        }).pipe(Effect.asVoid, Effect.mapError(wrapError("Failed to reset prefixes"))),
    });
  }),
);
