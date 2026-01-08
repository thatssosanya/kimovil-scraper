import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { EventQueryServiceTag } from "../services/event-query";
import { QueryError } from "../domain/errors";
import type { EventType } from "../domain/events";

function parseDate(str: string): Date {
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${str}`);
  }
  return d;
}

export const createStatsRoutes = () =>
  new Elysia({ prefix: "/v1/stats" })
    .get(
      "/widgets",
      async ({ query, set }) => {
        try {
          const from = parseDate(query.from);
          const to = parseDate(query.to);

          const program = Effect.gen(function* () {
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
          });

          const data = await LiveRuntime.runPromise(program);
          return { data };
        } catch (e) {
          set.status = e instanceof QueryError ? 500 : 400;
          return { error: e instanceof Error ? e.message : "Invalid request" };
        }
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
        try {
          const from = parseDate(query.from);
          const to = parseDate(query.to);

          const program = Effect.gen(function* () {
            const queryService = yield* EventQueryServiceTag;
            return yield* queryService.getPostStats({
              from,
              to,
              siteId: query.site_id,
              postId: query.post_id ? parseInt(query.post_id, 10) : undefined,
              limit: query.limit ? parseInt(query.limit, 10) : undefined,
            });
          });

          const data = await LiveRuntime.runPromise(program);
          return { data };
        } catch (e) {
          set.status = e instanceof QueryError ? 500 : 400;
          return { error: e instanceof Error ? e.message : "Invalid request" };
        }
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
        try {
          const from = parseDate(query.from);
          const to = parseDate(query.to);
          const interval = query.interval as "hour" | "day" | "week" | "month";

          if (!["hour", "day", "week", "month"].includes(interval)) {
            set.status = 400;
            return { error: "Invalid interval, must be: hour, day, week, month" };
          }

          const program = Effect.gen(function* () {
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
          });

          const data = await LiveRuntime.runPromise(program);
          return { data };
        } catch (e) {
          set.status = e instanceof QueryError ? 500 : 400;
          return { error: e instanceof Error ? e.message : "Invalid request" };
        }
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
        try {
          const from = parseDate(query.from);
          const to = parseDate(query.to);

          const program = Effect.gen(function* () {
            const queryService = yield* EventQueryServiceTag;
            return yield* queryService.getTotalStats(from, to);
          });

          const data = await LiveRuntime.runPromise(program);
          return { data };
        } catch (e) {
          set.status = e instanceof QueryError ? 500 : 400;
          return { error: e instanceof Error ? e.message : "Invalid request" };
        }
      },
      {
        query: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      }
    );
