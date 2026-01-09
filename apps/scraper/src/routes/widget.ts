import { Elysia } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { WidgetService } from "../services/widget";
import { renderNotFoundWidget, type ArrowVariant } from "../services/widget-render";

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

export const createWidgetRoutes = () =>
  new Elysia({ prefix: "/widget/v1" })
    .get("/price", async ({ query, set }) => {
      const model = query.model as string | undefined;
      if (!model) {
        set.status = 400;
        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return renderNotFoundWidget("missing model parameter");
      }

      const { arrowVariant, theme } = parseWidgetParams(query);

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const widgetService = yield* WidgetService;

        // O(1) lookup: raw_model → slug (single query with JOIN)
        const result = yield* sql<{ slug: string }>`
          SELECT d.slug FROM widget_model_mappings m
          JOIN devices d ON d.id = m.device_id
          WHERE m.source = 'wordpress' AND m.raw_model = ${model}
            AND m.status IN ('confirmed', 'auto_confirmed')
          LIMIT 1
        `;

        if (result.length === 0) {
          return renderNotFoundWidget(model);
        }

        return yield* widgetService.getWidgetHtml({
          slug: result[0].slug,
          arrowVariant,
          theme,
        });
      });

      const html = await LiveRuntime.runPromise(program);

      set.headers["Content-Type"] = "text/html; charset=utf-8";
      set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400";

      return html;
    })
    .get("/price/:slug", async ({ params, query, set }) => {
      const { slug } = params;
      const { arrowVariant, theme } = parseWidgetParams(query);

      const program = Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        return yield* widgetService.getWidgetHtml({ slug, arrowVariant, theme });
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
