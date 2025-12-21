import { Effect, Layer, Context } from "effect";
import { createHash } from "crypto";
import { DatabaseService } from "./db";

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
  ) => Effect.Effect<void, DeviceError>;

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

export const DeviceServiceLive = Layer.effect(
  DeviceService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;

    return DeviceService.of({
      upsertDevice: (device) =>
        Effect.try({
          try: () => {
            const id = hashSlug(device.slug);
            db.prepare(
              `INSERT INTO kimovil_devices (id, slug, name, brand, is_rumor, raw, first_seen, last_seen)
               VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 name = excluded.name,
                 brand = excluded.brand,
                 is_rumor = excluded.is_rumor,
                 raw = excluded.raw,
                 last_seen = unixepoch()`,
            ).run(
              id,
              device.slug,
              device.name,
              device.brand,
              device.isRumor ? 1 : 0,
              device.raw,
            );
          },
          catch: (error) =>
            new DeviceError(
              `Failed to upsert device: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getDevice: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT * FROM kimovil_devices WHERE slug = ?`)
              .get(slug) as DeviceRow | undefined;
            if (!row) return null;
            return mapDeviceRow(row);
          },
          catch: (error) =>
            new DeviceError(
              `Failed to get device: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getDeviceCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM kimovil_devices`)
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new DeviceError(
              `Failed to get device count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAllDevices: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(`SELECT * FROM kimovil_devices ORDER BY name`)
              .all() as DeviceRow[];
            return rows.map(mapDeviceRow);
          },
          catch: (error) =>
            new DeviceError(
              `Failed to get all devices: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      enqueuePrefix: (prefix: string, depth: number) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, ?, 'pending')`,
            ).run(prefix, depth);
          },
          catch: (error) =>
            new DeviceError(
              `Failed to enqueue prefix: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getNextPendingPrefix: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT * FROM kimovil_prefix_state WHERE status = 'pending' ORDER BY depth, prefix LIMIT 1`,
              )
              .get() as
              | {
                  prefix: string;
                  depth: number;
                  status: "pending" | "done";
                  last_result_count: number | null;
                  last_run_at: number | null;
                }
              | undefined;
            if (!row) return null;
            return {
              prefix: row.prefix,
              depth: row.depth,
              status: row.status,
              lastResultCount: row.last_result_count,
              lastRunAt: row.last_run_at,
            };
          },
          catch: (error) =>
            new DeviceError(
              `Failed to get next pending prefix: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      markPrefixDone: (prefix: string, resultCount: number) =>
        Effect.try({
          try: () => {
            db.prepare(
              `UPDATE kimovil_prefix_state SET status = 'done', last_result_count = ?, last_run_at = unixepoch() WHERE prefix = ?`,
            ).run(resultCount, prefix);
          },
          catch: (error) =>
            new DeviceError(
              `Failed to mark prefix done: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getPendingPrefixCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT COUNT(*) as count FROM kimovil_prefix_state WHERE status = 'pending'`,
              )
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new DeviceError(
              `Failed to get pending prefix count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      seedInitialPrefixes: () =>
        Effect.try({
          try: () => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
            const stmt = db.prepare(
              `INSERT OR IGNORE INTO kimovil_prefix_state (prefix, depth, status) VALUES (?, 2, 'pending')`,
            );
            let count = 0;
            for (const c1 of chars) {
              for (const c2 of chars) {
                const prefix = c1 + c2;
                stmt.run(prefix);
                count++;
              }
            }
            console.log(
              `[Device] Seeded ${count} initial prefixes (2-char combos)`,
            );
          },
          catch: (error) =>
            new DeviceError(
              `Failed to seed initial prefixes: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      resetAllPrefixes: () =>
        Effect.try({
          try: () => {
            db.exec(`DELETE FROM kimovil_prefix_state`);
            console.log("[Device] Reset all prefixes");
          },
          catch: (error) =>
            new DeviceError(
              `Failed to reset prefixes: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),
    });
  }),
);
