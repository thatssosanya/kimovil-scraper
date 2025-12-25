import { Effect, Context, Layer, Schedule } from "effect";
import { PriceRuApiError, PriceRuNetworkError, type PriceRuError } from "./errors";
import type { PriceRuConfig, PriceRuModel, SearchResult, PriceRuSearchResponse } from "./types";

const BASE_URL = "https://price.ru/v4";

export interface PriceRuClient {
  readonly searchOffers: (query: string, perPage?: number) => Effect.Effect<SearchResult, PriceRuError>;
  readonly getModel: (modelId: number) => Effect.Effect<PriceRuModel | null, PriceRuError>;
}

export const PriceRuClient = Context.GenericTag<PriceRuClient>("PriceRuClient");

// Retry only on network errors, not API errors (4xx/5xx are permanent for that request)
const retrySchedule = Schedule.exponential("500 millis").pipe(
  Schedule.intersect(Schedule.recurs(3)),
  Schedule.whileInput((e: PriceRuError) => e._tag === "PriceRuNetworkError"),
);

export const PriceRuClientLive = Layer.effect(
  PriceRuClient,
  Effect.gen(function* () {
    const config: PriceRuConfig = {
      partnerId: process.env.PRICERU_PARTNER_ID ?? "631191034",
      regionId: 1,
      categoryId: "2801",
    };

    const request = <T>(endpoint: string, options?: RequestInit): Effect.Effect<T, PriceRuError> =>
      Effect.gen(function* () {
        const res = yield* Effect.tryPromise({
          try: () =>
            fetch(`${BASE_URL}${endpoint}`, {
              ...options,
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            }),
          catch: (e) => new PriceRuNetworkError({ message: String(e), cause: e }),
        });

        if (!res.ok) {
          return yield* Effect.fail(
            new PriceRuApiError({
              status: res.status,
              message: `HTTP ${res.status}`,
              endpoint,
            }),
          );
        }

        return yield* Effect.tryPromise({
          try: () => res.json() as Promise<T>,
          catch: (e) => new PriceRuNetworkError({ message: String(e), cause: e }),
        });
      }).pipe(Effect.retry(retrySchedule));

    return PriceRuClient.of({
      searchOffers: (query, perPage = 10) =>
        request<PriceRuSearchResponse>(
          `/search/offers?region_id=${config.regionId}&category_id=${config.categoryId}&per_page=${perPage}&partner_pad_id=${config.partnerId}&ref=1`,
          { method: "POST", body: JSON.stringify({ query }) },
        ).pipe(
          Effect.map((data) => ({
            items: (data.items ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              modelId: item.model_id,
              price: item.price,
              shopName: item.shop_info?.name ?? "Unknown",
              availability: item.availability ?? "unknown",
              redirectTarget: item.redirect_target ?? "to_merchant",
            })),
            total: data.total ?? 0,
          })),
        ),

      getModel: (modelId) =>
        request<{ id?: number; name?: string; price_info?: { min?: number; max?: number; avg?: number }; offer_count?: number }>(
          `/models/${modelId}?region_id=${config.regionId}&partner_pad_id=${config.partnerId}&ref=1`,
        ).pipe(
          Effect.map((data): PriceRuModel | null =>
            data?.id
              ? {
                  id: data.id,
                  name: data.name ?? "",
                  priceInfo: {
                    min: data.price_info?.min ?? 0,
                    max: data.price_info?.max ?? 0,
                    avg: data.price_info?.avg ?? 0,
                  },
                  offerCount: data.offer_count ?? 0,
                }
              : null,
          ),
          // Only treat 404/410 as "model not found", let other errors propagate
          Effect.catchTag("PriceRuApiError", (e) =>
            e.status === 404 || e.status === 410
              ? Effect.succeed<PriceRuModel | null>(null)
              : Effect.fail(e),
          ),
        ),
    });
  }),
);
