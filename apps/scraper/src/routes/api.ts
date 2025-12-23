import { Elysia } from "elysia";
import { Effect } from "effect";
import { ScrapeService } from "@repo/scraper-domain";
import { DeviceService, type KimovilDevice } from "../services/device";
import { PriceService } from "../services/price";
import { HtmlCacheService } from "../services/html-cache";
import { PhoneDataService } from "../services/phone-data";
import { JobQueueService, type ScrapeMode } from "../services/job-queue";
import { BulkJobManager } from "../services/bulk-job";
import { DeviceRegistryService } from "../services/device-registry";
import { log } from "../utils/logger";
import { LiveRuntime } from "../layers/live";

export const createApiRoutes = (bulkJobManager: BulkJobManager) =>
  new Elysia({ prefix: "/api" })
    .get("/slugs", async ({ query }) => {
      const program = Effect.gen(function* () {
        const deviceService = yield* DeviceService;
        const htmlCache = yield* HtmlCacheService;
        const phoneData = yield* PhoneDataService;
        const devices = yield* deviceService.getAllDevices();
        const corruptedSlugs = yield* htmlCache.getCorruptedSlugs();
        const validSlugs = yield* htmlCache.getValidSlugs();
        const scrapedSlugs = yield* htmlCache.getScrapedSlugs();
        const rawDataSlugs = yield* phoneData.getRawDataSlugs();
        const aiDataSlugs = yield* phoneData.getAiDataSlugs();
        const rawDataCount = yield* phoneData.getRawCount();
        const aiDataCount = yield* phoneData.getCount();
        return {
          devices,
          corruptedSlugs,
          validSlugs,
          scrapedSlugs,
          rawDataSlugs,
          aiDataSlugs,
          rawDataCount,
          aiDataCount,
        };
      });

      const {
        devices,
        corruptedSlugs,
        validSlugs,
        scrapedSlugs,
        rawDataSlugs,
        aiDataSlugs,
        rawDataCount,
        aiDataCount,
      } = await LiveRuntime.runPromise(program);

      const corruptedSet = new Set(corruptedSlugs);
      const validSet = new Set(validSlugs);
      const scrapedSet = new Set(scrapedSlugs);
      const rawDataSet = new Set(rawDataSlugs);
      const aiDataSet = new Set(aiDataSlugs);

      const search = (query.search as string)?.toLowerCase() || "";
      const filter = query.filter as string | undefined;
      const limit = Math.min(
        Math.max(1, parseInt(query.limit as string) || 500),
        10000,
      );

      let filtered: KimovilDevice[] = devices;

      if (search) {
        filtered = filtered.filter(
          (d) =>
            d.name.toLowerCase().includes(search) ||
            d.slug.toLowerCase().includes(search) ||
            d.brand?.toLowerCase().includes(search),
        );
      }

      if (filter === "corrupted") {
        filtered = filtered.filter((d) => corruptedSet.has(d.slug));
      } else if (filter === "valid") {
        filtered = filtered.filter((d) => validSet.has(d.slug));
      } else if (filter === "scraped") {
        filtered = filtered.filter((d) => scrapedSet.has(d.slug));
      } else if (filter === "unscraped") {
        filtered = filtered.filter((d) => !scrapedSet.has(d.slug));
      } else if (filter === "has_raw") {
        filtered = filtered.filter((d) => rawDataSet.has(d.slug));
      } else if (filter === "has_ai") {
        filtered = filtered.filter((d) => aiDataSet.has(d.slug));
      } else if (filter === "needs_raw") {
        filtered = filtered.filter(
          (d) => scrapedSet.has(d.slug) && !rawDataSet.has(d.slug),
        );
      } else if (filter === "needs_ai") {
        filtered = filtered.filter(
          (d) => rawDataSet.has(d.slug) && !aiDataSet.has(d.slug),
        );
      }

      return {
        total: devices.length,
        filtered: filtered.length,
        devices: filtered.slice(0, limit),
        stats: {
          corrupted: corruptedSlugs.length,
          valid: validSlugs.length,
          scraped: scrapedSlugs.length,
          rawData: rawDataCount,
          aiData: aiDataCount,
        },
      };
    })
    .get("/slugs/stats", async () => {
      const program = Effect.gen(function* () {
        const deviceService = yield* DeviceService;
        const deviceCount = yield* deviceService.getDeviceCount();
        const pendingCount = yield* deviceService.getPendingPrefixCount();
        return { devices: deviceCount, pendingPrefixes: pendingCount };
      });
      return LiveRuntime.runPromise(program);
    })
    .post("/scrape/queue", async ({ body }) => {
      const { slug, mode } = body as { slug: string; mode: ScrapeMode };
      if (!slug || !mode) {
        return { error: "slug and mode are required" };
      }
      if (mode !== "fast" && mode !== "complex") {
        return { error: "mode must be 'fast' or 'complex'" };
      }

      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        return yield* jobQueue.queueScrape(slug, mode);
      });

      const item = await LiveRuntime.runPromise(program);

      void (async () => {
        const servicesProgram = Effect.gen(function* () {
          const htmlCache = yield* HtmlCacheService;
          const phoneData = yield* PhoneDataService;
          const jobQueue = yield* JobQueueService;
          const scrapeService = yield* ScrapeService;
          return { htmlCache, phoneData, jobQueue, scrapeService };
        });
        const { htmlCache, phoneData, jobQueue, scrapeService } =
          await LiveRuntime.runPromise(servicesProgram);
        await LiveRuntime.runPromise(jobQueue.startQueueItem(item.id));
        await bulkJobManager.runQueueItem(
          item,
          { htmlCache, phoneData, jobQueue },
          scrapeService,
        );
      })();

      return item;
    })
    .get("/scrape/html/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const html = yield* htmlCache.getRawHtml(params.slug);
        return { slug: params.slug, html };
      });
      return LiveRuntime.runPromise(program);
    })
    .delete("/scrape/html/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        yield* jobQueue.clearScrapeData(params.slug);
        return { success: true, slug: params.slug };
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/scrape/status", async ({ query }) => {
      const slugsParam = query.slugs as string;
      if (!slugsParam) {
        return { error: "slugs parameter required" };
      }
      const slugs = slugsParam.split(",");

      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const phoneData = yield* PhoneDataService;
        const jobQueue = yield* JobQueueService;
        const results: Record<
          string,
          {
            hasHtml: boolean;
            hasRawData: boolean;
            hasAiData: boolean;
            queueStatus: string | null;
            isCorrupted: boolean | null;
            corruptionReason: string | null;
          }
        > = {};

        for (const slug of slugs) {
          const hasHtml = yield* htmlCache.hasScrapedHtml(slug);
          const hasRawData = yield* phoneData.hasRaw(slug);
          const hasAiData = yield* phoneData.has(slug);
          const queueItem = yield* jobQueue.getQueueItemBySlug(slug);
          const verification = yield* htmlCache.getVerificationStatus(slug);
          results[slug] = {
            hasHtml,
            hasRawData,
            hasAiData,
            queueStatus: queueItem?.status ?? null,
            isCorrupted: verification?.isCorrupted ?? null,
            corruptionReason: verification?.reason ?? null,
          };
        }

        return results;
      });

      return LiveRuntime.runPromise(program);
    })
    .post("/scrape/verify", async ({ body }) => {
      const { slugs } = body as { slugs: string[] };
      if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
        return { error: "slugs array required" };
      }

      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const results: Record<
          string,
          { isCorrupted: boolean | null; reason: string | null }
        > = {};

        for (const slug of slugs) {
          const result = yield* htmlCache.verifyHtml(slug);
          results[slug] = result;
        }

        const corrupted = Object.values(results).filter(
          (r) => r.isCorrupted === true,
        ).length;
        const valid = Object.values(results).filter(
          (r) => r.isCorrupted === false,
        ).length;
        const missing = Object.values(results).filter(
          (r) => r.isCorrupted === null,
        ).length;

        return { results, summary: { total: slugs.length, corrupted, valid, missing } };
      });

      return LiveRuntime.runPromise(program);
    })
    .get("/scrape/queue", async ({ query }) => {
      const status = query.status as string | undefined;

      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const items = yield* jobQueue.getQueueItems(
          status as "pending" | "running" | "done" | "error" | undefined,
        );
        return { items };
      });

      return LiveRuntime.runPromise(program);
    })
    .get("/scrape/queue/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const item = yield* jobQueue.getQueueItemBySlug(params.slug);
        return item;
      });

      return LiveRuntime.runPromise(program);
    })
    .get("/phone-data/raw/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const phoneData = yield* PhoneDataService;
        const data = yield* phoneData.getRaw(params.slug);
        return { slug: params.slug, data };
      });

      return LiveRuntime.runPromise(program);
    })
    .delete("/phone-data/raw/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const phoneData = yield* PhoneDataService;
        const deleted = yield* phoneData.deleteRaw(params.slug);
        return { success: true, slug: params.slug, deleted };
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/phone-data/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const phoneData = yield* PhoneDataService;
        const data = yield* phoneData.get(params.slug);
        return { slug: params.slug, data };
      });

      return LiveRuntime.runPromise(program);
    })
    .delete("/phone-data/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const phoneData = yield* PhoneDataService;
        const deleted = yield* phoneData.delete(params.slug);
        return { success: true, slug: params.slug, deleted };
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/bulk/:jobId/errors", async ({ params, query }) => {
      const limit = Math.min(500, Math.max(1, Number(query.limit) || 100));
      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const items = yield* jobQueue.getErrorQueueItems(params.jobId, limit);
        return {
          items: items.map(
            (item: {
              slug: string;
              errorMessage: string | null;
              lastErrorCode: string | null;
              attempt: number;
              updatedAt: number;
            }) => ({
              slug: item.slug,
              error: item.errorMessage,
              errorCode: item.lastErrorCode,
              attempt: item.attempt,
              updatedAt: item.updatedAt,
            }),
          ),
          total: items.length,
        };
      });

      return LiveRuntime.runPromise(program);
    })
    .post("/scrape/run-next", async () => {
      const servicesProgram = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const phoneData = yield* PhoneDataService;
        const jobQueue = yield* JobQueueService;
        const scrapeService = yield* ScrapeService;
        return { htmlCache, phoneData, jobQueue, scrapeService };
      });
      const { htmlCache, phoneData, jobQueue, scrapeService } =
        await LiveRuntime.runPromise(servicesProgram);
      const item = await LiveRuntime.runPromise(jobQueue.claimNextQueueItem());
      if (!item) {
        return { message: "No pending items in queue" };
      }
      await bulkJobManager.runQueueItem(
        item,
        { htmlCache, phoneData, jobQueue },
        scrapeService,
      );
      return { success: true, item };
    })
    .post("/process/raw", async ({ body }) => {
      const { slug } = body as { slug: string };
      if (!slug) {
        return { success: false, error: "slug is required" };
      }

      try {
        const program = Effect.gen(function* () {
          const htmlCache = yield* HtmlCacheService;
          const phoneData = yield* PhoneDataService;
          const jobQueue = yield* JobQueueService;
          const scrapeService = yield* ScrapeService;
          return { htmlCache, phoneData, jobQueue, scrapeService };
        });
        const { htmlCache, phoneData, jobQueue, scrapeService } =
          await LiveRuntime.runPromise(program);

        const hasHtml = await LiveRuntime.runPromise(htmlCache.hasScrapedHtml(slug));
        if (!hasHtml) {
          return { success: false, error: "No cached HTML found for this slug" };
        }

        const dummyItem = {
          id: -1,
          slug,
          jobId: null,
          jobType: "process_raw" as const,
          mode: "fast" as const,
          status: "running" as const,
          attempt: 0,
          maxAttempts: 1,
          nextAttemptAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startedAt: Date.now(),
          completedAt: null,
          errorMessage: null,
          lastErrorCode: null,
          source: "kimovil",
          dataKind: "specs",
          scrapeId: null,
        };
        await bulkJobManager.runQueueItem(
          dummyItem,
          { htmlCache, phoneData, jobQueue },
          scrapeService,
        );
        return { success: true, slug };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("ProcessRaw", `Failed for ${slug}: ${message}`);
        return { success: false, error: message };
      }
    })
    .post("/process/ai", async ({ body }) => {
      const { slug } = body as { slug: string };
      if (!slug) {
        return { success: false, error: "slug is required" };
      }

      try {
        const program = Effect.gen(function* () {
          const htmlCache = yield* HtmlCacheService;
          const phoneData = yield* PhoneDataService;
          const jobQueue = yield* JobQueueService;
          const scrapeService = yield* ScrapeService;
          return { htmlCache, phoneData, jobQueue, scrapeService };
        });
        const { htmlCache, phoneData, jobQueue, scrapeService } =
          await LiveRuntime.runPromise(program);

        const hasRaw = await LiveRuntime.runPromise(phoneData.hasRaw(slug));
        if (!hasRaw) {
          return { success: false, error: "No raw data found for this slug" };
        }

        const dummyItem = {
          id: -1,
          slug,
          jobId: null,
          jobType: "process_ai" as const,
          mode: "fast" as const,
          status: "running" as const,
          attempt: 0,
          maxAttempts: 1,
          nextAttemptAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startedAt: Date.now(),
          completedAt: null,
          errorMessage: null,
          lastErrorCode: null,
          source: "kimovil",
          dataKind: "specs",
          scrapeId: null,
        };
        await bulkJobManager.runQueueItem(
          dummyItem,
          { htmlCache, phoneData, jobQueue },
          scrapeService,
        );
        return { success: true, slug };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("ProcessAi", `Failed for ${slug}: ${message}`);
        return { success: false, error: message };
      }
    })
    .get("/prices/:slug", async ({ params }) => {
      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const priceService = yield* PriceService;
        
        const device = yield* deviceRegistry.getDeviceBySlug(params.slug);
        if (!device) {
          return null;
        }
        
        return yield* priceService.getCurrentPrices(device.id);
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/prices/:slug/history", async ({ params, query }) => {
      const days = parseInt(query.days as string) || 30;
      const variantKey = query.variant as string | undefined;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const priceService = yield* PriceService;
        
        const device = yield* deviceRegistry.getDeviceBySlug(params.slug);
        if (!device) {
          return [];
        }
        
        return yield* priceService.getPriceHistory({
          deviceId: device.id,
          days,
          variantKey,
        });
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/prices/:slug/quotes", async ({ params, query }) => {
      const source = query.source as string | undefined;
      const externalId = query.externalId as string | undefined;
      const limit = parseInt(query.limit as string) || 500;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const priceService = yield* PriceService;

        const device = yield* deviceRegistry.getDeviceBySlug(params.slug);
        if (!device) {
          return [];
        }

        return yield* priceService.getAllQuotes({
          deviceId: device.id,
          source,
          externalId,
          limit,
        });
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/device-sources/:slug", async ({ params, query }) => {
      const source = query.source as string | undefined;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;

        const device = yield* deviceRegistry.getDeviceBySlug(params.slug);
        if (!device) {
          return [];
        }

        const sources = yield* deviceRegistry.getDeviceSources(device.id);

        if (source) {
          return sources.filter((s) => s.source === source);
        }
        return sources;
      });

      return LiveRuntime.runPromise(program);
    });
