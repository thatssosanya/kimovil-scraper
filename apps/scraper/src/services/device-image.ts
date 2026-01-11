import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

export class DeviceImageError extends Data.TaggedError("DeviceImageError")<{
  message: string;
  cause?: unknown;
}> {}

export interface DeviceImage {
  id: number;
  deviceId: string;
  source: string;
  url: string;
  position: number;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertImageInput {
  deviceId: string;
  source: string;
  url: string;
  position?: number;
  isPrimary?: boolean;
}

export interface DeviceImageService {
  readonly upsertImage: (input: UpsertImageInput) => Effect.Effect<void, DeviceImageError>;
  readonly upsertImages: (
    deviceId: string,
    source: string,
    images: { url: string; position: number; isPrimary: boolean }[],
  ) => Effect.Effect<number, DeviceImageError>;
  readonly getImages: (deviceId: string, source?: string) => Effect.Effect<DeviceImage[], DeviceImageError>;
  readonly deleteImages: (deviceId: string, source: string) => Effect.Effect<number, DeviceImageError>;
}

export const DeviceImageService = Context.GenericTag<DeviceImageService>("DeviceImageService");

type DeviceImageRow = {
  id: number;
  device_id: string;
  source: string;
  url: string;
  position: number;
  is_primary: number;
  created_at: number;
  updated_at: number;
};

const wrapSqlError = (error: SqlError.SqlError): DeviceImageError =>
  new DeviceImageError({ message: error.message, cause: error });

const rowToDeviceImage = (row: DeviceImageRow): DeviceImage => ({
  id: row.id,
  deviceId: row.device_id,
  source: row.source,
  url: row.url,
  position: row.position,
  isPrimary: row.is_primary === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const DeviceImageServiceLive = Layer.effect(
  DeviceImageService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return DeviceImageService.of({
      upsertImage: (input) =>
        sql`
          INSERT INTO device_images (device_id, source, url, position, is_primary)
          VALUES (${input.deviceId}, ${input.source}, ${input.url}, ${input.position ?? 0}, ${input.isPrimary ? 1 : 0})
          ON CONFLICT(device_id, source, url) DO UPDATE SET
            position = excluded.position,
            is_primary = excluded.is_primary,
            updated_at = unixepoch()
        `.pipe(
          Effect.asVoid,
          Effect.tapError((e) =>
            Effect.logWarning("DeviceImageService.upsertImage failed").pipe(
              Effect.annotateLogs({ deviceId: input.deviceId, source: input.source, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),

      upsertImages: (deviceId, source, images) =>
        sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`
              DELETE FROM device_images
              WHERE device_id = ${deviceId} AND source = ${source}
            `;

            for (const img of images) {
              yield* sql`
                INSERT INTO device_images (device_id, source, url, position, is_primary)
                VALUES (${deviceId}, ${source}, ${img.url}, ${img.position}, ${img.isPrimary ? 1 : 0})
              `;
            }

            return images.length;
          }),
        ).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("DeviceImageService.upsertImages failed").pipe(
              Effect.annotateLogs({ deviceId, source, count: images.length, error: e }),
            ),
          ),
          Effect.mapError((e) => (e instanceof DeviceImageError ? e : wrapSqlError(e))),
        ),

      getImages: (deviceId, source) => {
        const query = source
          ? sql<DeviceImageRow>`
              SELECT * FROM device_images
              WHERE device_id = ${deviceId} AND source = ${source}
              ORDER BY position ASC
            `
          : sql<DeviceImageRow>`
              SELECT * FROM device_images
              WHERE device_id = ${deviceId}
              ORDER BY position ASC
            `;

        return query.pipe(
          Effect.map((rows) => rows.map(rowToDeviceImage)),
          Effect.tapError((e) =>
            Effect.logWarning("DeviceImageService.getImages failed").pipe(
              Effect.annotateLogs({ deviceId, source, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        );
      },

      deleteImages: (deviceId, source) =>
        sql`
          DELETE FROM device_images
          WHERE device_id = ${deviceId} AND source = ${source}
        `.pipe(
          Effect.flatMap(() =>
            sql<{ changes: number }>`SELECT changes() as changes`.pipe(
              Effect.map((rows) => rows[0]?.changes ?? 0),
            ),
          ),
          Effect.tapError((e) =>
            Effect.logWarning("DeviceImageService.deleteImages failed").pipe(
              Effect.annotateLogs({ deviceId, source, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
