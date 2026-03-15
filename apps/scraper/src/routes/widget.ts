import { Elysia } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { WidgetService } from "../services/widget";
import { YandexAffiliateService } from "../services/yandex-affiliate";
import { extractPriceFromMessageText } from "../services/telegram-monitor";
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
    .get("/deals", async ({ query, set }) => {
      const limitParam = parseInt((query.limit as string) || "6", 10);
      const limit = isNaN(limitParam) ? 6 : Math.min(Math.max(limitParam, 1), 12);
      const sort = (query.sort as string) || "newest";
      const validSorts = ["newest", "cheapest", "hottest"] as const;
      const sortOrder = validSorts.includes(sort as typeof validSorts[number])
        ? (sort as typeof validSorts[number])
        : "newest";
      const minBonus = parseInt((query.minBonus as string) || "0", 10);
      const channel = (query.channel as string) || undefined;
      const themeParam = query.theme as string | undefined;
      const theme: "light" | "dark" =
        themeParam === "dark" ? "dark" : "light";
      const layoutParam = (query.layout as string) || "vertical";
      const layout: "vertical" | "horizontal" =
        layoutParam === "horizontal" ? "horizontal" : "vertical";

      const program = Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        return yield* widgetService.getDealsWidgetHtml({
          limit,
          sort: sortOrder,
          minBonus: isNaN(minBonus) ? 0 : minBonus,
          channel,
          theme,
          layout,
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
    .get("/deals/click/:linkId", async ({ params, set }) => {
      const linkId = parseInt(params.linkId, 10);
      if (isNaN(linkId)) {
        set.status = 400;
        return "Invalid link ID";
      }

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const affiliateService = yield* YandexAffiliateService;

        // Get the link and increment click count atomically
        const rows = yield* sql<{
          resolved_url: string;
          affiliate_url: string | null;
        }>`
          UPDATE telegram_feed_item_links
          SET widget_click_count = widget_click_count + 1,
              updated_at = unixepoch()
          WHERE id = ${linkId}
            AND processing_state = 'done'
            AND is_yandex_market = 1
          RETURNING resolved_url, affiliate_url
        `;

        if (rows.length === 0) {
          return null;
        }

        const { resolved_url, affiliate_url } = rows[0];

        // Return cached affiliate URL if available
        if (affiliate_url) return affiliate_url;

        // Generate affiliate URL on-demand, cache it
        const affUrl = yield* affiliateService
          .buildBasicAffiliateUrl(resolved_url)
          .pipe(
            Effect.tap((url) =>
              sql`
                UPDATE telegram_feed_item_links
                SET affiliate_url = ${url}, updated_at = unixepoch()
                WHERE id = ${linkId}
              `.pipe(Effect.asVoid),
            ),
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("Affiliate link generation failed, using direct URL").pipe(
                  Effect.annotateLogs({ linkId, error }),
                );
                return resolved_url;
              }),
            ),
          );

        return affUrl;
      });

      const redirectUrl = await LiveRuntime.runPromise(program);

      if (!redirectUrl) {
        set.status = 404;
        return "Link not found";
      }

      set.status = 302;
      set.headers["Location"] = redirectUrl;
      set.headers["Cache-Control"] = "no-store";
      return "";
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
    })
    .post("/deals/backfill-text-prices", async () => {
      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Get all done yandex links that have no text_price yet
        const rows = yield* sql<{
          link_id: number;
          text: string | null;
          caption: string | null;
        }>`
          SELECT l.id as link_id, fi.text, fi.caption
          FROM telegram_feed_item_links l
          JOIN telegram_feed_items fi ON fi.id = l.feed_item_id
          WHERE l.processing_state = 'done'
            AND l.is_yandex_market = 1
            AND l.text_price_minor_units IS NULL
        `;

        let updated = 0;
        for (const row of rows) {
          const msgText = row.text ?? row.caption ?? null;
          const textPrice = extractPriceFromMessageText(msgText);
          if (textPrice !== null) {
            yield* sql`
              UPDATE telegram_feed_item_links
              SET text_price_minor_units = ${textPrice}, updated_at = unixepoch()
              WHERE id = ${row.link_id}
            `.pipe(Effect.asVoid);
            updated++;
          }
        }

        return { total: rows.length, updated };
      });

      const result = await LiveRuntime.runPromise(program);
      return { success: true, ...result };
    });
