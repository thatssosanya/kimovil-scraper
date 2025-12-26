import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { Effect, Stream } from "effect";
import { Schema } from "@effect/schema";
import { LiveRuntime } from "../layers/live";
import {
  Request,
  Response,
  HealthCheckResult,
  ErrorResponse,
  StreamEvent,
  SearchResult,
  SearchParams,
  ScrapeParams,
  ScrapeResult,
  BulkStartParams,
  BulkSubscribeParams,
  BulkResult,
  BulkJobInfo,
  BulkJobStats,
  BulkListResult,
  BulkJobWithStats,
  BulkPauseParams,
  BulkResumeParams,
  BulkSetWorkersParams,
  BulkControlResult,
  YandexScrapeParams,
  YandexScrapeResult,
  YandexLinkParams,
  YandexLinkResult,
} from "@repo/scraper-protocol";
import {
  SearchService,
  ScrapeService,
  ScrapeError,
  SearchEvent,
  ScrapeEvent,
} from "@repo/scraper-domain";

import { HtmlCacheService } from "../services/html-cache";
import {
  JobQueueService,
  type ScrapeMode,
  type JobType as StorageJobType,
} from "../services/job-queue";
import { BulkJobManager, type Ws } from "../services/bulk-job";
import { config } from "../config";
import { log } from "../utils/logger";
import { BrowserService } from "../services/browser";
import { PriceService } from "../services/price";
import { EntityDataService } from "../services/entity-data";
import { DeviceRegistryService } from "../services/device-registry";
import { parseYandexPrices } from "../sources/yandex_market/extractor";
import { ALLOWED_HOSTS, validateYandexMarketUrl } from "../sources/yandex_market/url-utils";
import { YandexBrowserError } from "../sources/yandex_market/errors";

type StreamHandler = (
  request: Request,
  ws: Ws,
) => Effect.Effect<void, unknown, unknown>;

const isSearchResult = (
  item: SearchResult | SearchEvent,
): item is SearchResult => "options" in item;

const isScrapeResult = (
  item: ScrapeResult | ScrapeEvent,
): item is ScrapeResult => "data" in item;

const getDefaultFilter = (jobType: StorageJobType): string => {
  switch (jobType) {
    case "scrape":
      return "unscraped";
    case "process_raw":
      return "needs_extraction";
    case "process_ai":
      return "needs_ai";
    default:
      return "all";
  }
};

const createHandlers = (
  bulkJobManager: BulkJobManager,
): Record<string, StreamHandler> => ({
  "health.check": (request, ws) =>
    Effect.gen(function* () {
      const result = new HealthCheckResult({ ok: true, version: "0.1.0" });
      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));
    }),

  "scrape.search": (request, ws) =>
    Effect.gen(function* () {
      const searchService = yield* SearchService;
      const params = yield* Schema.decodeUnknown(SearchParams)(request.params);

      const stream = searchService.search(params.query);

      yield* Effect.sync(() =>
        ws.send(
          JSON.stringify(
            new StreamEvent({
              id: request.id,
              event: {
                type: "log",
                level: "info",
                message: `Searching for "${params.query}"...`,
              },
            }),
          ),
        ),
      );

      let finalResult: SearchResult | null = null;

      yield* Stream.runForEach(stream, (item) =>
        Effect.gen(function* () {
          if (isSearchResult(item)) {
            finalResult = item;
          } else {
            yield* Effect.sync(() =>
              ws.send(
                JSON.stringify(
                  new StreamEvent({
                    id: request.id,
                    event: item,
                  }),
                ),
              ),
            );
          }
        }),
      );

      if (finalResult) {
        const response = new Response({
          id: request.id,
          result: finalResult,
        });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
      }
    }),

  "scrape.get": (request, ws) =>
    Effect.gen(function* () {
      const scrapeService = yield* ScrapeService;
      const params = yield* Schema.decodeUnknown(ScrapeParams)(request.params);

      yield* Effect.sync(() =>
        ws.send(
          JSON.stringify(
            new StreamEvent({
              id: request.id,
              event: {
                type: "log",
                level: "info",
                message: `Scraping data for "${params.slug}"...`,
              },
            }),
          ),
        ),
      );

      const stream = scrapeService.scrape(params.slug);

      let finalResult: ScrapeResult | null = null;

      yield* Stream.runForEach(stream, (item) =>
        Effect.gen(function* () {
          if (isScrapeResult(item)) {
            finalResult = item;
          } else {
            yield* Effect.sync(() =>
              ws.send(
                JSON.stringify(
                  new StreamEvent({
                    id: request.id,
                    event: item,
                  }),
                ),
              ),
            );
          }
        }),
      );

      if (finalResult) {
        const response = new Response({
          id: request.id,
          result: finalResult,
        });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
      }
    }),

  "bulk.start": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkStartParams)(
        request.params,
      );
      const htmlCache = yield* HtmlCacheService;
      const entityData = yield* EntityDataService;
      const jobQueue = yield* JobQueueService;
      const deviceRegistry = yield* DeviceRegistryService;
      const jobType: StorageJobType =
        (params.jobType as StorageJobType) ?? "scrape";

      // Determine source and dataKind from params (with backwards-compat defaults)
      // link_priceru is a legacy alias for (scrape, price_ru, price_links)
      const isLegacyPriceRuLink = jobType === "link_priceru";
      const source = params.source ?? (isLegacyPriceRuLink ? "price_ru" : "kimovil");
      const dataKind = params.dataKind ?? (isLegacyPriceRuLink ? "price_links" : "specs");
      const isPriceRuPrices = source === "price_ru" && dataKind === "prices";
      const isPriceRuLinks = source === "price_ru" && dataKind === "price_links";

      let targetSlugs: string[] = [];
      let priceRuTargets: Array<{ deviceId: string; externalId: string }> = [];

      if (Array.isArray(params.slugs) && params.slugs.length > 0) {
        targetSlugs = Array.from(new Set(params.slugs));
      } else if (isPriceRuPrices) {
        // For price.ru prices, get devices with active price_ru links
        const linkedDevices = yield* deviceRegistry.getDevicesBySource("price_ru");
        priceRuTargets = linkedDevices.map((d) => ({
          deviceId: d.deviceId,
          externalId: d.externalId,
        }));
      } else if (isPriceRuLinks || isLegacyPriceRuLink) {
        // For price.ru linking, target all devices
        const allDevices = yield* deviceRegistry.getAllDevices();
        targetSlugs = allDevices.map((d) => d.slug);
      } else if (jobType === "scrape") {
        const kimovilDevices = yield* deviceRegistry.getDevicesBySource("kimovil");
        const allSlugs = kimovilDevices.map((d) => d.slug);
        if (params.filter === "all") {
          targetSlugs = allSlugs;
        } else {
          const validSlugs = yield* htmlCache.getValidSlugs();
          const validSet = new Set(validSlugs);
          targetSlugs = allSlugs.filter(
            (slug: string) => !validSet.has(slug),
          );
        }
      } else if (jobType === "process_raw") {
        if (params.filter === "all") {
          const validSlugs = yield* htmlCache.getValidSlugs();
          targetSlugs = validSlugs;
        } else {
          targetSlugs = yield* entityData.getSlugsNeedingExtraction("kimovil", "specs");
        }
      } else if (jobType === "process_ai") {
        if (params.filter === "all") {
          const kimovilDevices = yield* deviceRegistry.getDevicesBySource("kimovil");
          const rawSlugs = new Set(yield* entityData.getSlugsNeedingAi("kimovil", "specs"));
          const validSlugs = yield* htmlCache.getValidSlugs();
          for (const slug of validSlugs) {
            rawSlugs.add(slug);
          }
          targetSlugs = kimovilDevices
            .map((d) => d.slug)
            .filter((s: string) => rawSlugs.has(s));
        } else {
          targetSlugs = yield* entityData.getSlugsNeedingAi("kimovil", "specs");
        }
      }

      const jobId = globalThis.crypto.randomUUID();
      const mode: ScrapeMode = params.mode ?? "fast";

      // Build targets based on source type
      let targets: Array<{ deviceId: string; externalId: string }> = [];

      if (isPriceRuPrices && priceRuTargets.length > 0) {
        // For price.ru prices without explicit slugs, use device_sources
        targets = priceRuTargets;
      } else if (isPriceRuPrices && targetSlugs.length > 0) {
        // For price.ru prices with explicit slugs, look up device anchors
        for (const slug of targetSlugs) {
          const device = yield* deviceRegistry.getDeviceBySlug(slug);
          if (!device) continue;
          const sources = yield* deviceRegistry.getSourcesByDeviceAndSource(device.id, "price_ru");
          const activeLink = sources.find((s) => s.status === "active");
          if (activeLink) {
            targets.push({ deviceId: device.id, externalId: activeLink.externalId });
          }
        }
      } else {
        // Build targets from slugs, ensuring device exists
        for (const slug of targetSlugs) {
          let device = yield* deviceRegistry.getDeviceBySlug(slug);
          if (!device) {
            device = yield* deviceRegistry.createDevice({
              slug,
              name: slug,
              brand: null,
            });
          }
          // For price_ru links, we use deviceId as externalId (will search by device name)
          // For kimovil jobs, slug is the externalId
          if (!isPriceRuLinks && !isLegacyPriceRuLink) {
            yield* deviceRegistry.linkDeviceToSource({
              deviceId: device.id,
              source: "kimovil",
              externalId: slug,
            });
          }
          const externalId = (isPriceRuLinks || isLegacyPriceRuLink) ? device.id : slug;
          targets.push({ deviceId: device.id, externalId });
        }
      }

      const totalCount = targets.length;

      const job = yield* jobQueue.createJob({
        id: jobId,
        jobType,
        mode,
        aiMode: params.aiMode ?? null,
        filter: params.filter ?? getDefaultFilter(jobType),
        totalCount,
        queuedCount: 0,
        source,
        dataKind,
      });

      const enqueueResult = yield* jobQueue.enqueueJobTargets(
        jobId,
        jobType,
        mode,
        targets,
        { source, dataKind },
      );

      yield* jobQueue.updateJobCounts(
        jobId,
        totalCount,
        enqueueResult.queued,
      );

      bulkJobManager.subscribe(jobId, ws);

      const stats = yield* jobQueue.getJobStats(jobId);
      const result = new BulkResult({
        job: new BulkJobInfo({
          id: job.id,
          jobType: job.jobType,
          mode: job.mode,
          aiMode: job.aiMode,
          status: job.status,
          filter: job.filter,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
          totalCount: targetSlugs.length,
          queuedCount: enqueueResult.queued,
          batchRequestId: job.batchRequestId,
          batchStatus: job.batchStatus,
        }),
        stats: new BulkJobStats(stats),
      });

      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));

      yield* Effect.sync(() => {
        void bulkJobManager.runJob(jobId, request.id);
      });
    }),

  "bulk.subscribe": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkSubscribeParams)(
        request.params,
      );
      const jobQueue = yield* JobQueueService;

      const job = yield* jobQueue.getJob(params.jobId);
      if (!job) {
        const errorResponse = new ErrorResponse({
          id: request.id,
          error: {
            code: "JOB_NOT_FOUND",
            message: `Bulk job not found: ${params.jobId}`,
          },
        });
        yield* Effect.sync(() => ws.send(JSON.stringify(errorResponse)));
        return;
      }

      bulkJobManager.subscribe(params.jobId, ws);

      const stats = yield* jobQueue.getJobStats(params.jobId);
      const result = new BulkResult({
        job: new BulkJobInfo({
          id: job.id,
          jobType: job.jobType,
          mode: job.mode,
          aiMode: job.aiMode,
          status: job.status,
          filter: job.filter,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
          totalCount: job.totalCount,
          queuedCount: job.queuedCount,
          batchRequestId: job.batchRequestId,
          batchStatus: job.batchStatus,
        }),
        stats: new BulkJobStats(stats),
      });

      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));
    }),

  "bulk.list": (request, ws) =>
    Effect.gen(function* () {
      const jobQueue = yield* JobQueueService;
      const allJobs = yield* jobQueue.getAllJobs();

      const jobsWithStats: Array<{ job: BulkJobInfo; stats: BulkJobStats }> =
        [];
      for (const job of allJobs) {
        const stats = yield* jobQueue.getJobStats(job.id);
        const timeout = yield* jobQueue.getTimeoutStats(job.id);
        const state = bulkJobManager.getJobState(job.id);
        jobsWithStats.push({
          job: new BulkJobInfo({
            id: job.id,
            jobType: job.jobType,
            mode: job.mode,
            aiMode: job.aiMode,
            status: job.status,
            filter: job.filter,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            errorMessage: job.errorMessage,
            totalCount: job.totalCount,
            queuedCount: job.queuedCount,
            workerCount: state?.workerCount ?? config.bulk.concurrency,
            batchRequestId: job.batchRequestId,
            batchStatus: job.batchStatus,
          }),
          stats: new BulkJobStats({
            ...stats,
            timeout: timeout.count > 0 ? {
              count: timeout.count,
              nextRetryAt: timeout.nextRetryAt,
              nextRetryExternalId: timeout.nextRetryExternalId,
            } : undefined,
          }),
        });
      }

      bulkJobManager.subscribeToList(ws);

      const result = new BulkListResult({
        jobs: jobsWithStats.map(
          (j) => new BulkJobWithStats({ job: j.job, stats: j.stats }),
        ),
      });
      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));
    }),

  "bulk.pause": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkPauseParams)(
        request.params,
      );
      const jobQueue = yield* JobQueueService;

      const job = yield* jobQueue.getJob(params.jobId);
      if (!job || job.status !== "running") {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      const state = bulkJobManager.getJobState(params.jobId);
      state.paused = true;

      const unclaimedCount = yield* jobQueue.unclaimRunningItems(params.jobId);
      yield* Effect.sync(() => {
        log.info(
          `Job:${params.jobId.slice(0, 8)}`,
          `⏸ Paused, unclaimed ${unclaimedCount} items`,
        );
      });

      yield* jobQueue.updateJobStatus(params.jobId, "pausing");

      const updatedJob = yield* jobQueue.getJob(params.jobId);
      const result = new BulkControlResult({
        success: true,
        job: updatedJob
          ? new BulkJobInfo({
              id: updatedJob.id,
              jobType: updatedJob.jobType,
              mode: updatedJob.mode,
              aiMode: updatedJob.aiMode,
              status: updatedJob.status,
              filter: updatedJob.filter,
              createdAt: updatedJob.createdAt,
              startedAt: updatedJob.startedAt,
              completedAt: updatedJob.completedAt,
              errorMessage: updatedJob.errorMessage,
              totalCount: updatedJob.totalCount,
              queuedCount: updatedJob.queuedCount,
              workerCount: state.workerCount,
              batchRequestId: updatedJob.batchRequestId,
              batchStatus: updatedJob.batchStatus,
            })
          : undefined,
      });
      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));

      bulkJobManager.broadcastJobUpdate(
        params.jobId,
        "pausing",
        state.workerCount,
      );
    }),

  "bulk.resume": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkResumeParams)(
        request.params,
      );
      const jobQueue = yield* JobQueueService;

      const job = yield* jobQueue.getJob(params.jobId);
      if (!job) {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      if (job.status === "paused") {
        const state = bulkJobManager.getJobState(params.jobId);
        state.paused = false;
        yield* jobQueue.updateJobStatus(params.jobId, "running");
        bulkJobManager.broadcastJobUpdate(
          params.jobId,
          "running",
          state.workerCount,
        );
        yield* Effect.sync(() => {
          log.info(`Job:${params.jobId.slice(0, 8)}`, `▶ Resuming paused job`);
          void bulkJobManager.runJob(params.jobId, request.id);
        });
      } else if (
        job.status === "pending" ||
        job.status === "error" ||
        job.status === "done"
      ) {
        yield* jobQueue.resetStuckQueueItems(params.jobId);

        const stats = yield* jobQueue.getJobStats(params.jobId);
        if (
          job.status === "error" ||
          (job.status === "done" && stats.error > 0)
        ) {
          const resetCount = yield* jobQueue.resetErrorQueueItems(params.jobId);
          if (resetCount > 0) {
            yield* Effect.sync(() => {
              log.info(
                `Job:${params.jobId.slice(0, 8)}`,
                `▶ Retrying ${resetCount} failed items`,
              );
            });
          } else {
            yield* Effect.sync(() => {
              log.info(
                `Job:${params.jobId.slice(0, 8)}`,
                `▶ No failed items to retry`,
              );
            });
          }
        } else {
          yield* Effect.sync(() => {
            log.info(
              `Job:${params.jobId.slice(0, 8)}`,
              `▶ Restarting pending job`,
            );
          });
        }

        yield* Effect.sync(() => {
          void bulkJobManager.runJob(params.jobId, request.id);
        });
      }

      const updatedJob = yield* jobQueue.getJob(params.jobId);
      const state = bulkJobManager.getJobState(params.jobId);
      const result = new BulkControlResult({
        success: true,
        job: updatedJob
          ? new BulkJobInfo({
              id: updatedJob.id,
              jobType: updatedJob.jobType,
              mode: updatedJob.mode,
              aiMode: updatedJob.aiMode,
              status: updatedJob.status,
              filter: updatedJob.filter,
              createdAt: updatedJob.createdAt,
              startedAt: updatedJob.startedAt,
              completedAt: updatedJob.completedAt,
              errorMessage: updatedJob.errorMessage,
              totalCount: updatedJob.totalCount,
              queuedCount: updatedJob.queuedCount,
              workerCount: state.workerCount,
              batchRequestId: updatedJob.batchRequestId,
              batchStatus: updatedJob.batchStatus,
            })
          : undefined,
      });
      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));
    }),

  "bulk.setWorkers": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkSetWorkersParams)(
        request.params,
      );
      const jobQueue = yield* JobQueueService;
      const browserService = yield* BrowserService;

      const job = yield* jobQueue.getJob(params.jobId);
      if (!job) {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      const state = bulkJobManager.getJobState(params.jobId);
      state.workerCount = Math.max(1, Math.min(50, params.workerCount));
      
      yield* browserService.resizePool(state.workerCount);

      const stats = yield* jobQueue.getJobStats(params.jobId);
      const timeout = yield* jobQueue.getTimeoutStats(params.jobId);
      bulkJobManager.broadcastJobUpdate(
        params.jobId,
        job.status,
        state.workerCount,
        {
          ...stats,
          timeout: timeout.count > 0 ? {
            count: timeout.count,
            nextRetryAt: timeout.nextRetryAt,
            nextRetryExternalId: timeout.nextRetryExternalId,
          } : undefined,
        },
      );

      const result = new BulkControlResult({
        success: true,
        job: new BulkJobInfo({
          id: job.id,
          jobType: job.jobType,
          mode: job.mode,
          aiMode: job.aiMode,
          status: job.status,
          filter: job.filter,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
          totalCount: job.totalCount,
          queuedCount: job.queuedCount,
          workerCount: state.workerCount,
          batchRequestId: job.batchRequestId,
          batchStatus: job.batchStatus,
        }),
      });
      const response = new Response({ id: request.id, result });
      yield* Effect.sync(() => ws.send(JSON.stringify(response)));
    }),

  "yandex.scrape": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(YandexScrapeParams)(
        request.params,
      );

      const validation = validateYandexMarketUrl(params.url);
      if (!validation.valid) {
        const result = new YandexScrapeResult({
          success: false,
          error: validation.error,
        });
        yield* Effect.sync(() =>
          ws.send(JSON.stringify(new Response({ id: request.id, result }))),
        );
        return;
      }
      const externalId = validation.externalId;

      yield* Effect.sync(() =>
        ws.send(
          JSON.stringify(
            new StreamEvent({
              id: request.id,
              event: {
                type: "progress",
                stage: "browser",
                percent: 0,
              },
            }),
          ),
        ),
      );

      const browserService = yield* BrowserService;
      const htmlCache = yield* HtmlCacheService;
      const priceService = yield* PriceService;
      const entityData = yield* EntityDataService;

      const cleanUrl = validation.cleanUrl;
      const html = yield* browserService.withPersistentStealthPage((page) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () => page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 60000 }),
            catch: (cause) => new YandexBrowserError({ message: "Failed to navigate to Yandex page", url: cleanUrl, cause }),
          });

          const finalUrl = page.url();
          const finalParsed = new URL(finalUrl);
          if (!ALLOWED_HOSTS.includes(finalParsed.hostname)) {
            return yield* Effect.fail(new YandexBrowserError({
              message: `Redirected to disallowed host: ${finalParsed.hostname}`,
              url: cleanUrl,
            }));
          }

          yield* Effect.promise(() => page.waitForTimeout(3000));
          return yield* Effect.tryPromise({
            try: () => page.content(),
            catch: (cause) => new YandexBrowserError({ message: "Failed to get page content", url: cleanUrl, cause }),
          });
        }),
      );

      yield* Effect.sync(() =>
        ws.send(
          JSON.stringify(
            new StreamEvent({
              id: request.id,
              event: {
                type: "progress",
                stage: "scrape",
                percent: 50,
              },
            }),
          ),
        ),
      );

      const offers = parseYandexPrices(html);

      if (offers.length === 0) {
        const result = new YandexScrapeResult({
          success: false,
          error: "No prices found on page",
        });
        yield* Effect.sync(() =>
          ws.send(JSON.stringify(new Response({ id: request.id, result }))),
        );
        return;
      }

      if (params.deviceId) {
        const deviceRegistry = yield* DeviceRegistryService;
        const device = yield* deviceRegistry.getDeviceBySlug(params.deviceId);
        
        if (device) {
          yield* deviceRegistry.linkDeviceToSource({
            deviceId: device.id,
            source: "yandex_market",
            externalId,
            url: params.url,
          });

          yield* entityData.saveRawData({
            deviceId: device.id,
            source: "yandex_market",
            dataKind: "prices",
            data: { offers, extractedAt: Date.now() },
          });

          yield* priceService.savePriceQuotes({
            deviceId: device.id,
            source: "yandex_market",
            externalId,
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
          });

          yield* priceService.updatePriceSummary(device.id);
        }
      }

      const prices = offers.map((o) => o.priceMinorUnits / 100);
      const result = new YandexScrapeResult({
        success: true,
        priceCount: offers.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      });

      yield* Effect.sync(() =>
        ws.send(JSON.stringify(new Response({ id: request.id, result }))),
      );
    }),

  "yandex.link": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(YandexLinkParams)(
        request.params,
      );

      const validation = validateYandexMarketUrl(params.url);
      if (!validation.valid) {
        const result = new YandexLinkResult({
          success: false,
          error: validation.error,
        });
        yield* Effect.sync(() =>
          ws.send(JSON.stringify(new Response({ id: request.id, result }))),
        );
        return;
      }
      const externalId = validation.externalId;

      const deviceRegistry = yield* DeviceRegistryService;

      const device = yield* deviceRegistry.getDeviceBySlug(params.deviceId);
      if (!device) {
        const result = new YandexLinkResult({
          success: false,
          error: `Device not found: ${params.deviceId}`,
        });
        yield* Effect.sync(() =>
          ws.send(JSON.stringify(new Response({ id: request.id, result }))),
        );
        return;
      }

      yield* deviceRegistry.linkDeviceToSource({
        deviceId: device.id,
        source: "yandex_market",
        externalId,
        url: params.url,
      });

      const result = new YandexLinkResult({ success: true, externalId });
      yield* Effect.sync(() =>
        ws.send(JSON.stringify(new Response({ id: request.id, result }))),
      );
    }),
});

function wrapWs(socket: WebSocket): Ws {
  return {
    send: (data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
  };
}

export function createWsServer(
  httpServer: Server,
  bulkJobManager: BulkJobManager,
) {
  const handlers = createHandlers(bulkJobManager);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
      request.url ?? "",
      `http://${request.headers.host}`,
    ).pathname;

    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (socket: WebSocket) => {
    console.log("Client connected");
    const ws = wrapWs(socket);

    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });

    socket.on("message", (data: Buffer | string) => {
      let parsed: unknown;
      try {
        if (typeof data === "string") {
          parsed = JSON.parse(data);
        } else if (Buffer.isBuffer(data)) {
          parsed = JSON.parse(data.toString());
        } else {
          parsed = JSON.parse(String(data));
        }
      } catch (err) {
        const errorResponse = new ErrorResponse({
          id: "unknown",
          error: {
            code: "INVALID_JSON",
            message: `Failed to parse message as JSON: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
        ws.send(JSON.stringify(errorResponse));
        return;
      }

      const program = Effect.gen(function* () {
        const request = yield* Schema.decodeUnknown(Request)(parsed);

        const handler = handlers[request.method];
        if (!handler) {
          const errorResponse = new ErrorResponse({
            id: request.id,
            error: {
              code: "UNKNOWN_METHOD",
              message: `Unknown method: ${request.method}`,
            },
          });
          yield* Effect.sync(() => ws.send(JSON.stringify(errorResponse)));
          return;
        }

        yield* (handler(request, ws) as Effect.Effect<void, unknown, never>).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              const tag =
                error && typeof error === "object" && "_tag" in error
                  ? (error as { _tag: string })._tag
                  : null;
              const isSearchError =
                tag === "KimovilHttpError" ||
                tag === "KimovilInvalidResponseError" ||
                tag === "SearchBrowserError" ||
                tag === "SearchRetryExhaustedError";
              const isYandexError =
                tag === "YandexBrowserError" || tag === "YandexValidationError";
              const errorCode = isYandexError
                ? "YANDEX_SCRAPE_FAILED"
                : isSearchError
                  ? "SEARCH_FAILED"
                  : error instanceof ScrapeError
                    ? "SCRAPE_FAILED"
                    : "INTERNAL_ERROR";

              log.error(
                `WS:${request.method}`,
                `${errorCode}: ${error instanceof Error ? error.message : String(error)}`,
                error,
              );

              const errorResponse = new ErrorResponse({
                id: request.id,
                error: {
                  code: errorCode,
                  message:
                    error instanceof Error ? error.message : String(error),
                  details: error,
                },
              });
              yield* Effect.sync(() => ws.send(JSON.stringify(errorResponse)));
            }),
          ),
        );
      });

      LiveRuntime.runPromise(program).catch((error) => {
        console.error("Unhandled error:", error);
      });
    });

    socket.on("close", (code, reason) => {
      console.log(`Client disconnected: code=${code}, reason=${reason?.toString() || "none"}`);
      bulkJobManager.unsubscribeAll(ws);
      bulkJobManager.unsubscribeFromList(ws);
    });
  });

  return wss;
}
