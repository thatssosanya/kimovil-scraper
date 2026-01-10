import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { EventIngestionServiceTag } from "../services/event-ingestion";
import { EventWriterServiceTag } from "../services/event-writer";
import { ConfigService } from "../config";

const ALLOWED_INGESTION_HOSTS = new Set([
  "click-or-die.ru",
  "www.click-or-die.ru",
  "click-or-die.test",
  "localhost",
]);

const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ALLOWED_INGESTION_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

export const createEventsRoutes = () =>
  new Elysia({ prefix: "/v1/events" })
    .post(
      "/",
      async ({ body, headers, set, request }) => {
        const origin = request.headers.get("origin");
        const referer = request.headers.get("referer");
        
        if (!isOriginAllowed(origin) && !isOriginAllowed(referer)) {
          set.status = 403;
          return { error: "Forbidden: invalid origin" };
        }
        const program = Effect.gen(function* () {
          const ingestion = yield* EventIngestionServiceTag;

          const result = yield* ingestion.ingest(body, {
            userAgent: headers["user-agent"] ?? "",
            source: headers["x-source"] ?? "wordpress",
            siteId: headers["x-site-id"] ?? "default",
          });

          return result;
        });

        const handled = program.pipe(
          Effect.map((result) => ({ ok: true as const, result })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("Failed to process events").pipe(
                Effect.annotateLogs({ error })
              );
              
              if (error._tag === "ValidationError") {
                set.status = 400;
                return { ok: false as const, response: { error: error.message, details: error.errors } };
              }
              if (error._tag === "QueueFullError") {
                set.status = 503;
                return { ok: false as const, response: { error: "Service temporarily unavailable, queue full" } };
              }
              set.status = 500;
              return { ok: false as const, response: { error: "Internal server error" } };
            })
          )
        );

        const outcome = await LiveRuntime.runPromise(handled);
        return outcome.ok ? outcome.result : outcome.response;
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
