import { Effect, Layer, Context, Schema } from "effect";
import { SqlClient } from "@effect/sql";
import { safeStringify } from "../utils/safe-stringify";
import { DeviceRegistryService } from "./device-registry";
import { EntityDataService } from "./entity-data";

export class PhoneDataError extends Error {
  readonly _tag = "PhoneDataError";
  cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
  }
}

export interface PhoneDataService {
  readonly saveRaw: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;

  readonly getRaw: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;

  readonly hasRaw: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly getRawCount: () => Effect.Effect<number, PhoneDataError>;

  readonly getRawBulk: (
    slugs: string[],
  ) => Effect.Effect<
    Array<{ slug: string; data: Record<string, unknown> }>,
    PhoneDataError
  >;

  readonly save: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;

  readonly get: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;

  readonly has: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly getCount: () => Effect.Effect<number, PhoneDataError>;

  readonly getSlugsNeedingExtraction: () => Effect.Effect<
    string[],
    PhoneDataError
  >;

  readonly getSlugsNeedingAi: () => Effect.Effect<string[], PhoneDataError>;

  readonly getRawDataSlugs: () => Effect.Effect<string[], PhoneDataError>;

  readonly getAiDataSlugs: () => Effect.Effect<string[], PhoneDataError>;

  readonly deleteRaw: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly delete: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly saveRawWithEntity: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;

  readonly saveWithEntity: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;
}

export const PhoneDataService =
  Context.GenericTag<PhoneDataService>("PhoneDataService");

const mapError = (error: unknown): PhoneDataError => {
  if (error instanceof PhoneDataError) return error;
  const wrapped = new PhoneDataError(
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? { cause: error } : undefined,
  );
  return wrapped;
};

const RawPhoneRowSchema = Schema.Struct({
  slug: Schema.String,
  data: Schema.String,
  created_at: Schema.Number,
  updated_at: Schema.Number,
});

const PhoneRowSchema = Schema.Struct({
  slug: Schema.String,
  data: Schema.String,
  created_at: Schema.Number,
  updated_at: Schema.Number,
});

export const PhoneDataServiceLive = Layer.effect(
  PhoneDataService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const deviceRegistry = yield* DeviceRegistryService;
    const entityData = yield* EntityDataService;

    const quarantineRow = (
      slug: string,
      sourceTable: string,
      data: unknown,
      error: string,
    ) =>
      sql`
        INSERT INTO quarantine (slug, source_table, data, error)
        VALUES (${slug}, ${sourceTable}, ${safeStringify(data)}, ${error})
      `.pipe(Effect.ignore);

    return PhoneDataService.of({
      saveRaw: (slug: string, data: Record<string, unknown>) =>
        sql`
          INSERT INTO phone_data_raw (slug, data, created_at, updated_at)
          VALUES (${slug}, ${JSON.stringify(data)}, unixepoch(), unixepoch())
          ON CONFLICT(slug) DO UPDATE SET
            data = excluded.data,
            updated_at = unixepoch()
        `.pipe(
          Effect.asVoid,
          Effect.mapError(mapError),
        ),

      getRaw: (slug: string) =>
        Effect.gen(function* () {
          const rows = yield* sql`SELECT slug, data, created_at, updated_at FROM phone_data_raw WHERE slug = ${slug}`;
          if (rows.length === 0) return null;
          const row = rows[0];
          const decoded = yield* Schema.decodeUnknown(RawPhoneRowSchema)(row).pipe(
            Effect.catchTag("ParseError", (e) =>
              quarantineRow(slug, "phone_data_raw", row, e.message).pipe(
                Effect.as(null),
              ),
            ),
          );
          if (!decoded) return null;
          const parsed = yield* Effect.try({
            try: () => JSON.parse(decoded.data) as Record<string, unknown>,
            catch: (e) => new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`),
          }).pipe(
            Effect.catchAll((e) =>
              quarantineRow(slug, "phone_data_raw", decoded.data, e.message).pipe(
                Effect.as(null),
              ),
            ),
          );
          return parsed;
        }).pipe(Effect.mapError(mapError)),

      hasRaw: (slug: string) =>
        sql`SELECT 1 FROM phone_data_raw WHERE slug = ${slug} LIMIT 1`.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError(mapError),
        ),

      getRawCount: () =>
        sql`SELECT COUNT(*) as count FROM phone_data_raw`.pipe(
          Effect.map((rows) => (rows[0] as { count: number })?.count ?? 0),
          Effect.mapError(mapError),
        ),

      getRawBulk: (slugs: string[]) =>
        Effect.gen(function* () {
          if (slugs.length === 0) return [];
          const rows = yield* sql`SELECT slug, data, created_at, updated_at FROM phone_data_raw WHERE slug IN ${sql.in(slugs)}`;
          const results: Array<{ slug: string; data: Record<string, unknown> }> = [];
          for (const row of rows) {
            const decoded = yield* Schema.decodeUnknown(RawPhoneRowSchema)(row).pipe(
              Effect.catchTag("ParseError", (e) =>
                quarantineRow((row as { slug: string }).slug, "phone_data_raw", row, e.message).pipe(
                  Effect.as(null),
                ),
              ),
            );
            if (decoded) {
              try {
                const data = JSON.parse(decoded.data) as Record<string, unknown>;
                results.push({ slug: decoded.slug, data });
              } catch (e) {
                yield* quarantineRow(
                  decoded.slug,
                  "phone_data_raw",
                  decoded.data,
                  `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
                );
              }
            }
          }
          return results;
        }).pipe(Effect.mapError(mapError)),

      save: (slug: string, data: Record<string, unknown>) =>
        sql`
          INSERT INTO phone_data (slug, data, created_at, updated_at)
          VALUES (${slug}, ${JSON.stringify(data)}, unixepoch(), unixepoch())
          ON CONFLICT(slug) DO UPDATE SET
            data = excluded.data,
            updated_at = unixepoch()
        `.pipe(
          Effect.asVoid,
          Effect.mapError(mapError),
        ),

      get: (slug: string) =>
        Effect.gen(function* () {
          const rows = yield* sql`SELECT slug, data, created_at, updated_at FROM phone_data WHERE slug = ${slug}`;
          if (rows.length === 0) return null;
          const row = rows[0];
          const decoded = yield* Schema.decodeUnknown(PhoneRowSchema)(row).pipe(
            Effect.catchTag("ParseError", (e) =>
              quarantineRow(slug, "phone_data", row, e.message).pipe(
                Effect.as(null),
              ),
            ),
          );
          if (!decoded) return null;
          const parsed = yield* Effect.try({
            try: () => JSON.parse(decoded.data) as Record<string, unknown>,
            catch: (e) => new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`),
          }).pipe(
            Effect.catchAll((e) =>
              quarantineRow(slug, "phone_data", decoded.data, e.message).pipe(
                Effect.as(null),
              ),
            ),
          );
          return parsed;
        }).pipe(Effect.mapError(mapError)),

      has: (slug: string) =>
        sql`SELECT 1 FROM phone_data WHERE slug = ${slug} LIMIT 1`.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError(mapError),
        ),

      getCount: () =>
        sql`SELECT COUNT(*) as count FROM phone_data`.pipe(
          Effect.map((rows) => (rows[0] as { count: number })?.count ?? 0),
          Effect.mapError(mapError),
        ),

      getSlugsNeedingExtraction: () =>
        sql`
          SELECT r.slug FROM raw_html r
          LEFT JOIN phone_data_raw p ON r.slug = p.slug
          WHERE p.slug IS NULL
        `.pipe(
          Effect.map((rows) => rows.map((r) => (r as { slug: string }).slug)),
          Effect.mapError(mapError),
        ),

      getSlugsNeedingAi: () =>
        sql`
          SELECT r.slug FROM phone_data_raw r
          LEFT JOIN phone_data p ON r.slug = p.slug
          WHERE p.slug IS NULL
        `.pipe(
          Effect.map((rows) => rows.map((r) => (r as { slug: string }).slug)),
          Effect.mapError(mapError),
        ),

      getRawDataSlugs: () =>
        sql`SELECT slug FROM phone_data_raw`.pipe(
          Effect.map((rows) => rows.map((r) => (r as { slug: string }).slug)),
          Effect.mapError(mapError),
        ),

      getAiDataSlugs: () =>
        sql`SELECT slug FROM phone_data`.pipe(
          Effect.map((rows) => rows.map((r) => (r as { slug: string }).slug)),
          Effect.mapError(mapError),
        ),

      deleteRaw: (slug: string) =>
        sql`DELETE FROM phone_data_raw WHERE slug = ${slug}`.pipe(
          Effect.flatMap(() => sql`SELECT changes() as count`),
          Effect.map((rows) => ((rows[0] as { count: number })?.count ?? 0) > 0),
          Effect.mapError(mapError),
        ),

      delete: (slug: string) =>
        sql`DELETE FROM phone_data WHERE slug = ${slug}`.pipe(
          Effect.flatMap(() => sql`SELECT changes() as count`),
          Effect.map((rows) => ((rows[0] as { count: number })?.count ?? 0) > 0),
          Effect.mapError(mapError),
        ),

      saveRawWithEntity: (slug: string, data: Record<string, unknown>) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO phone_data_raw (slug, data, created_at, updated_at)
            VALUES (${slug}, ${JSON.stringify(data)}, unixepoch(), unixepoch())
            ON CONFLICT(slug) DO UPDATE SET
              data = excluded.data,
              updated_at = unixepoch()
          `;

          const device = yield* deviceRegistry.getDeviceBySlug(slug).pipe(
            Effect.catchAll((error) =>
              Effect.logWarning("Device lookup failed").pipe(
                Effect.annotateLogs({ slug, error }),
                Effect.map(() => null),
              ),
            ),
          );
          if (device) {
            yield* entityData
              .saveRawData({
                deviceId: device.id,
                source: "kimovil",
                dataKind: "specs",
                data,
              })
              .pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning("Entity raw data sync failed").pipe(
                    Effect.annotateLogs({ slug, deviceId: device.id, error }),
                  ),
                ),
              );
          }
        }).pipe(Effect.asVoid, Effect.mapError(mapError)),

      saveWithEntity: (slug: string, data: Record<string, unknown>) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO phone_data (slug, data, created_at, updated_at)
            VALUES (${slug}, ${JSON.stringify(data)}, unixepoch(), unixepoch())
            ON CONFLICT(slug) DO UPDATE SET
              data = excluded.data,
              updated_at = unixepoch()
          `;

          const device = yield* deviceRegistry.getDeviceBySlug(slug).pipe(
            Effect.catchAll((error) =>
              Effect.logWarning("Device lookup failed").pipe(
                Effect.annotateLogs({ slug, error }),
                Effect.map(() => null),
              ),
            ),
          );
          if (device) {
            yield* entityData
              .saveFinalData({
                deviceId: device.id,
                dataKind: "specs",
                data,
              })
              .pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning("Entity final data sync failed").pipe(
                    Effect.annotateLogs({ slug, deviceId: device.id, error }),
                  ),
                ),
              );
          }
        }).pipe(Effect.asVoid, Effect.mapError(mapError)),
    });
  }),
);
