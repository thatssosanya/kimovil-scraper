import { Effect } from "effect";
import { registerPipeline, type PipelineContext } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { PriceService } from "../../services/price";
import { EntityDataService } from "../../services/entity-data";

const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const priceService = yield* PriceService;
    const entityData = yield* EntityDataService;

    if (!ctx.externalId || !ctx.deviceId) {
      yield* Effect.logWarning("Missing externalId or deviceId").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId, deviceId: ctx.deviceId }),
      );
      return;
    }

    const modelId = parseInt(ctx.externalId, 10);
    if (isNaN(modelId)) {
      yield* Effect.logWarning("Invalid model ID").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId }),
      );
      return;
    }

    const model = yield* client.getModel(modelId);

    if (!model || model.offerCount === 0) {
      yield* Effect.logWarning("No price data from price.ru").pipe(
        Effect.annotateLogs({ modelId }),
      );
      return;
    }

    // Save raw data for debugging/replay
    yield* entityData.saveRawData({
      deviceId: ctx.deviceId,
      source: "price_ru",
      dataKind: "prices",
      scrapeId: ctx.scrapeId ?? undefined,
      data: { model, fetchedAt: Date.now() },
    });

    // Save aggregated price as synthetic offer
    const variantKey = ctx.metadata?.variant_key as string | undefined;
    yield* priceService.savePriceQuotes({
      deviceId: ctx.deviceId,
      source: "price_ru",
      externalId: ctx.externalId,
      offers: [
        {
          seller: "price.ru (aggregated)",
          priceMinorUnits: model.priceInfo.min * 100,
          currency: "RUB",
          isAvailable: true,
          variantKey,
        },
      ],
      scrapeId: ctx.scrapeId ?? undefined,
    });

    yield* priceService.updatePriceSummary(ctx.deviceId);

    yield* Effect.logInfo("Saved price.ru prices").pipe(
      Effect.annotateLogs({
        modelId,
        min: model.priceInfo.min,
        max: model.priceInfo.max,
        offerCount: model.offerCount,
      }),
    );
  });

registerPipeline({
  source: "price_ru",
  dataKind: "prices",
  stages: { scrape: scrapeHandler },
});

export {};
