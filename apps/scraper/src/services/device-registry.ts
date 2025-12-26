import { Effect, Layer, Context } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { generateDeviceId } from "@repo/scraper-domain/server";
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
  metadata: Record<string, unknown> | null;
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
    status?: SourceStatus;
    metadata?: Record<string, unknown> | null;
  }) => Effect.Effect<void, DeviceRegistryError>;
  readonly getSourcesByDeviceAndSource: (
    deviceId: string,
    source: string,
  ) => Effect.Effect<DeviceSourceLink[], DeviceRegistryError>;
  readonly markSourceNotFound: (input: {
    deviceId: string;
    source: string;
    searchedQuery: string;
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
  metadata: string | null;
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

const parseMetadata = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const mapDeviceSourceRow = (row: DeviceSourceRow): DeviceSourceLink => ({
  deviceId: row.device_id,
  source: row.source,
  externalId: row.external_id,
  url: row.url,
  status: row.status,
  metadata: parseMetadata(row.metadata),
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
});

const wrapSqlError = (error: SqlError.SqlError): DeviceRegistryError =>
  new DeviceRegistryError(error.message, error);

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

      linkDeviceToSource: (input) => {
        const status = input.status ?? "active";
        const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
        return sql`
          INSERT INTO device_sources (device_id, source, external_id, url, status, metadata, first_seen, last_seen)
          VALUES (${input.deviceId}, ${input.source}, ${input.externalId}, ${input.url ?? null}, ${status}, ${metadata}, unixepoch(), unixepoch())
          ON CONFLICT(source, external_id) DO UPDATE SET
            device_id = excluded.device_id,
            url = COALESCE(excluded.url, device_sources.url),
            status = excluded.status,
            metadata = COALESCE(excluded.metadata, device_sources.metadata),
            last_seen = unixepoch()
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError));
      },

      getSourcesByDeviceAndSource: (deviceId: string, source: string) =>
        sql<DeviceSourceRow>`
          SELECT * FROM device_sources WHERE device_id = ${deviceId} AND source = ${source}
        `.pipe(
          Effect.map((rows) => rows.map(mapDeviceSourceRow)),
          Effect.mapError(wrapSqlError),
        ),

      markSourceNotFound: (input) => {
        const metadata = JSON.stringify({
          searched: input.searchedQuery,
          at: Date.now(),
        });
        const syntheticExternalId = `not_found:${input.deviceId}`;
        return sql`
          INSERT INTO device_sources (device_id, source, external_id, url, status, metadata, first_seen, last_seen)
          VALUES (${input.deviceId}, ${input.source}, ${syntheticExternalId}, NULL, 'not_found', ${metadata}, unixepoch(), unixepoch())
          ON CONFLICT(source, external_id) DO UPDATE SET
            status = 'not_found',
            metadata = excluded.metadata,
            last_seen = unixepoch()
        `.pipe(Effect.asVoid, Effect.mapError(wrapSqlError));
      },

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
            id,
            slug,
            name,
            brand,
            created_at,
            updated_at,
            release_date
          FROM devices
          ORDER BY 
            CASE WHEN release_date IS NULL THEN 1 ELSE 0 END,
            release_date DESC,
            name
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
