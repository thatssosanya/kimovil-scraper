import { Elysia } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { WidgetService } from "../services/widget";
import type { ArrowVariant } from "../services/widget-render";

const VALID_ARROW_VARIANTS = ["neutral", "up", "down", "hot", "new"] as const;
const VALID_THEMES = ["light", "dark"] as const;

export const createWidgetRoutes = () =>
  new Elysia({ prefix: "/widget/v1" })
    .get("/price/:slug", async ({ params, query, set }) => {
      const { slug } = params;
      const arrowVariantParam = query.arrowVariant as string | undefined;
      const themeParam = query.theme as string | undefined;

      const arrowVariant: ArrowVariant =
        arrowVariantParam && VALID_ARROW_VARIANTS.includes(arrowVariantParam as ArrowVariant)
          ? (arrowVariantParam as ArrowVariant)
          : "neutral";

      const theme: "light" | "dark" =
        themeParam && VALID_THEMES.includes(themeParam as "light" | "dark")
          ? (themeParam as "light" | "dark")
          : "light";

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
