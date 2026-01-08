import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { WidgetMappingService, type MappingStatus, WidgetMappingError } from "../services/widget-mapping";

const VALID_STATUSES = ["pending", "suggested", "auto_confirmed", "confirmed", "ignored", "needs_review"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string | undefined): s is ValidStatus {
  return s !== undefined && VALID_STATUSES.includes(s as ValidStatus);
}

function parseIntSafe(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const createWidgetMappingsRoutes = () =>
  new Elysia({ prefix: "/api/widget-mappings" })
    .get(
      "/",
      async ({ query }) => {
        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.listMappings({
            status: isValidStatus(query.status) ? (query.status as MappingStatus | "needs_review") : undefined,
            limit: parseIntSafe(query.limit, 50),
            offset: parseIntSafe(query.offset, 0),
          });
        });
        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/devices/search",
      async ({ query }) => {
        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.searchDevices(query.q || "", parseIntSafe(query.limit, 20));
        });
        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          q: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    )
    .get("/:rawModel", async ({ params }) => {
      const rawModel = decodeURIComponent(params.rawModel);
      const program = Effect.gen(function* () {
        const service = yield* WidgetMappingService;
        return yield* service.getMapping(rawModel);
      });
      return await LiveRuntime.runPromise(program);
    })
    .put(
      "/:rawModel",
      async ({ params, body, set }) => {
        const rawModel = decodeURIComponent(params.rawModel);
        
        // Validate status if provided
        if (body.status !== undefined && !["pending", "suggested", "auto_confirmed", "confirmed", "ignored"].includes(body.status)) {
          set.status = 400;
          return { error: `Invalid status: ${body.status}` };
        }
        
        const update: { deviceId?: string | null; status?: MappingStatus } = {};
        if (body.deviceId !== undefined) update.deviceId = body.deviceId;
        if (body.status !== undefined) update.status = body.status as MappingStatus;

        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.updateMapping(rawModel, update);
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          if (err instanceof WidgetMappingError && err.message.includes("not found")) {
            set.status = 404;
            return { error: err.message };
          }
          set.status = 500;
          return { error: err instanceof Error ? err.message : "Internal error" };
        }
      },
      {
        body: t.Object({
          deviceId: t.Optional(t.Union([t.String(), t.Null()])),
          status: t.Optional(t.String()),
        }),
      },
    )
    .post("/sync", async () => {
      const program = Effect.gen(function* () {
        const service = yield* WidgetMappingService;
        return yield* service.syncMappings();
      });
      return await LiveRuntime.runPromise(program);
    });
