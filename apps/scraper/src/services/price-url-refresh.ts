import { Effect, Layer, Context, SynchronizedRef, Duration } from "effect";
import { PriceService } from "./price";
import { PriceRuClient } from "../sources/price_ru/client";
import type { SearchResult } from "../sources/price_ru/types";

// Config constants
const STALE_THRESHOLD_SECS = 300; // 5 minutes - consider URLs stale after this
const MIN_REFRESH_INTERVAL_SECS = 120; // 2 minutes - prevent API spam
const MAX_JITTER_MS = 30_000; // 0-30s random delay to avoid thundering herd
const NETWORK_TIMEOUT_MS = 15_000; // 15 seconds timeout on network call

export interface PriceUrlRefreshService {
  readonly triggerRefreshIfStale: (params: {
    deviceId: string;
    deviceSlug: string;
    onCacheInvalidate?: () => Effect.Effect<void>;
  }) => Effect.Effect<void>;
}

export const PriceUrlRefreshService = Context.GenericTag<PriceUrlRefreshService>("PriceUrlRefreshService");

export const PriceUrlRefreshServiceLive = Layer.effect(
  PriceUrlRefreshService,
  Effect.gen(function* () {
    const priceService = yield* PriceService;
    const priceRuClient = yield* PriceRuClient;

    // In-flight guard: track devices currently being refreshed in this process
    const inflightRef = yield* SynchronizedRef.make(new Set<string>());

    const removeFromInflight = (deviceId: string): Effect.Effect<void> =>
      SynchronizedRef.update(inflightRef, (set) => {
        const newSet = new Set(set);
        newSet.delete(deviceId);
        return newSet;
      });

    return PriceUrlRefreshService.of({
      triggerRefreshIfStale: ({ deviceId, deviceSlug, onCacheInvalidate }) =>
        Effect.gen(function* () {
          // Check if device has price_ru prices
          const hasPrices = yield* priceService.hasPriceRuPrices(deviceId).pipe(
            Effect.catchAll(() => Effect.succeed(false)),
          );

          if (!hasPrices) return;

          // Atomic in-flight check + add
          const claimed = yield* SynchronizedRef.modifyEffect(inflightRef, (set: Set<string>) => {
            if (set.has(deviceId)) {
              return Effect.succeed([false, set] as const);
            }
            const newSet = new Set(set);
            newSet.add(deviceId);
            return Effect.succeed([true, newSet] as const);
          });

          if (!claimed) return;

          // Fork the actual refresh work as a daemon
          const task = Effect.gen(function* () {
            // Try to claim in DB (cross-process dedupe) - do this BEFORE jitter
            const dbClaimed = yield* priceService.claimUrlRefresh({
              deviceId,
              staleThresholdSecs: STALE_THRESHOLD_SECS,
              minIntervalSecs: MIN_REFRESH_INTERVAL_SECS,
            }).pipe(
              Effect.catchAll(() => Effect.succeed(false)),
            );

            if (!dbClaimed) {
              yield* Effect.logDebug("price.ru URL refresh skipped (already claimed)").pipe(
                Effect.annotateLogs({ deviceId, deviceSlug }),
              );
              return;
            }

            // Add random jitter AFTER claim to avoid thundering herd on API
            const jitterMs = Math.floor(Math.random() * MAX_JITTER_MS);
            yield* Effect.sleep(Duration.millis(jitterMs));

            yield* Effect.logInfo("price.ru URL refresh starting").pipe(
              Effect.annotateLogs({ deviceId, deviceSlug }),
            );

            // Get search query for this device
            const query = yield* priceService.getSearchQueryForDevice(deviceId).pipe(
              Effect.catchAll(() => Effect.succeed(null)),
            );

            if (!query) {
              yield* Effect.logWarning("price.ru URL refresh: no search query found").pipe(
                Effect.annotateLogs({ deviceId, deviceSlug }),
              );
              // Don't clear started_at - let min-interval backoff apply to prevent hot-looping
              return;
            }

            // Fetch fresh offers from price.ru API with timeout
            const searchResult: SearchResult = yield* priceRuClient
              .searchOffers(query, 20)
              .pipe(Effect.timeoutFail({
                duration: Duration.millis(NETWORK_TIMEOUT_MS),
                onTimeout: () => new Error("Timeout"),
              }));

            // Map to the format expected by updatePriceRuUrls
            const offers = searchResult.items.map((item) => ({
              offerId: String(item.id),
              clickUrl: item.clickUrl ?? null,
              isAvailable: item.availability !== "not_available",
            }));

            // Update URLs in DB (transaction)
            const result = yield* priceService.updatePriceRuUrls({ deviceId, offers });

            yield* Effect.logInfo("price.ru URL refresh completed").pipe(
              Effect.annotateLogs({
                deviceId,
                deviceSlug,
                updated: result.updated,
                unavailable: result.unavailable,
                freshOffers: offers.length,
              }),
            );

            // Invalidate widget cache if something changed
            if ((result.updated > 0 || result.unavailable > 0) && onCacheInvalidate) {
              yield* onCacheInvalidate().pipe(
                Effect.catchAllCause((cause) =>
                  Effect.logWarning("price.ru URL refresh: cache invalidation failed").pipe(
                    Effect.annotateLogs({ deviceId, deviceSlug, cause }),
                  ),
                ),
              );
            }
          }).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logWarning("price.ru URL refresh failed").pipe(
                Effect.annotateLogs({ deviceId, deviceSlug, cause }),
              ),
            ),
            Effect.ensuring(removeFromInflight(deviceId)),
          );

          yield* Effect.forkDaemon(task);
        }),
    });
  }),
);
