import { Effect } from "effect";
import { registerPipeline, type PipelineContext, type PipelineResult } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { PriceService } from "../../services/price";
import { EntityDataService } from "../../services/entity-data";
import { DeviceRegistryService } from "../../services/device-registry";
import { extractVariantKey } from "./variant-utils";

const isAvailableFromPriceRu = (availability: string): boolean => {
  const v = availability.trim().toLowerCase();
  // price.ru values are not formally documented here; keep conservative defaults.
  if (v === "out_of_stock" || v === "not_available" || v === "no") return false;
  return true;
};

const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const priceService = yield* PriceService;
    const entityData = yield* EntityDataService;
    const registry = yield* DeviceRegistryService;

    if (!ctx.deviceId) {
      yield* Effect.logWarning("Missing deviceId in price.ru prices pipeline").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId }),
      );
      return { outcome: "skipped" as const, message: "No device ID provided" };
    }

    const device = yield* registry.getDeviceById(ctx.deviceId);
    if (!device) {
      yield* Effect.logWarning("Device not found for price.ru prices").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId }),
      );
      return { outcome: "skipped" as const, message: "Device not found" };
    }

    const queryFromMetadata =
      typeof ctx.metadata?.query === "string" ? (ctx.metadata.query as string) : null;
    const searchQuery = queryFromMetadata ?? device.name;

    const search = yield* client.searchOffers(searchQuery, 20).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("price.ru search failed").pipe(
            Effect.annotateLogs({ deviceId: device.id, error: error.message }),
          );
          return { items: [], total: 0 };
        }),
      ),
    );

    // Save raw data for debugging/replay
    yield* entityData.saveRawData({
      deviceId: device.id,
      source: "price_ru",
      dataKind: "prices",
      scrapeId: ctx.scrapeId ?? undefined,
      data: {
        query: searchQuery,
        search,
        fetchedAt: Date.now(),
      },
    });

    if (search.items.length === 0) {
      yield* Effect.logInfo("No price.ru offers found").pipe(
        Effect.annotateLogs({ deviceId: device.id, searchQuery }),
      );
      // Do not mark not_found here (link job handles that); this can be transient.
      return { 
        outcome: "no_offers" as const, 
        message: `Searched "${searchQuery}" — no offers available` 
      };
    }

    // Group offers by modelId so we can store `price_quotes.external_id` per model when available.
    const offersByModel = new Map<number, typeof search.items[number][]>();
    for (const offer of search.items) {
      const key = offer.modelId ?? 0;
      const arr = offersByModel.get(key);
      if (arr) arr.push(offer);
      else offersByModel.set(key, [offer]);
    }

    // Use device anchor as fallback externalId when modelId=0
    const anchorExternalId = `device:${device.id}`;

    let savedCount = 0;
    for (const [modelId, offers] of offersByModel) {
      const externalId = modelId > 0 ? String(modelId) : anchorExternalId;
      const groupName = modelId > 0 ? offers[0]?.name : undefined;
      const count = yield* priceService.savePriceQuotes({
        deviceId: device.id,
        source: "price_ru",
        externalId,
        offers: offers.map((o) => ({
          seller: o.shopName,
          priceMinorUnits: Math.round(o.price * 100),
          currency: "RUB",
          isAvailable: isAvailableFromPriceRu(o.availability),
          variantKey: extractVariantKey(o.name) ?? undefined,
          variantLabel: modelId > 0 ? groupName : o.name,
          url: o.clickUrl ?? undefined,
          offerId: String(o.id),
          redirectType: o.redirectTarget,
        })),
        scrapeId: ctx.scrapeId ?? undefined,
      });
      savedCount += count;
    }

    // Optional enrichment: if we got a catalog model_id > 0, fetch aggregated stats and store a synthetic quote.
    const bestModelId =
      Array.from(offersByModel.keys()).find((id) => id > 0) ?? null;
    if (bestModelId && bestModelId > 0) {
      const model = yield* client.getModel(bestModelId).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      );
      if (model && model.offerCount > 0 && model.priceInfo.min > 0) {
        yield* priceService.savePriceQuotes({
          deviceId: device.id,
          source: "price_ru",
          externalId: String(bestModelId),
          offers: [
            {
              seller: "price.ru (aggregated)",
              priceMinorUnits: Math.round(model.priceInfo.min * 100),
              currency: "RUB",
              isAvailable: true,
              variantKey: undefined,
            },
          ],
          scrapeId: ctx.scrapeId ?? undefined,
        });
      }
    }

    yield* priceService.updatePriceSummary(ctx.deviceId);

    yield* Effect.logInfo("Saved price.ru prices").pipe(
      Effect.annotateLogs({
        deviceId: device.id,
        searchQuery,
        offerCount: search.items.length,
        savedCount,
      }),
    );

    return { 
      outcome: "success" as const, 
      message: `Found ${search.items.length} offers, saved ${savedCount} quotes` 
    };
  });

registerPipeline({
  source: "price_ru",
  dataKind: "prices",
  stages: { scrape: scrapeHandler },
});

export {};
