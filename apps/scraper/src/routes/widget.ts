import { Elysia } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { WidgetService } from "../services/widget";
import {
  renderNotFoundWidget,
  type ArrowVariant,
  type WidgetTrackingContext,
} from "../services/widget-render";

const VALID_ARROW_VARIANTS = ["neutral", "up", "down", "hot", "new"] as const;
const VALID_THEMES = ["light", "dark"] as const;

function parseWidgetParams(query: Record<string, string | undefined>) {
  const arrowVariantParam = query.arrowVariant;
  const themeParam = query.theme;

  const arrowVariant: ArrowVariant =
    arrowVariantParam && VALID_ARROW_VARIANTS.includes(arrowVariantParam as ArrowVariant)
      ? (arrowVariantParam as ArrowVariant)
      : "neutral";

  const theme: "light" | "dark" =
    themeParam && VALID_THEMES.includes(themeParam as "light" | "dark")
      ? (themeParam as "light" | "dark")
      : "light";

  return { arrowVariant, theme };
}

function parsePostIdHeader(headers: Record<string, string | undefined>): number | undefined {
  const postIdStr = headers["x-post-id"];
  if (!postIdStr) return undefined;
  const parsed = parseInt(postIdStr, 10);
  return isNaN(parsed) ? undefined : parsed;
}

export const createWidgetRoutes = () =>
  new Elysia({ prefix: "/widget/v1" })
    .get("/price", async ({ query, set, headers }) => {
      const model = query.model as string | undefined;
      if (!model) {
        set.status = 400;
        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return renderNotFoundWidget("missing model parameter");
      }

      const { arrowVariant, theme } = parseWidgetParams(query);
      const postId = parsePostIdHeader(headers as Record<string, string | undefined>);

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const widgetService = yield* WidgetService;

        // O(1) lookup: raw_model → slug + mapping_id (single query with JOIN)
        const result = yield* sql<{ slug: string; mapping_id: number }>`
          SELECT d.slug, m.id as mapping_id FROM widget_model_mappings m
          JOIN devices d ON d.id = m.device_id
          WHERE m.source = 'wordpress' AND m.raw_model = ${model}
            AND m.status IN ('confirmed', 'auto_confirmed')
          LIMIT 1
        `;

        if (result.length === 0) {
          const tracking: WidgetTrackingContext = {
            postId,
            rawModel: model,
          };
          return renderNotFoundWidget(model, { tracking });
        }

        const tracking: WidgetTrackingContext = {
          mappingId: result[0].mapping_id,
          postId,
          rawModel: model,
        };

        return yield* widgetService.getWidgetHtml({
          slug: result[0].slug,
          arrowVariant,
          theme,
          tracking,
        });
      });

      const html = await LiveRuntime.runPromise(program);

      set.headers["Content-Type"] = "text/html; charset=utf-8";
      set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400";

      return html;
    })
    .get("/price/:slug", async ({ params, query, set, headers }) => {
      const { slug } = params;
      const { arrowVariant, theme } = parseWidgetParams(query);
      const postId = parsePostIdHeader(headers as Record<string, string | undefined>);

      // Optional: pass mappingId via query param for direct slug access
      const mappingIdParam = query.mappingId as string | undefined;
      const mappingId = mappingIdParam ? parseInt(mappingIdParam, 10) : undefined;

      const tracking: WidgetTrackingContext | undefined =
        postId || mappingId ? { postId, mappingId: mappingId && !isNaN(mappingId) ? mappingId : undefined } : undefined;

      const program = Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        return yield* widgetService.getWidgetHtml({ slug, arrowVariant, theme, tracking });
      });

      const html = await LiveRuntime.runPromise(program);

      set.headers["Content-Type"] = "text/html; charset=utf-8";
      set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400";

      return html;
    })
    .post("/invalidate/:slug", async ({ params }) => {
      const { slug } = params;

      const program = Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        yield* widgetService.invalidateSlug(slug);
      });

      await LiveRuntime.runPromise(program);

      return { success: true, slug };
    })
    .post("/invalidate", async () => {
      const program = Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        yield* widgetService.invalidateAll();
      });

      await LiveRuntime.runPromise(program);

      return { success: true, message: "All widget caches invalidated" };
    });
