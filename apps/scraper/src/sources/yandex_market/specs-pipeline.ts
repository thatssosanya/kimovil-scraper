import { Effect } from "effect";
import {
  registerPipeline,
  type PipelineContext,
} from "../../pipeline/registry";
import { parseYandexSpecs, parseYandexImages, parseYandexProduct } from "./extractor";
import { HtmlCacheService } from "../../services/html-cache";
import { EntityDataService } from "../../services/entity-data";
import { DeviceImageService } from "../../services/device-image";
import { uploadYandexImage } from "./image-upload";

/**
 * Yandex specs scraping is user-driven via the WebSocket handler,
 * not batch-processed through the job queue. This is because:
 * 1. Yandex requires manual URL input (no automated discovery)
 * 2. Users link devices to Yandex URLs via `yandex.link`
 * 3. Scraping is triggered on-demand, not scheduled
 *
 * The scrape stage exists only to satisfy the pipeline interface.
 */
const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Yandex specs scrape stage (no-op: user-driven via WebSocket)").pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId, externalId: ctx.externalId }),
    );
  });

const processRawHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const htmlCache = yield* HtmlCacheService;
    const entityData = yield* EntityDataService;
    const imageService = yield* DeviceImageService;

    if (!ctx.deviceId) {
      yield* Effect.logWarning("No deviceId in context, skipping process_raw").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId }),
      );
      return;
    }
    const deviceId = ctx.deviceId;

    const html = yield* htmlCache.getHtmlBySlug(ctx.externalId, "yandex_market", "specs").pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );
    if (!html) {
      yield* Effect.logWarning("No HTML found for Yandex specs").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId }),
      );
      return;
    }

    const specs = parseYandexSpecs(html);
    const images = parseYandexImages(html);
    const product = parseYandexProduct(html);

    yield* Effect.logInfo(`Extracted ${specs.length} specs, ${images.galleryImageUrls.length} images`).pipe(
      Effect.annotateLogs({ deviceId, brand: product.brand, name: product.name }),
    );

    yield* entityData.saveRawData({
      deviceId,
      source: "yandex_market",
      dataKind: "specs",
      scrapeId: ctx.scrapeId ?? undefined,
      data: {
        specs,
        images,
        product,
        extractedAt: Date.now(),
      },
    });

    if (images.galleryImageUrls.length > 0) {
      const uploadResults = yield* Effect.forEach(
        images.galleryImageUrls,
        (url, index) =>
          uploadYandexImage(deviceId, url, index).pipe(
            Effect.map((cdnUrl) => ({ url: cdnUrl, position: index, isPrimary: index === 0, success: true })),
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`Failed to upload image ${index}`).pipe(
                  Effect.annotateLogs({ deviceId, originalUrl: url, error: String(error) }),
                );
                return { url, position: index, isPrimary: index === 0, success: false };
              }),
            ),
          ),
        { concurrency: 4 },
      );

      const successCount = uploadResults.filter((r) => r.success).length;
      yield* Effect.logInfo(`Uploaded ${successCount}/${images.galleryImageUrls.length} images to S3`).pipe(
        Effect.annotateLogs({ deviceId }),
      );

      const imageInputs = uploadResults.map((r) => ({
        url: r.url,
        position: r.position,
        isPrimary: r.isPrimary,
      }));

      const savedCount = yield* imageService.upsertImages(deviceId, "yandex_market", imageInputs);
      yield* Effect.logInfo(`Saved ${savedCount} images to DB`).pipe(
        Effect.annotateLogs({ deviceId }),
      );
    }
  });

registerPipeline({
  source: "yandex_market",
  dataKind: "specs",
  stages: {
    scrape: scrapeHandler,
    process_raw: processRawHandler,
  },
});

export {};
