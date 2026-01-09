import { Effect, Layer, Context, Data } from "effect";
import { SqlClient } from "@effect/sql";
import { WidgetDataService } from "./widget-data";
import {
  renderPriceWidget,
  renderNotFoundWidget,
  renderErrorWidget,
  ArrowVariant,
} from "./widget-render";
import { YandexAffiliateService } from "./yandex-affiliate";
import { ALLOWED_HOSTS } from "../sources/yandex_market/url-utils";

export class WidgetServiceError extends Data.TaggedError("WidgetServiceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface WidgetParams {
  slug: string;
  arrowVariant?: ArrowVariant;
  theme?: "light" | "dark";
}

interface CacheEntry {
  html: string;
  createdAt: number;
}

const CACHE_TTL_MS = 300_000; // 5 minutes
const CACHE_MAX_ENTRIES = 10_000;

export interface WidgetService {
  readonly getWidgetHtml: (
    params: WidgetParams,
  ) => Effect.Effect<string, WidgetServiceError>;
  readonly invalidateSlug: (slug: string) => Effect.Effect<void>;
  readonly invalidateAll: () => Effect.Effect<void>;
}

export const WidgetService = Context.GenericTag<WidgetService>("WidgetService");

function makeCacheKey(params: WidgetParams): string {
  const arrowVariant = params.arrowVariant ?? "neutral";
  const theme = params.theme ?? "light";
  return `${params.slug}:${arrowVariant}:${theme}`;
}

type QuoteNeedingAffiliate = {
  id: number;
  url: string;
};

export const WidgetServiceLive = Layer.effect(
  WidgetService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const widgetDataService = yield* WidgetDataService;
    const affiliateService = yield* YandexAffiliateService;

    const cache = new Map<string, CacheEntry>();
    const inflightSlugs = new Set<string>();

    // Find Yandex quotes that need affiliate links for a device
    const getQuotesNeedingAffiliateLinks = (
      deviceId: string,
    ): Effect.Effect<QuoteNeedingAffiliate[], never> =>
      sql<{ id: number; url: string }>`
        SELECT id, url FROM price_quotes
        WHERE device_id = ${deviceId}
          AND source = 'yandex_market'
          AND url IS NOT NULL
          AND (affiliate_url IS NULL OR affiliate_url = '')
          AND is_available = 1
      `.pipe(
        Effect.map((rows) =>
          rows.filter((r) => {
            try {
              const u = new URL(r.url);
              return ALLOWED_HOSTS.includes(u.hostname);
            } catch {
              return false;
            }
          }),
        ),
        Effect.catchAll(() => Effect.succeed([])),
      );

    // Background task to generate affiliate links
    // Never auto-creates creatives - uses ERID if exists, otherwise CLID-only
    const triggerAffiliateBackfill = (
      slug: string,
      deviceId: string,
      _deviceName: string,
      _imageUrl: string | null,
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        if (inflightSlugs.has(slug)) return;
        inflightSlugs.add(slug);

        const task = Effect.gen(function* () {
          const quotes = yield* getQuotesNeedingAffiliateLinks(deviceId);
          if (quotes.length === 0) return;

          yield* Effect.logInfo("Starting affiliate backfill").pipe(
            Effect.annotateLogs({ slug, deviceId, quoteCount: quotes.length }),
          );

          // Check for existing ERID (never auto-create)
          const erid = yield* affiliateService.getErid(deviceId).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );

          // Create affiliate links for each quote
          for (const quote of quotes) {
            yield* Effect.gen(function* () {
              let affiliateUrl: string;

              if (erid) {
                // Use full API with ERID
                affiliateUrl = yield* affiliateService.createAffiliateLinkWithErid({
                  url: quote.url,
                  erid,
                });
              } else {
                // Fallback to CLID-only URL (no API call)
                affiliateUrl = yield* affiliateService.buildBasicAffiliateUrl(quote.url);
              }

              yield* sql`
                UPDATE price_quotes
                SET affiliate_url = ${affiliateUrl},
                    affiliate_url_created_at = CURRENT_TIMESTAMP,
                    affiliate_error = NULL
                WHERE id = ${quote.id}
              `.pipe(Effect.asVoid);
            }).pipe(
              Effect.catchAll((error) =>
                sql`
                  UPDATE price_quotes
                  SET affiliate_error = ${error instanceof Error ? error.message : String(error)}
                  WHERE id = ${quote.id}
                `.pipe(
                  Effect.asVoid,
                  Effect.catchAll(() => Effect.void),
                ),
              ),
            );
          }

          // Invalidate cache for this slug
          for (const key of cache.keys()) {
            if (key.startsWith(`${slug}:`)) {
              cache.delete(key);
            }
          }

          yield* Effect.logInfo("Affiliate backfill completed").pipe(
            Effect.annotateLogs({ slug, deviceId, quoteCount: quotes.length, hasErid: !!erid }),
          );
        }).pipe(
          Effect.catchAll((error) =>
            Effect.logWarning("Affiliate backfill failed").pipe(
              Effect.annotateLogs({ slug, deviceId, error }),
            ),
          ),
          Effect.ensuring(
            Effect.sync(() => {
              inflightSlugs.delete(slug);
            }),
          ),
        );

        // Fire and forget
        yield* Effect.forkDaemon(task);
      });

    const evictOldestIfNeeded = () => {
      if (cache.size < CACHE_MAX_ENTRIES) return;

      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of cache) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    };

    const isExpired = (entry: CacheEntry): boolean => {
      return Date.now() - entry.createdAt > CACHE_TTL_MS;
    };

    return WidgetService.of({
      getWidgetHtml: (params) =>
        Effect.gen(function* () {
          const cacheKey = makeCacheKey(params);

          const cached = cache.get(cacheKey);
          if (cached && !isExpired(cached)) {
            return cached.html;
          }

          if (cached) {
            cache.delete(cacheKey);
          }

          const data = yield* widgetDataService
            .getWidgetData(params.slug)
            .pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning(
                    "WidgetService: failed to get widget data",
                  ).pipe(Effect.annotateLogs({ slug: params.slug, error }));
                  return null;
                }),
              ),
            );

          let html: string;

          if (data === null) {
            html = renderNotFoundWidget(params.slug);
          } else {
            // Check if we need to backfill affiliate links (fire-and-forget)
            const hasYandexPrices = data.prices.some((p) => p.source === "yandex_market");
            if (hasYandexPrices) {
              yield* triggerAffiliateBackfill(
                params.slug,
                data.device.id,
                data.device.brand
                  ? `${data.device.brand} ${data.device.name}`
                  : data.device.name,
                data.specs.image,
              );
            }

            html = renderPriceWidget(data, {
              arrowVariant: params.arrowVariant,
              theme: params.theme,
            });
          }

          evictOldestIfNeeded();
          cache.set(cacheKey, { html, createdAt: Date.now() });

          return html;
        }),

      invalidateSlug: (slug) =>
        Effect.sync(() => {
          const keysToDelete: string[] = [];
          for (const key of cache.keys()) {
            if (key.startsWith(`${slug}:`)) {
              keysToDelete.push(key);
            }
          }
          for (const key of keysToDelete) {
            cache.delete(key);
          }
        }),

      invalidateAll: () =>
        Effect.sync(() => {
          cache.clear();
        }),
    });
  }),
);
