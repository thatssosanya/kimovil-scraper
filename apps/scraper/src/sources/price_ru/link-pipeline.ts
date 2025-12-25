import { Effect } from "effect";
import { registerPipeline, type PipelineContext } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { DeviceRegistryService } from "../../services/device-registry";
import { extractVariantKey } from "./variant-utils";

const MAX_VARIANTS_PER_DEVICE = 10;

const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const registry = yield* DeviceRegistryService;

    if (!ctx.deviceId) {
      yield* Effect.logWarning("No deviceId in context, skipping link");
      return;
    }

    const device = yield* registry.getDeviceById(ctx.deviceId);
    if (!device) {
      yield* Effect.logWarning("Device not found").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId }),
      );
      return;
    }

    const searchQuery = device.name;
    const result = yield* client.searchOffers(searchQuery, 20).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("price.ru search failed").pipe(
            Effect.annotateLogs({ deviceId: ctx.deviceId, error: error.message }),
          );
          return { items: [], total: 0 };
        }),
      ),
    );

    if (result.items.length === 0) {
      yield* registry.markSourceNotFound({
        deviceId: ctx.deviceId,
        source: "price_ru",
        searchedQuery: searchQuery,
      });
      yield* Effect.logInfo("No price.ru matches found").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId, searchQuery }),
      );
      return;
    }

    // Deduplicate by modelId
    const seenModels = new Set<number>();
    const uniqueOffers = result.items.filter((o) => {
      if (seenModels.has(o.modelId)) return false;
      seenModels.add(o.modelId);
      return true;
    });

    // Link each unique model (up to MAX_VARIANTS_PER_DEVICE)
    let linkedCount = 0;
    for (const offer of uniqueOffers.slice(0, MAX_VARIANTS_PER_DEVICE)) {
      const variantKey = extractVariantKey(offer.name);
      yield* registry.linkDeviceToSource({
        deviceId: ctx.deviceId,
        source: "price_ru",
        externalId: String(offer.modelId),
        status: "active",
        metadata: {
          variant_key: variantKey,
          name: offer.name,
          linked_at: Date.now(),
        },
      });
      linkedCount++;
    }

    yield* Effect.logInfo("Linked to price.ru").pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId, count: linkedCount }),
    );
  });

registerPipeline({
  source: "price_ru",
  dataKind: "price_links",
  stages: { scrape: scrapeHandler },
});

export {};
