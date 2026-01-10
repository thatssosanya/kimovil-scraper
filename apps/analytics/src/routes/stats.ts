import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { EventQueryServiceTag } from "../services/event-query";
import { QueryError } from "../domain/errors";
import type { EventType } from "../domain/events";
import { ConfigService } from "../config";

class DateParseError {
  readonly _tag = "DateParseError";
  constructor(readonly message: string) {}
}

const parseDate = (str: string): Effect.Effect<Date, DateParseError> =>
  Effect.try({
    try: () => {
      const d = new Date(str);
      if (isNaN(d.getTime())) throw new Error(`Invalid date: ${str}`);
      return d;
    },
    catch: (e) => new DateParseError(e instanceof Error ? e.message : String(e)),
  });

type RouteSuccess<T> = { ok: true; data: T };
type RouteError = { ok: false; status: number; error: string };

const handleRouteError = (error: unknown): RouteError => {
  if (error instanceof DateParseError) {
    return { ok: false, status: 400, error: error.message };
  }
  if (error instanceof QueryError) {
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: false, status: 500, error: "Internal server error" };
};

let cachedApiKey: string | null | undefined;

const getApiKey = async (): Promise<string | null> => {
  if (cachedApiKey !== undefined) return cachedApiKey;
  const config = await LiveRuntime.runPromise(ConfigService);
  cachedApiKey = config.server.statsApiKey;
  return cachedApiKey;
};

export const createStatsRoutes = () =>
  new Elysia({ prefix: "/v1/stats" })
    .onBeforeHandle(async ({ request, set }) => {
      const apiKey = await getApiKey();
      if (!apiKey) return;

      const authHeader = request.headers.get("authorization") ?? "";
      const xApiKey = request.headers.get("x-api-key") ?? "";
      
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : xApiKey;

      if (token !== apiKey) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
    })
    .get(
      "/widgets",
      async ({ query, set }) => {
        const program = Effect.gen(function* () {
          const from = yield* parseDate(query.from);
          const to = yield* parseDate(query.to);
          const queryService = yield* EventQueryServiceTag;

          return yield* queryService.getWidgetStats({
            from,
            to,
            siteId: query.site_id,
            mappingId: query.mapping_id ? parseInt(query.mapping_id, 10) : undefined,
            postId: query.post_id ? parseInt(query.post_id, 10) : undefined,
            deviceSlug: query.device_slug,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
          });
        }).pipe(
          Effect.map((data) => ({ ok: true as const, data })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("Widget stats query failed").pipe(
                Effect.annotateLogs({ error })
              );
              return handleRouteError(error);
            })
          )
        );

        const result = await LiveRuntime.runPromise(program);
        if (!result.ok) {
          set.status = result.status;
          return { error: result.error };
        }
        return { data: result.data };
      },
      {
        query: t.Object({
          from: t.String(),
          to: t.String(),
          site_id: t.Optional(t.String()),
          mapping_id: t.Optional(t.String()),
          post_id: t.Optional(t.String()),
          device_slug: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/posts",
      async ({ query, set }) => {
        const program = Effect.gen(function* () {
          const from = yield* parseDate(query.from);
          const to = yield* parseDate(query.to);
          const queryService = yield* EventQueryServiceTag;

          return yield* queryService.getPostStats({
            from,
            to,
            siteId: query.site_id,
            postId: query.post_id ? parseInt(query.post_id, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
          });
        }).pipe(
          Effect.map((data) => ({ ok: true as const, data })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("Post stats query failed").pipe(
                Effect.annotateLogs({ error })
              );
              return handleRouteError(error);
            })
          )
        );

        const result = await LiveRuntime.runPromise(program);
        if (!result.ok) {
          set.status = result.status;
          return { error: result.error };
        }
        return { data: result.data };
      },
      {
        query: t.Object({
          from: t.String(),
          to: t.String(),
          site_id: t.Optional(t.String()),
          post_id: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/timeseries",
      async ({ query, set }) => {
        const program = Effect.gen(function* () {
          const from = yield* parseDate(query.from);
          const to = yield* parseDate(query.to);
          const interval = query.interval as "fifteen_minutes" | "hour" | "day" | "week" | "month";

          if (!["fifteen_minutes", "hour", "day", "week", "month"].includes(interval)) {
            return yield* Effect.fail(
              new DateParseError("Invalid interval, must be: fifteen_minutes, hour, day, week, month")
            );
          }

          const queryService = yield* EventQueryServiceTag;
          return yield* queryService.getTimeseries({
            from,
            to,
            interval,
            eventType: query.event_type as EventType | undefined,
            siteId: query.site_id,
            mappingId: query.mapping_id ? parseInt(query.mapping_id, 10) : undefined,
            postId: query.post_id ? parseInt(query.post_id, 10) : undefined,
          });
        }).pipe(
          Effect.map((data) => ({ ok: true as const, data })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("Timeseries query failed").pipe(
                Effect.annotateLogs({ error })
              );
              return handleRouteError(error);
            })
          )
        );

        const result = await LiveRuntime.runPromise(program);
        if (!result.ok) {
          set.status = result.status;
          return { error: result.error };
        }
        return { data: result.data };
      },
      {
        query: t.Object({
          from: t.String(),
          to: t.String(),
          interval: t.String(),
          event_type: t.Optional(t.String()),
          site_id: t.Optional(t.String()),
          mapping_id: t.Optional(t.String()),
          post_id: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/total",
      async ({ query, set }) => {
        const program = Effect.gen(function* () {
          const from = yield* parseDate(query.from);
          const to = yield* parseDate(query.to);
          const queryService = yield* EventQueryServiceTag;
          return yield* queryService.getTotalStats(from, to);
        }).pipe(
          Effect.map((data) => ({ ok: true as const, data })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("Total stats query failed").pipe(
                Effect.annotateLogs({ error })
              );
              return handleRouteError(error);
            })
          )
        );

        const result = await LiveRuntime.runPromise(program);
        if (!result.ok) {
          set.status = result.status;
          return { error: result.error };
        }
        return { data: result.data };
      },
      {
        query: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      }
    );
