import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { createHash } from "crypto";
import type { SourceStatus } from "@repo/scraper-domain";

export interface Device {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  createdAt: number;
  updatedAt: number;
  releaseDate: string | null;
}

export interface DeviceSourceLink {
  deviceId: string;
  source: string;
  externalId: string;
  url: string | null;
  status: SourceStatus;
  firstSeen: number;
  lastSeen: number;
}

export class DeviceRegistryError extends Error {
  readonly _tag = "DeviceRegistryError";
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export interface DeviceRegistryService {
  readonly getDeviceById: (
    id: string,
  ) => Effect.Effect<Device | null, DeviceRegistryError>;
  readonly getDeviceBySlug: (
    slug: string,
  ) => Effect.Effect<Device | null, DeviceRegistryError>;
  readonly lookupDevice: (
    source: string,
    externalId: string,
  ) => Effect.Effect<Device | null, DeviceRegistryError>;
  readonly createDevice: (input: {
    slug: string;
    name: string;
    brand?: string | null;
  }) => Effect.Effect<Device, DeviceRegistryError>;
  readonly linkDeviceToSource: (input: {
    deviceId: string;
    source: string;
    externalId: string;
    url?: string | null;
  }) => Effect.Effect<void, DeviceRegistryError>;
  readonly getDeviceSources: (
    deviceId: string,
  ) => Effect.Effect<DeviceSourceLink[], DeviceRegistryError>;
  readonly updateSourceStatus: (
    source: string,
    externalId: string,
    status: SourceStatus,
  ) => Effect.Effect<void, DeviceRegistryError>;
  readonly getDevicesBySource: (
    source: string,
  ) => Effect.Effect<Array<{ deviceId: string; externalId: string; slug: string }>, DeviceRegistryError>;
  readonly getAllDevices: () => Effect.Effect<Device[], DeviceRegistryError>;
  readonly getDeviceCount: () => Effect.Effect<number, DeviceRegistryError>;
}

export const DeviceRegistryService =
  Context.GenericTag<DeviceRegistryService>("DeviceRegistryService");

type DeviceRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  created_at: number;
  updated_at: number;
  release_date: string | null;
};

type DeviceSourceRow = {
  device_id: string;
  source: string;
  external_id: string;
  url: string | null;
  status: SourceStatus;
  first_seen: number;
  last_seen: number;
};

const mapDeviceRow = (row: DeviceRow): Device => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  brand: row.brand,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  releaseDate: row.release_date,
});

const mapDeviceSourceRow = (row: DeviceSourceRow): DeviceSourceLink => ({
  deviceId: row.device_id,
  source: row.source,
  externalId: row.external_id,
  url: row.url,
  status: row.status,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
});

const wrapSqlError = (error: SqlError.SqlError): DeviceRegistryError =>
  new DeviceRegistryError(error.message, error);

const generateDeviceId = (slug: string): string =>
  createHash("sha256").update(slug).digest("hex").slice(0, 16);

export const DeviceRegistryServiceLive = Layer.effect(
  DeviceRegistryService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return DeviceRegistryService.of({
      getDeviceById: (id: string) =>
        sql<DeviceRow>`SELECT * FROM devices WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapDeviceRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getDeviceBySlug: (slug: string) =>
        sql<DeviceRow>`SELECT * FROM devices WHERE slug = ${slug}`.pipe(
          Effect.map((rows) => (rows[0] ? mapDeviceRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      lookupDevice: (source: string, externalId: string) =>
        sql<DeviceRow>`
          SELECT d.* FROM devices d
          JOIN device_sources ds ON d.id = ds.device_id
          WHERE ds.source = ${source} AND ds.external_id = ${externalId}
        `.pipe(
          Effect.map((rows) => (rows[0] ? mapDeviceRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      createDevice: (input) =>
        Effect.gen(function* () {
          const id = generateDeviceId(input.slug);
          const brand = input.brand ?? null;

          yield* sql`
            INSERT INTO devices (id, slug, name, brand, created_at, updated_at)
            VALUES (${id}, ${input.slug}, ${input.name}, ${brand}, unixepoch(), unixepoch())
            ON CONFLICT(slug) DO UPDATE SET
              name = excluded.name,
              brand = COALESCE(excluded.brand, devices.brand),
              updated_at = unixepoch()
          `;

          const rows = yield* sql<DeviceRow>`SELECT * FROM devices WHERE id = ${id}`;
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(
              new DeviceRegistryError("Failed to get inserted device"),
            );
          }
          return mapDeviceRow(row);
        }).pipe(
          Effect.mapError((e) =>
            e instanceof DeviceRegistryError ? e : wrapSqlError(e),
          ),
        ),

      linkDeviceToSource: (input) =>
        sql`
          INSERT INTO device_sources (device_id, source, external_id, url, status, first_seen, last_seen)
          VALUES (${input.deviceId}, ${input.source}, ${input.externalId}, ${input.url ?? null}, 'active', unixepoch(), unixepoch())
          ON CONFLICT(source, external_id) DO UPDATE SET
            device_id = excluded.device_id,
            url = COALESCE(excluded.url, device_sources.url),
            last_seen = unixepoch()
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      getDeviceSources: (deviceId: string) =>
        sql<DeviceSourceRow>`
          SELECT * FROM device_sources WHERE device_id = ${deviceId}
        `.pipe(
          Effect.map((rows) => rows.map(mapDeviceSourceRow)),
          Effect.mapError(wrapSqlError),
        ),

      updateSourceStatus: (
        source: string,
        externalId: string,
        status: SourceStatus,
      ) =>
        sql`
          UPDATE device_sources
          SET status = ${status}, last_seen = unixepoch()
          WHERE source = ${source} AND external_id = ${externalId}
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError)),

      getDevicesBySource: (source: string) =>
        sql<{ device_id: string; external_id: string; slug: string }>`
          SELECT d.id as device_id, ds.external_id, d.slug
          FROM devices d
          JOIN device_sources ds ON d.id = ds.device_id
          WHERE ds.source = ${source} AND ds.status = 'active'
        `.pipe(
          Effect.map((rows) => rows.map((row) => ({
            deviceId: row.device_id,
            externalId: row.external_id,
            slug: row.slug,
          }))),
          Effect.mapError(wrapSqlError),
        ),

      getAllDevices: () =>
        sql<DeviceRow>`
          SELECT 
            d.id,
            d.slug,
            d.name,
            d.brand,
            d.created_at,
            d.updated_at,
            json_extract(edr.data, '$.releaseDate') as release_date
          FROM devices d
          LEFT JOIN entity_data_raw edr 
            ON d.id = edr.device_id 
            AND edr.source = 'kimovil' 
            AND edr.data_kind = 'specs'
          ORDER BY 
            CASE WHEN json_extract(edr.data, '$.releaseDate') IS NULL THEN 1 ELSE 0 END,
            json_extract(edr.data, '$.releaseDate') DESC,
            d.name
        `.pipe(
          Effect.map((rows) => rows.map(mapDeviceRow)),
          Effect.mapError(wrapSqlError),
        ),

      getDeviceCount: () =>
        sql<{ count: number }>`SELECT COUNT(*) as count FROM devices`.pipe(
          Effect.map((rows) => rows[0]?.count ?? 0),
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
