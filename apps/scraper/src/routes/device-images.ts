import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { DeviceImageService, DeviceImageError } from "../services/device-image";

export const createDeviceImagesRoutes = () =>
  new Elysia({ prefix: "/api/devices" })
    .get(
      "/:deviceId/images",
      async ({ params, query }) => {
        const program = Effect.gen(function* () {
          const service = yield* DeviceImageService;
          return yield* service.getImages(params.deviceId, query.source);
        });
        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          source: t.Optional(t.String()),
        }),
      },
    )
    .put(
      "/:deviceId/images/:imageId/primary",
      async ({ params, set }) => {
        const imageId = parseInt(params.imageId, 10);
        if (Number.isNaN(imageId)) {
          set.status = 400;
          return { error: "Invalid imageId" };
        }

        const program = Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* DeviceImageService;

          yield* sql.withTransaction(
            Effect.gen(function* () {
              // Verify the image exists and belongs to this device
              const existing = yield* sql<{ id: number }>`
                SELECT id FROM device_images
                WHERE id = ${imageId} AND device_id = ${params.deviceId}
              `;

              if (existing.length === 0) {
                return yield* Effect.fail(
                  new DeviceImageError({ message: "Image not found for device" }),
                );
              }

              // Clear previous primary for this device
              yield* sql`
                UPDATE device_images SET is_primary = 0
                WHERE device_id = ${params.deviceId}
              `.pipe(Effect.asVoid);

              // Set new primary (scoped to device for safety)
              yield* sql`
                UPDATE device_images SET is_primary = 1
                WHERE id = ${imageId} AND device_id = ${params.deviceId}
              `.pipe(Effect.asVoid);
            }),
          );

          return yield* service.getImages(params.deviceId);
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("Failed to set primary image").pipe(
              Effect.annotateLogs({ deviceId: params.deviceId, imageId, error: e }),
            ),
          ),
        );

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          if (err instanceof DeviceImageError) {
            const isNotFound = err.message.includes("not found");
            set.status = isNotFound ? 404 : 500;
            return { error: err.message };
          }
          set.status = 500;
          return { error: err instanceof Error ? err.message : "Internal error" };
        }
      },
    );
