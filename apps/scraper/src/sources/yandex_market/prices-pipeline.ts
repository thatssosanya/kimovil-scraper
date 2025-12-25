import { Effect } from "effect";
import {
  registerPipeline,
  type PipelineContext,
} from "../../pipeline/registry";
import { parseYandexPrices } from "./extractor";
import { HtmlCacheService } from "../../services/html-cache";
import { PriceService } from "../../services/price";
import { EntityDataService } from "../../services/entity-data";

/**
 * Yandex price scraping is user-driven via the `yandex.scrape` WebSocket handler,
 * not batch-processed through the job queue. This is because:
 * 1. Yandex requires manual URL input (no automated discovery)
 * 2. Users link devices to Yandex URLs via `yandex.link`
 * 3. Scraping is triggered on-demand, not scheduled
 *
 * The scrape stage exists only to satisfy the pipeline interface.
 * Actual scraping happens in ws-server.ts `yandex.scrape` handler.
 */
const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Yandex prices scrape stage (no-op: user-driven via WebSocket)").pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId, externalId: ctx.externalId }),
    );
  });

const processRawHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const htmlCache = yield* HtmlCacheService;
    const priceService = yield* PriceService;
    const entityData = yield* EntityDataService;

    if (!ctx.deviceId) {
      yield* Effect.logWarning("No deviceId in context, skipping process_raw");
      return;
    }

    const html = yield* htmlCache.getHtmlBySlug(ctx.externalId, "yandex_market", "prices").pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );
    if (!html) {
      yield* Effect.logWarning("No HTML found for Yandex prices").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId }),
      );
      return;
    }

    const offers = parseYandexPrices(html);
    yield* Effect.logInfo(`Extracted ${offers.length} offers from Yandex`).pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId }),
    );

    if (offers.length === 0) {
      return;
    }

    yield* entityData.saveRawData({
      deviceId: ctx.deviceId,
      source: "yandex_market",
      dataKind: "prices",
      scrapeId: ctx.scrapeId ?? undefined,
      data: { offers, extractedAt: Date.now() },
    });

    const count = yield* priceService.savePriceQuotes({
      deviceId: ctx.deviceId,
      source: "yandex_market",
      offers: offers.map((o) => ({
        seller: o.sellerName,
        sellerId: o.sellerId,
        priceMinorUnits: o.priceMinorUnits,
        currency: o.currency,
        variantKey: o.variantKey,
        variantLabel: o.variantLabel,
        url: o.url,
        isAvailable: o.isAvailable,
        offerId: o.offerId,
      })),
      scrapeId: ctx.scrapeId ?? undefined,
    });

    yield* priceService.updatePriceSummary(ctx.deviceId);

    yield* Effect.logInfo(`Saved ${count} price quotes`).pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId }),
    );
  });

registerPipeline({
  source: "yandex_market",
  dataKind: "prices",
  stages: {
    scrape: scrapeHandler,
    process_raw: processRawHandler,
  },
});

export {};
