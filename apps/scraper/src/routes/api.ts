import { Elysia } from "elysia";
import { Effect } from "effect";
import { ScrapeService } from "@repo/scraper-domain";
import { PriceService } from "../services/price";
import { HtmlCacheService } from "../services/html-cache";
import { PhoneDataService } from "../services/phone-data";
import { JobQueueService, type ScrapeMode } from "../services/job-queue";
import { ScrapeRecordService } from "../services/scrape-record";
import { BulkJobManager } from "../services/bulk-job";
import { DeviceRegistryService } from "../services/device-registry";
import { SchedulerService } from "../services/scheduler";
import { log } from "../utils/logger";
import { LiveRuntime } from "../layers/live";

export const createApiRoutes = (bulkJobManager: BulkJobManager) =>
  new Elysia({ prefix: "/api" })
    .post("/scrape/queue", async ({ body }) => {
      const { source, externalId, mode } = body as {
        source: string;
        externalId: string;
        mode: ScrapeMode;
      };
      if (!source || !externalId || !mode) {
        return { error: "source, externalId, and mode are required" };
      }
      if (mode !== "fast" && mode !== "complex") {
        return { error: "mode must be 'fast' or 'complex'" };
      }

      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const deviceRegistry = yield* DeviceRegistryService;
        const scrapeRecord = yield* ScrapeRecordService;

        const device = yield* deviceRegistry.lookupDevice(source, externalId);
        if (!device) {
          return { error: `No device found for ${source}/${externalId}` };
        }

        const scrape = yield* scrapeRecord.createScrape({
          deviceId: device.id,
          source,
          dataKind: "specs",
          externalId,
          url: source === "kimovil" ? `https://www.kimovil.com/en/where-to-buy-${externalId}` : undefined,
        });

        return yield* jobQueue.queueScrape(externalId, device.id, mode, {
          source,
          scrapeId: scrape.id,
        });
      });

      const result = await LiveRuntime.runPromise(program);
      if ("error" in result) {
        return result;
      }
      const item = result;

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
    .get("/scrape/html/:source/:externalId", async ({ params }) => {
      const { source, externalId } = params;
      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const html = yield* htmlCache.getRawHtml(externalId, source);
        return { source, externalId, html };
      });
      return LiveRuntime.runPromise(program);
    })
    .delete("/scrape/html/:source/:externalId", async ({ params }) => {
      const { source, externalId } = params;
      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        yield* jobQueue.clearScrapeData(source, externalId);
        return { success: true, source, externalId };
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/scrape/status", async ({ query }) => {
      const source = (query.source as string) || "kimovil";
      const idsParam = query.externalIds as string;
      if (!idsParam) {
        return { error: "externalIds parameter required" };
      }
      const externalIds = idsParam.split(",");

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

        for (const externalId of externalIds) {
          const hasHtml = yield* htmlCache.hasScrapedHtml(externalId, source);
          const hasRawData = yield* phoneData.hasRaw(externalId);
          const hasAiData = yield* phoneData.has(externalId);
          const queueItem = yield* jobQueue.getQueueItemByTarget(
            source,
            externalId,
          );
          const verification = yield* htmlCache.getVerificationStatus(
            externalId,
            source,
          );
          results[externalId] = {
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
      const { source, externalIds } = body as {
        source?: string;
        externalIds: string[];
      };
      const resolvedSource = source || "kimovil";
      if (!externalIds || !Array.isArray(externalIds) || externalIds.length === 0) {
        return { error: "externalIds array required" };
      }

      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const results: Record<
          string,
          { isCorrupted: boolean | null; reason: string | null }
        > = {};

        for (const externalId of externalIds) {
          const result = yield* htmlCache.verifyHtml(externalId, resolvedSource);
          results[externalId] = result;
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

        return {
          results,
          summary: { total: externalIds.length, corrupted, valid, missing },
        };
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
    .get("/scrape/queue/:source/:externalId", async ({ params }) => {
      const { source, externalId } = params;
      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const item = yield* jobQueue.getQueueItemByTarget(source, externalId);
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
              externalId: string;
              source: string;
              errorMessage: string | null;
              lastErrorCode: string | null;
              attempt: number;
              updatedAt: number;
            }) => ({
              externalId: item.externalId,
              source: item.source,
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
      const { source, externalId } = body as {
        source?: string;
        externalId: string;
      };
      const resolvedSource = source || "kimovil";
      if (!externalId) {
        return { success: false, error: "externalId is required" };
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

        const hasHtml = await LiveRuntime.runPromise(
          htmlCache.hasScrapedHtml(externalId, resolvedSource),
        );
        if (!hasHtml) {
          return {
            success: false,
            error: "No cached HTML found for this externalId",
          };
        }

        const dummyItem = {
          id: -1,
          externalId,
          deviceId: "",
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
          source: resolvedSource,
          dataKind: "specs",
          scrapeId: null,
        };
        await bulkJobManager.runQueueItem(
          dummyItem,
          { htmlCache, phoneData, jobQueue },
          scrapeService,
        );
        return { success: true, source: resolvedSource, externalId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("ProcessRaw", `Failed for ${externalId}: ${message}`);
        return { success: false, error: message };
      }
    })
    .post("/process/ai", async ({ body }) => {
      const { source, externalId } = body as {
        source?: string;
        externalId: string;
      };
      const resolvedSource = source || "kimovil";
      if (!externalId) {
        return { success: false, error: "externalId is required" };
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

        const hasRaw = await LiveRuntime.runPromise(phoneData.hasRaw(externalId));
        if (!hasRaw) {
          return {
            success: false,
            error: "No raw data found for this externalId",
          };
        }

        const dummyItem = {
          id: -1,
          externalId,
          deviceId: "",
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
          source: resolvedSource,
          dataKind: "specs",
          scrapeId: null,
        };
        await bulkJobManager.runQueueItem(
          dummyItem,
          { htmlCache, phoneData, jobQueue },
          scrapeService,
        );
        return { success: true, source: resolvedSource, externalId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("ProcessAi", `Failed for ${externalId}: ${message}`);
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
    })
    .get("/schedules", async () => {
      const schedules = await LiveRuntime.runPromise(
        SchedulerService.pipe(Effect.flatMap((s) => s.listSchedules())),
      );
      return schedules;
    })
    .get("/schedules/:id", async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const schedule = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!schedule) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      return schedule;
    })
    .post("/schedules", async ({ body, set }) => {
      const input = body as {
        name: string;
        source: string;
        dataKind: string;
        cronExpression: string;
        jobType?: string;
        mode?: string;
        filter?: string | null;
        runOnce?: boolean;
        timezone?: string;
      };
      if (!input.name || !input.source || !input.dataKind || !input.cronExpression) {
        set.status = 400;
        return { error: "name, source, dataKind, and cronExpression are required" };
      }
      // Validate jobType and mode if provided
      const validJobTypes = ["scrape", "process_raw", "process_ai"];
      const validModes = ["fast", "complex"];
      if (input.jobType && !validJobTypes.includes(input.jobType)) {
        set.status = 400;
        return { error: `Invalid jobType. Must be one of: ${validJobTypes.join(", ")}` };
      }
      if (input.mode && !validModes.includes(input.mode)) {
        set.status = 400;
        return { error: `Invalid mode. Must be one of: ${validModes.join(", ")}` };
      }
      const schedule = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) =>
            s.upsertSchedule({
              name: input.name,
              source: input.source,
              dataKind: input.dataKind,
              cronExpression: input.cronExpression,
              jobType: input.jobType as "scrape" | "process_raw" | "process_ai" | undefined,
              mode: input.mode as "fast" | "complex" | undefined,
              filter: input.filter,
              runOnce: input.runOnce,
              timezone: input.timezone,
            }),
          ),
        ),
      );
      set.status = 201;
      return schedule;
    })
    .put("/schedules/:id", async ({ params, body, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const input = body as {
        name: string;
        source: string;
        dataKind: string;
        cronExpression: string;
        jobType?: string;
        mode?: string;
        filter?: string | null;
        runOnce?: boolean;
        timezone?: string;
      };
      if (!input.name || !input.source || !input.dataKind || !input.cronExpression) {
        set.status = 400;
        return { error: "name, source, dataKind, and cronExpression are required" };
      }
      // Validate jobType and mode if provided
      const validJobTypes = ["scrape", "process_raw", "process_ai"];
      const validModes = ["fast", "complex"];
      if (input.jobType && !validJobTypes.includes(input.jobType)) {
        set.status = 400;
        return { error: `Invalid jobType. Must be one of: ${validJobTypes.join(", ")}` };
      }
      if (input.mode && !validModes.includes(input.mode)) {
        set.status = 400;
        return { error: `Invalid mode. Must be one of: ${validModes.join(", ")}` };
      }
      const existing = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      const schedule = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) =>
            s.upsertSchedule({
              id,
              name: input.name,
              source: input.source,
              dataKind: input.dataKind,
              cronExpression: input.cronExpression,
              jobType: input.jobType as "scrape" | "process_raw" | "process_ai" | undefined,
              mode: input.mode as "fast" | "complex" | undefined,
              filter: input.filter,
              runOnce: input.runOnce,
              timezone: input.timezone,
            }),
          ),
        ),
      );
      return schedule;
    })
    .delete("/schedules/:id", async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const existing = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.deleteSchedule(id)),
        ),
      );
      set.status = 204;
      return null;
    })
    .post("/schedules/:id/enable", async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const existing = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.enableSchedule(id)),
        ),
      );
      return { success: true };
    })
    .post("/schedules/:id/disable", async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const existing = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.disableSchedule(id)),
        ),
      );
      return { success: true };
    })
    .post("/schedules/:id/trigger", async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id) || id < 1) {
        set.status = 400;
        return { error: "Invalid schedule ID" };
      }
      const existing = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.getSchedule(id)),
        ),
      );
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      const jobId = await LiveRuntime.runPromise(
        SchedulerService.pipe(
          Effect.flatMap((s) => s.triggerNow(id)),
        ),
      );
      return { jobId };
    });
