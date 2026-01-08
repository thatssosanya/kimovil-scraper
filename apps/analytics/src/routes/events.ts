import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { EventIngestionServiceTag } from "../services/event-ingestion";
import { EventWriterServiceTag } from "../services/event-writer";

export const createEventsRoutes = () =>
  new Elysia({ prefix: "/v1/events" })
    .post(
      "/",
      async ({ body, headers, set }) => {
        const program = Effect.gen(function* () {
          const ingestion = yield* EventIngestionServiceTag;

          const result = yield* ingestion.ingest(body, {
            userAgent: headers["user-agent"] ?? "",
            source: headers["x-source"] ?? "wordpress",
            siteId: headers["x-site-id"] ?? "default",
          });

          return result;
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (e: unknown) {
          const error = e as { _tag?: string; message?: string; errors?: string[] };
          if (error._tag === "ValidationError") {
            set.status = 400;
            return {
              error: error.message,
              details: error.errors,
            };
          }
          if (error._tag === "QueueFullError") {
            set.status = 503;
            return {
              error: "Service temporarily unavailable, queue full",
            };
          }
          set.status = 500;
          return {
            error: "Internal server error",
          };
        }
      },
      {
        body: t.Object({
          events: t.Array(
            t.Object({
              event_type: t.String(),
              occurred_at: t.String(),
              session_id: t.String(),
              visitor_id: t.String(),
              page_url: t.Optional(t.String()),
              page_path: t.Optional(t.String()),
              referrer_domain: t.Optional(t.String()),
              properties: t.Record(t.String(), t.Unknown()),
            })
          ),
        }),
      }
    )
    .get("/health", async () => {
      const program = Effect.gen(function* () {
        const writer = yield* EventWriterServiceTag;
        const stats = yield* writer.getStats();
        return {
          status: "ok",
          queue: stats,
        };
      });

      return await LiveRuntime.runPromise(program);
    });
