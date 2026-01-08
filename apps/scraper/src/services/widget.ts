import { Effect, Layer, Context, Data } from "effect";
import { WidgetDataService } from "./widget-data";
import {
  renderPriceWidget,
  renderNotFoundWidget,
  renderErrorWidget,
  ArrowVariant,
} from "./widget-render";

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

export const WidgetServiceLive = Layer.effect(
  WidgetService,
  Effect.gen(function* () {
    const widgetDataService = yield* WidgetDataService;

    const cache = new Map<string, CacheEntry>();

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
