import "dotenv/config";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";
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
  BulkListParams,
  BulkListResult,
  BulkJobWithStats,
  BulkPauseParams,
  BulkResumeParams,
  BulkSetWorkersParams,
  BulkControlResult,
  type JobType,
  type AiMode,
} from "@repo/scraper-protocol";
import { Schema } from "@effect/schema";
import { Effect, Stream } from "effect";
import {
  SearchService,
  SearchError,
  SearchEvent,
  ScrapeService,
  ScrapeError,
  ScrapeEvent,
} from "@repo/scraper-domain";
import { LiveLayer } from "./layers/live";
import {
  StorageService,
  type StorageService as StorageServiceType,
  type ScrapeMode,
  type JobQueueItem,
  type JobType as StorageJobType,
} from "./services/storage";
import {
  extractPhoneData,
  getHtmlValidationError,
  type RawPhoneData,
} from "./services/scrape-kimovil";
import { BrowserService } from "./services/browser";
import { OpenAIService } from "./services/openai";

type Services = {
  storage: StorageServiceType;
  scrapeService: ScrapeService;
};

// Minimal WebSocket type
type Ws = { send: (data: string) => void };

// Handler that returns a stream of events (may have different requirements)
type StreamHandler = (
  request: Request,
  ws: Ws,
) => Effect.Effect<void, unknown, unknown>;

// Type guard to distinguish SearchResult from SearchEvent
const isSearchResult = (
  item: SearchResult | SearchEvent,
): item is SearchResult => "options" in item;

// Type guard to distinguish ScrapeResult from ScrapeEvent
const isScrapeResult = (
  item: ScrapeResult | ScrapeEvent,
): item is ScrapeResult => "data" in item;

const BULK_CONCURRENCY = Math.max(
  1,
  Number(process.env.BULK_CONCURRENCY ?? "2") || 1,
);
const BULK_RATE_LIMIT_MS = Math.max(
  0,
  Number(process.env.BULK_RATE_LIMIT_MS ?? "1500") || 0,
);
const BULK_RETRY_BASE_MS = Math.max(
  1000,
  Number(process.env.BULK_RETRY_BASE_MS ?? "2000") || 2000,
);
const BULK_RETRY_MAX_MS = Math.max(
  BULK_RETRY_BASE_MS,
  Number(process.env.BULK_RETRY_MAX_MS ?? String(15 * 60 * 1000)) ||
    15 * 60 * 1000,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
};

const log = {
  info: (tag: string, msg: string) =>
    console.log(`[${new Date().toLocaleTimeString()}] [${tag}] ${msg}`),
  warn: (tag: string, msg: string) =>
    console.warn(`[${new Date().toLocaleTimeString()}] [${tag}] ⚠ ${msg}`),
  error: (tag: string, msg: string, err?: unknown) => {
    console.error(`[${new Date().toLocaleTimeString()}] [${tag}] ✗ ${msg}`);
    if (err) console.error(err);
  },
  success: (tag: string, msg: string) =>
    console.log(`[${new Date().toLocaleTimeString()}] [${tag}] ✓ ${msg}`),
};

const createRateLimiter = (minIntervalMs: number) => {
  let nextAvailableAt = 0;
  return async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextAvailableAt - now);
    nextAvailableAt = Math.max(nextAvailableAt, now) + minIntervalMs;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if ("message" in obj && typeof obj.message === "string") return obj.message;
    if ("_tag" in obj && "error" in obj) return getErrorMessage(obj.error);
    if ("cause" in obj) return getErrorMessage(obj.cause);
  }
  return String(error);
};

const classifyScrapeError = (error: unknown) => {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();
  const isBot =
    message.includes("Bot protection") ||
    message.includes("Access denied") ||
    message.includes("Page invalid: Bot protection");
  const isInvalid =
    message.includes("Page invalid") ||
    message.includes("Cached page invalid") ||
    message.includes("Missing expected content structure") ||
    message.includes("Missing main content element");
  const isTimeout =
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("navigation");
  const isNetwork =
    lower.includes("net::") ||
    lower.includes("network") ||
    lower.includes("connection");

  // Invalid HTML is NOT retryable - the cached HTML is corrupted and needs re-scraping
  const retryable = isBot || isTimeout || isNetwork;
  let code = "unknown";
  if (isBot) code = "bot";
  else if (isInvalid) code = "invalid_html";
  else if (isTimeout) code = "timeout";
  else if (isNetwork) code = "network";

  const validationMatch = message.match(
    /(Page invalid|Cached page invalid):\s*(.+)$/,
  );
  const validationReason = validationMatch?.[2] ?? null;

  return { retryable, code, message, validationReason };
};

const bulkWorkers = new Set<string>();
const bulkSubscribers = new Map<string, Set<Ws>>();
const bulkListSubscribers = new Set<Ws>();

interface JobControlState {
  workerCount: number;
  paused: boolean;
  requestId: string;
  activeWorkers: number;
}
const jobControlState = new Map<string, JobControlState>();

const getJobState = (jobId: string): JobControlState => {
  let state = jobControlState.get(jobId);
  if (!state) {
    state = {
      workerCount: BULK_CONCURRENCY,
      paused: false,
      requestId: "",
      activeWorkers: 0,
    };
    jobControlState.set(jobId, state);
  }
  return state;
};

const subscribeToBulkJob = (jobId: string, ws: Ws) => {
  let subs = bulkSubscribers.get(jobId);
  if (!subs) {
    subs = new Set();
    bulkSubscribers.set(jobId, subs);
  }
  subs.add(ws);
};

const unsubscribeFromBulkJob = (jobId: string, ws: Ws) => {
  const subs = bulkSubscribers.get(jobId);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) {
      bulkSubscribers.delete(jobId);
    }
  }
};

const unsubscribeFromAllBulkJobs = (ws: Ws) => {
  for (const [jobId, subs] of bulkSubscribers) {
    subs.delete(ws);
    if (subs.size === 0) {
      bulkSubscribers.delete(jobId);
    }
  }
};

const broadcastBulkProgress = (
  jobId: string,
  requestId: string,
  stats: {
    total: number;
    pending: number;
    running: number;
    done: number;
    error: number;
    timeout?: {
      count: number;
      nextRetryAt: number | null;
      nextRetrySlug: string | null;
    };
  },
  lastCompleted?: { slug: string; success: boolean; error: string | null },
) => {
  const subs = bulkSubscribers.get(jobId);
  if (!subs) return;

  const event = new StreamEvent({
    id: requestId,
    event: {
      type: "bulk.progress" as const,
      jobId,
      stats,
      lastCompleted,
    },
  });

  const message = JSON.stringify(event);
  for (const ws of subs) {
    try {
      ws.send(message);
    } catch {
      subs.delete(ws);
    }
  }
};

const broadcastBulkDone = (
  jobId: string,
  requestId: string,
  status: "done" | "error",
  stats: {
    total: number;
    pending: number;
    running: number;
    done: number;
    error: number;
    timeout?: {
      count: number;
      nextRetryAt: number | null;
      nextRetrySlug: string | null;
    };
  },
) => {
  const subs = bulkSubscribers.get(jobId);
  if (!subs) return;

  const event = new StreamEvent({
    id: requestId,
    event: {
      type: "bulk.done" as const,
      jobId,
      status,
      stats,
    },
  });

  const message = JSON.stringify(event);
  for (const ws of subs) {
    try {
      ws.send(message);
    } catch {}
  }
  bulkSubscribers.delete(jobId);
};

const broadcastJobUpdate = (
  jobId: string,
  status: "pending" | "running" | "paused" | "done" | "error",
  workerCount?: number,
  stats?: {
    total: number;
    pending: number;
    running: number;
    done: number;
    error: number;
    timeout?: {
      count: number;
      nextRetryAt: number | null;
      nextRetrySlug: string | null;
    };
  },
) => {
  if (bulkListSubscribers.size === 0) return;

  const event = new StreamEvent({
    id: "bulk-list",
    event: {
      type: "bulk.jobUpdate" as const,
      job: { id: jobId, status, workerCount },
      stats,
    },
  });

  const message = JSON.stringify(event);
  for (const ws of bulkListSubscribers) {
    try {
      ws.send(message);
    } catch {
      bulkListSubscribers.delete(ws);
    }
  }
};

const handlers: Record<string, StreamHandler> = {
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

      // Get the stream from service
      const stream = searchService.search(params.query);

      // Send a log event that we're starting
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

      // Process stream items
      let finalResult: SearchResult | null = null;

      yield* Stream.runForEach(stream, (item) =>
        Effect.gen(function* () {
          if (isSearchResult(item)) {
            // It's a SearchResult - save it for final response
            finalResult = item;
          } else {
            // It's a SearchEvent - send it immediately
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

      // Send final response
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

      // Send a log event that we're starting
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

      // Get the stream from service
      const stream = scrapeService.scrape(params.slug);

      // Process stream items
      let finalResult: ScrapeResult | null = null;

      yield* Stream.runForEach(stream, (item) =>
        Effect.gen(function* () {
          if (isScrapeResult(item)) {
            // It's a ScrapeResult - save it for final response
            finalResult = item;
          } else {
            // It's a ScrapeEvent - send it immediately
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

      // Send final response
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
      const storage = yield* StorageService;
      const jobType: StorageJobType =
        (params.jobType as StorageJobType) ?? "scrape";

      // Get target slugs based on job type and filter
      let targetSlugs: string[] = [];
      if (Array.isArray(params.slugs) && params.slugs.length > 0) {
        targetSlugs = Array.from(new Set(params.slugs));
      } else if (jobType === "scrape") {
        const allDevices = yield* storage.getAllDevices();
        const allSlugs = allDevices.map((d) => d.slug);
        if (params.filter === "all") {
          targetSlugs = allSlugs;
        } else {
          const scraped = yield* storage.getScrapedSlugs();
          const scrapedSet = new Set(scraped);
          targetSlugs = allSlugs.filter((slug) => !scrapedSet.has(slug));
        }
      } else if (jobType === "process_raw") {
        if (params.filter === "all") {
          targetSlugs = yield* storage.getScrapedSlugs();
        } else {
          // Default: needs_extraction (has HTML but no raw data)
          targetSlugs = yield* storage.getSlugsNeedingExtraction();
        }
      } else if (jobType === "process_ai") {
        if (params.filter === "all") {
          // All slugs that have raw data
          const allDevices = yield* storage.getAllDevices();
          const rawSlugs = new Set(
            (yield* storage.getSlugsNeedingAi()).concat(
              // Include already processed too for "all"
              (yield* storage.getScrapedSlugs()).filter(async () => {
                // This is a simplification - get all with raw data
                return true;
              }),
            ),
          );
          targetSlugs = allDevices
            .map((d) => d.slug)
            .filter((s) => rawSlugs.has(s));
        } else {
          // Default: needs_ai (has raw but no AI data)
          targetSlugs = yield* storage.getSlugsNeedingAi();
        }
      }

      const jobId = globalThis.crypto.randomUUID();
      const mode: ScrapeMode = params.mode ?? "fast";
      const job = yield* storage.createJob({
        id: jobId,
        jobType,
        mode,
        aiMode: params.aiMode ?? null,
        filter: params.filter ?? getDefaultFilter(jobType),
        totalCount: targetSlugs.length,
        queuedCount: 0,
      });

      const enqueueResult = yield* storage.enqueueJobSlugs(
        jobId,
        jobType,
        mode,
        targetSlugs,
      );

      yield* storage.updateBulkJobCounts(
        jobId,
        targetSlugs.length,
        enqueueResult.queued,
      );

      subscribeToBulkJob(jobId, ws);

      const stats = yield* storage.getJobStats(jobId);
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
        void runBulkJob(jobId, request.id);
      });
    }),

  "bulk.subscribe": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkSubscribeParams)(
        request.params,
      );
      const storage = yield* StorageService;

      const job = yield* storage.getJob(params.jobId);
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

      subscribeToBulkJob(params.jobId, ws);

      const stats = yield* storage.getJobStats(params.jobId);
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
      const storage = yield* StorageService;
      const allJobs = yield* storage.getAllJobs();

      const jobsWithStats: Array<{ job: BulkJobInfo; stats: BulkJobStats }> =
        [];
      for (const job of allJobs) {
        const stats = yield* storage.getJobStats(job.id);
        const timeout = yield* storage.getTimeoutStats(job.id);
        const state = jobControlState.get(job.id);
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
            workerCount: state?.workerCount ?? BULK_CONCURRENCY,
            batchRequestId: job.batchRequestId,
            batchStatus: job.batchStatus,
          }),
          stats: new BulkJobStats({
            ...stats,
            timeout: timeout.count > 0 ? timeout : undefined,
          }),
        });
      }

      bulkListSubscribers.add(ws);

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
      const storage = yield* StorageService;

      const job = yield* storage.getJob(params.jobId);
      if (!job || job.status !== "running") {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      const state = getJobState(params.jobId);
      state.paused = true;

      const unclaimedCount = yield* storage.unclaimRunningItems(params.jobId);
      yield* Effect.sync(() => {
        log.info(
          `Job:${params.jobId.slice(0, 8)}`,
          `⏸ Paused, unclaimed ${unclaimedCount} items`,
        );
      });

      yield* storage.updateJobStatus(params.jobId, "paused");

      const updatedJob = yield* storage.getJob(params.jobId);
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

      broadcastJobUpdate(params.jobId, "paused", state.workerCount);
    }),

  "bulk.resume": (request, ws) =>
    Effect.gen(function* () {
      const params = yield* Schema.decodeUnknown(BulkResumeParams)(
        request.params,
      );
      const storage = yield* StorageService;

      const job = yield* storage.getJob(params.jobId);
      if (!job) {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      if (job.status === "paused") {
        const state = getJobState(params.jobId);
        state.paused = false;
        yield* storage.updateJobStatus(params.jobId, "running");
        broadcastJobUpdate(params.jobId, "running", state.workerCount);
        yield* Effect.sync(() => {
          log.info(`Job:${params.jobId.slice(0, 8)}`, `▶ Resuming paused job`);
          void runBulkJob(params.jobId, request.id);
        });
      } else if (
        job.status === "pending" ||
        job.status === "error" ||
        job.status === "done"
      ) {
        yield* storage.resetStuckQueueItems(params.jobId);

        // Reset error items when retrying a job (either error status or done with failures)
        const stats = yield* storage.getJobStats(params.jobId);
        if (
          job.status === "error" ||
          (job.status === "done" && stats.error > 0)
        ) {
          const resetCount = yield* storage.resetErrorQueueItems(params.jobId);
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
          void runBulkJob(params.jobId, request.id);
        });
      }

      const updatedJob = yield* storage.getJob(params.jobId);
      const state = getJobState(params.jobId);
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
      const storage = yield* StorageService;

      const job = yield* storage.getJob(params.jobId);
      if (!job) {
        const result = new BulkControlResult({ success: false });
        const response = new Response({ id: request.id, result });
        yield* Effect.sync(() => ws.send(JSON.stringify(response)));
        return;
      }

      const state = getJobState(params.jobId);
      state.workerCount = Math.max(1, Math.min(50, params.workerCount));

      const stats = yield* storage.getJobStats(params.jobId);
      const timeout = yield* storage.getTimeoutStats(params.jobId);
      broadcastJobUpdate(params.jobId, job.status, state.workerCount, {
        ...stats,
        timeout: timeout.count > 0 ? timeout : undefined,
      });

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
};

const getServices = async () => {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService;
    const scrapeService = yield* ScrapeService;
    return { storage, scrapeService };
  });
  return Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<any, never, never>,
  ) as Promise<Services>;
};

type StatsWithTimeout = {
  total: number;
  pending: number;
  running: number;
  done: number;
  error: number;
  timeout?: {
    count: number;
    nextRetryAt: number | null;
    nextRetrySlug: string | null;
  };
};

const getStatsWithTimeout = async (
  storage: Services["storage"],
  jobId: string,
): Promise<StatsWithTimeout> => {
  const [stats, timeout] = await Promise.all([
    Effect.runPromise(storage.getBulkJobStats(jobId)),
    Effect.runPromise(storage.getTimeoutStats(jobId)),
  ]);
  return {
    ...stats,
    timeout: timeout.count > 0 ? timeout : undefined,
  };
};

const computeBackoffMs = (attemptNumber: number) => {
  const base = BULK_RETRY_BASE_MS * Math.pow(2, Math.max(0, attemptNumber - 1));
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(base + jitter, BULK_RETRY_MAX_MS);
};

type QueueItemResult = {
  slug: string;
  success: boolean;
  error: string | null;
  rescheduled: boolean;
};

const runQueueItem = async (
  item: JobQueueItem | null,
  storage: Services["storage"],
  scrapeService: Services["scrapeService"],
): Promise<QueueItemResult | null> => {
  if (!item) return null;
  const tag = `Queue:${item.id}`;
  const startTime = Date.now();
  const jobType = item.jobType ?? "scrape";
  log.info(tag, `Starting ${jobType} job: ${item.slug}`);

  try {
    if (jobType === "scrape") {
      // Original scrape logic
      const stream =
        item.mode === "fast"
          ? scrapeService.scrapeFast(item.slug)
          : scrapeService.scrape(item.slug);

      await Effect.runPromise(
        Stream.runForEach(stream, (event) =>
          Effect.sync(() => {
            if (!isScrapeResult(event) && event.type === "retry") {
              log.warn(
                tag,
                `Retry ${event.attempt}/${event.maxAttempts}: ${event.reason}`,
              );
            }
          }),
        ),
      );
      await Effect.runPromise(
        storage.recordVerification(item.slug, false, null),
      );
    } else if (jobType === "process_raw") {
      // Extract data from cached HTML
      await runProcessRaw(item.slug, storage);
    } else if (jobType === "process_ai") {
      // Process raw data through AI
      await runProcessAi(item.slug, storage);
    }

    const duration = Date.now() - startTime;
    log.success(tag, `Completed ${item.slug} in ${formatDuration(duration)}`);
    await Effect.runPromise(storage.completeQueueItem(item.id));
    return { slug: item.slug, success: true, error: null, rescheduled: false };
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(
      tag,
      `Failed ${item.slug} after ${formatDuration(duration)}`,
      error,
    );
    const { retryable, code, message, validationReason } =
      classifyScrapeError(error);
    if (validationReason) {
      await Effect.runPromise(
        storage.recordVerification(item.slug, true, validationReason),
      );
    }

    const attemptNumber = item.attempt + 1;
    if (retryable && attemptNumber < item.maxAttempts) {
      const delayMs = computeBackoffMs(attemptNumber);
      const nextAttemptAt = Math.floor((Date.now() + delayMs) / 1000);
      await Effect.runPromise(
        storage.rescheduleQueueItem(item.id, nextAttemptAt, message, code),
      );
      log.warn(
        tag,
        `Rescheduled in ${formatDuration(delayMs)} (${code}): ${message}`,
      );
      return {
        slug: item.slug,
        success: false,
        error: message,
        rescheduled: true,
      };
    }

    log.error(tag, `Permanently failed: ${message}`);
    await Effect.runPromise(storage.completeQueueItem(item.id, message));
    return {
      slug: item.slug,
      success: false,
      error: message,
      rescheduled: false,
    };
  }
};

// Process raw HTML to extract phone data
const runProcessRaw = async (
  slug: string,
  storage: Services["storage"],
): Promise<void> => {
  // Get cached HTML
  const html = await Effect.runPromise(storage.getRawHtml(slug));
  if (!html) {
    throw new Error(`No cached HTML for slug: ${slug}`);
  }

  // Validate HTML
  const validationError = getHtmlValidationError(html);
  if (validationError) {
    throw new Error(`Page invalid: ${validationError}`);
  }

  // Extract data using Playwright to parse HTML (local browser for cache parsing)
  const browser = await Effect.runPromise(
    Effect.flatMap(BrowserService, (s) => s.createLocalBrowser()).pipe(
      Effect.provide(LiveLayer),
    ),
  );
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rawData = await extractPhoneData(page, slug);
    await Effect.runPromise(
      storage.savePhoneDataRaw(
        slug,
        rawData as unknown as Record<string, unknown>,
      ),
    );
  } finally {
    await page.close();
    await browser.close();
  }
};

// Process raw data through AI normalization
const runProcessAi = async (
  slug: string,
  storage: Services["storage"],
): Promise<void> => {
  // Get raw phone data
  const rawData = await Effect.runPromise(storage.getPhoneDataRaw(slug));
  if (!rawData) {
    throw new Error(`No raw data for slug: ${slug}`);
  }

  // Process through OpenAI/Gemini
  const normalized = await Effect.runPromise(
    Effect.flatMap(OpenAIService, (s) => s.adaptScrapedData(rawData)).pipe(
      Effect.provide(LiveLayer),
    ),
  );

  // Save normalized data
  await Effect.runPromise(
    storage.savePhoneData(slug, normalized as Record<string, unknown>),
  );
};

const runBulkJob = async (jobId: string, requestId: string) => {
  const tag = `Job:${jobId.slice(0, 8)}`;
  const jobStart = Date.now();
  log.info(tag, `Starting bulk job`);

  if (bulkWorkers.has(jobId)) {
    log.warn(tag, `Already running, skipping`);
    return;
  }
  bulkWorkers.add(jobId);

  const state = getJobState(jobId);
  state.requestId = requestId;
  state.paused = false;

  try {
    const { storage, scrapeService } = await getServices();
    await Effect.runPromise(storage.updateBulkJobStatus(jobId, "running"));
    broadcastJobUpdate(jobId, "running", state.workerCount);

    const initialStats = await getStatsWithTimeout(storage, jobId);
    log.info(
      tag,
      `Queue: ${initialStats.pending} pending, ${initialStats.done} done, ${initialStats.error} errors${initialStats.timeout ? `, ${initialStats.timeout.count} in timeout` : ""}`,
    );
    broadcastBulkProgress(jobId, requestId, initialStats);

    const rateLimit = createRateLimiter(BULK_RATE_LIMIT_MS);
    let lastProgressLog = Date.now();

    const worker = async (workerId: number) => {
      const wtag = `${tag}:W${workerId}`;
      let wasActive = false;

      while (true) {
        if (state.paused) {
          if (wasActive) log.info(wtag, `Paused, exiting`);
          break;
        }

        // Wait if this worker is above the current limit
        if (workerId >= state.workerCount) {
          if (wasActive) {
            log.info(wtag, `Stopping (worker count reduced)`);
            wasActive = false;
          }
          // Check if queue is empty - exit if so (don't loop forever)
          const stats = await Effect.runPromise(storage.getBulkJobStats(jobId));
          if (stats.pending === 0 && stats.running === 0) {
            break;
          }
          await sleep(1000);
          continue;
        }

        // Worker became active
        if (!wasActive) {
          log.info(wtag, `Worker started`);
          wasActive = true;
        }

        const item = await Effect.runPromise(storage.claimNextQueueItem(jobId));
        if (!item) {
          const stats = await Effect.runPromise(storage.getBulkJobStats(jobId));
          if (stats.pending === 0 && stats.running === 0) {
            log.info(wtag, `Queue empty, exiting`);
            break;
          }
          await sleep(3000);
          continue;
        }

        state.activeWorkers++;
        try {
          await rateLimit();

          if (state.paused) {
            log.info(wtag, `Paused before scrape, unclaiming ${item.slug}`);
            await Effect.runPromise(storage.unclaimRunningItems(jobId));
            state.activeWorkers--;
            break;
          }

          const result = await runQueueItem(item, storage, scrapeService);
          if (result && !result.rescheduled) {
            const stats = await getStatsWithTimeout(storage, jobId);
            broadcastBulkProgress(jobId, requestId, stats, {
              slug: result.slug,
              success: result.success,
              error: result.error,
            });
            broadcastJobUpdate(jobId, "running", state.workerCount, stats);

            if (Date.now() - lastProgressLog > 30000) {
              const elapsed = formatDuration(Date.now() - jobStart);
              const pct = Math.round(
                ((stats.done + stats.error) / stats.total) * 100,
              );
              log.info(
                tag,
                `Progress: ${pct}% (${stats.done}/${stats.total}) after ${elapsed}`,
              );
              lastProgressLog = Date.now();
            }
          }
        } catch (err) {
          log.error(wtag, `Unexpected error`, err);
        } finally {
          state.activeWorkers--;
        }
      }
    };

    log.info(
      tag,
      `Spawning ${state.workerCount} workers (rate limit: ${BULK_RATE_LIMIT_MS}ms)`,
    );
    const maxWorkers = 50;
    const workers = Array.from({ length: maxWorkers }, (_, i) => worker(i));
    await Promise.all(workers);

    const totalDuration = formatDuration(Date.now() - jobStart);
    const stats = await getStatsWithTimeout(storage, jobId);

    if (state.paused) {
      log.info(tag, `⏸ Workers stopped (paused after ${totalDuration})`);
      return;
    }

    // Mark as "done" even with some failures - "error" is for fatal job errors
    const finalStatus = "done";
    const hasErrors = stats.error > 0;

    if (hasErrors) {
      log.warn(
        tag,
        `Completed with ${stats.error} failures: ${stats.done} done, ${stats.error} failed in ${totalDuration}`,
      );
    } else {
      log.success(tag, `Completed: ${stats.done} items in ${totalDuration}`);
    }

    await Effect.runPromise(storage.updateBulkJobStatus(jobId, finalStatus));
    broadcastBulkDone(jobId, requestId, finalStatus, stats);
    broadcastJobUpdate(jobId, finalStatus, state.workerCount, stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(tag, `Fatal error: ${message}`);
    const { storage } = await getServices();
    await Effect.runPromise(
      storage.updateBulkJobStatus(jobId, "error", message),
    );
    const stats = await getStatsWithTimeout(storage, jobId);
    broadcastBulkDone(jobId, requestId, "error", stats);
    broadcastJobUpdate(jobId, "error", state.workerCount, stats);
  } finally {
    bulkWorkers.delete(jobId);
    if (!state.paused) {
      jobControlState.delete(jobId);
    }
  }
};

const app = new Elysia({ adapter: node() })
  .use(cors())
  .get("/api/slugs", async ({ query }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const devices = yield* storage.getAllDevices();
      const corruptedSlugs = yield* storage.getCorruptedSlugs();
      const validSlugs = yield* storage.getValidSlugs();
      const scrapedSlugs = yield* storage.getScrapedSlugs();
      const rawDataSlugs = yield* storage.getRawDataSlugs();
      const aiDataSlugs = yield* storage.getAiDataSlugs();
      const rawDataCount = yield* storage.getPhoneDataRawCount();
      const aiDataCount = yield* storage.getPhoneDataCount();
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
    } = await Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );

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

    let filtered = devices;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (d: any) =>
          d.name.toLowerCase().includes(search) ||
          d.slug.toLowerCase().includes(search) ||
          d.brand?.toLowerCase().includes(search),
      );
    }

    // Apply status filter
    if (filter === "corrupted") {
      filtered = filtered.filter((d: any) => corruptedSet.has(d.slug));
    } else if (filter === "valid") {
      filtered = filtered.filter((d: any) => validSet.has(d.slug));
    } else if (filter === "scraped") {
      filtered = filtered.filter((d: any) => scrapedSet.has(d.slug));
    } else if (filter === "unscraped") {
      filtered = filtered.filter((d: any) => !scrapedSet.has(d.slug));
    } else if (filter === "has_raw") {
      filtered = filtered.filter((d: any) => rawDataSet.has(d.slug));
    } else if (filter === "has_ai") {
      filtered = filtered.filter((d: any) => aiDataSet.has(d.slug));
    } else if (filter === "needs_raw") {
      filtered = filtered.filter(
        (d: any) => scrapedSet.has(d.slug) && !rawDataSet.has(d.slug),
      );
    } else if (filter === "needs_ai") {
      filtered = filtered.filter(
        (d: any) => rawDataSet.has(d.slug) && !aiDataSet.has(d.slug),
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
  .get("/api/slugs/stats", async () => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const deviceCount = yield* storage.getDeviceCount();
      const pendingCount = yield* storage.getPendingPrefixCount();
      return { devices: deviceCount, pendingPrefixes: pendingCount };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .post("/api/scrape/queue", async ({ body }) => {
    const { slug, mode } = body as { slug: string; mode: ScrapeMode };
    if (!slug || !mode) {
      return { error: "slug and mode are required" };
    }
    if (mode !== "fast" && mode !== "complex") {
      return { error: "mode must be 'fast' or 'complex'" };
    }

    const queueProgram = Effect.gen(function* () {
      const storage = yield* StorageService;
      const item = yield* storage.queueScrape(slug, mode);
      return item;
    });

    const item = await Effect.runPromise(
      queueProgram.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );

    void (async () => {
      const { storage, scrapeService } = await getServices();
      await Effect.runPromise(storage.startQueueItem(item.id));
      await runQueueItem(item, storage, scrapeService);
    })();

    return item;
  })
  .get("/api/scrape/html/:slug", async ({ params }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const html = yield* storage.getRawHtml(params.slug);
      return { slug: params.slug, html };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .delete("/api/scrape/html/:slug", async ({ params }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      yield* storage.clearScrapeData(params.slug);
      return { success: true, slug: params.slug };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/scrape/status", async ({ query }) => {
    const slugsParam = query.slugs as string;
    if (!slugsParam) {
      return { error: "slugs parameter required" };
    }
    const slugs = slugsParam.split(",");

    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
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
        const hasHtml = yield* storage.hasScrapedHtml(slug);
        const hasRawData = yield* storage.hasPhoneDataRaw(slug);
        const hasAiData = yield* storage.hasPhoneData(slug);
        const queueItem = yield* storage.getQueueItemBySlug(slug);
        const verification = yield* storage.getVerificationStatus(slug);
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

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .post("/api/scrape/verify", async ({ body }) => {
    const { slugs } = body as { slugs: string[] };
    if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
      return { error: "slugs array required" };
    }

    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const results: Record<
        string,
        { isCorrupted: boolean; reason: string | null }
      > = {};

      for (const slug of slugs) {
        const result = yield* storage.verifyHtml(slug);
        results[slug] = result;
      }

      const corrupted = Object.values(results).filter(
        (r) => r.isCorrupted,
      ).length;
      const valid = Object.values(results).filter((r) => !r.isCorrupted).length;

      return { results, summary: { total: slugs.length, corrupted, valid } };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/scrape/queue", async ({ query }) => {
    const status = query.status as string | undefined;

    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const items = yield* storage.getQueueItems(
        status as "pending" | "running" | "done" | "error" | undefined,
      );
      return { items };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/scrape/queue/:slug", async ({ params }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const item = yield* storage.getQueueItemBySlug(params.slug);
      return item;
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/phone-data/raw/:slug", async ({ params }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const data = yield* storage.getPhoneDataRaw(params.slug);
      return { slug: params.slug, data };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/phone-data/:slug", async ({ params }) => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const data = yield* storage.getPhoneData(params.slug);
      return { slug: params.slug, data };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .get("/api/bulk/:jobId/errors", async ({ params, query }) => {
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 100));
    const program = Effect.gen(function* () {
      const storage = yield* StorageService;
      const items = yield* storage.getErrorQueueItems(params.jobId, limit);
      return {
        items: items.map((item) => ({
          slug: item.slug,
          error: item.errorMessage,
          errorCode: item.lastErrorCode,
          attempt: item.attempt,
          updatedAt: item.updatedAt,
        })),
        total: items.length,
      };
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
        any,
        never,
        never
      >,
    );
  })
  .post("/api/scrape/run-next", async () => {
    const { storage, scrapeService } = await getServices();
    const item = await Effect.runPromise(storage.claimNextQueueItem());
    if (!item) {
      return { message: "No pending items in queue" };
    }
    await runQueueItem(item, storage, scrapeService);
    return { success: true, item };
  })
  .post("/api/process/raw", async ({ body }) => {
    const { slug } = body as { slug: string };
    if (!slug) {
      return { success: false, error: "slug is required" };
    }

    try {
      const { storage } = await getServices();
      await runProcessRaw(slug, storage);
      return { success: true, slug };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("ProcessRaw", `Failed for ${slug}: ${message}`);
      return { success: false, error: message };
    }
  })
  .post("/api/process/ai", async ({ body }) => {
    const { slug } = body as { slug: string };
    if (!slug) {
      return { success: false, error: "slug is required" };
    }

    try {
      const { storage } = await getServices();
      await runProcessAi(slug, storage);
      return { success: true, slug };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("ProcessAi", `Failed for ${slug}: ${message}`);
      return { success: false, error: message };
    }
  })
  .ws("/ws", {
    open(ws: Ws) {
      console.log("Client connected");
    },

    message(ws: Ws, message: unknown) {
      const program = Effect.gen(function* () {
        // Parse message - in Node adapter it may come as string/Buffer
        let parsed: unknown = message;
        if (typeof message === "string") {
          parsed = JSON.parse(message);
        } else if (Buffer.isBuffer(message)) {
          parsed = JSON.parse(message.toString());
        }
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

        // Run handler and catch errors
        yield* handler(request, ws).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              const errorCode =
                error instanceof SearchError
                  ? "SEARCH_FAILED"
                  : error instanceof ScrapeError
                    ? "SCRAPE_FAILED"
                    : "INTERNAL_ERROR";
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

      Effect.runPromise(
        program.pipe(Effect.provide(LiveLayer)) as Effect.Effect<
          void,
          never,
          never
        >,
      ).catch((error) => {
        console.error("Unhandled error:", error);
      });
    },

    close(ws: Ws) {
      console.log("Client disconnected");
      unsubscribeFromAllBulkJobs(ws);
      bulkListSubscribers.delete(ws);
    },
  })
  .listen(1488);

const resumeStuckJobs = async () => {
  try {
    const { storage } = await getServices();
    const allJobs = await Effect.runPromise(storage.getAllJobs());
    const stuckJobs = allJobs.filter(
      (j) => j.status === "running" || j.status === "paused",
    );

    if (stuckJobs.length === 0) {
      log.info("Startup", "No stuck jobs to resume");
      return;
    }

    log.info("Startup", `Found ${stuckJobs.length} stuck job(s)`);

    for (const job of stuckJobs) {
      const resetCount = await Effect.runPromise(
        storage.resetStuckQueueItems(job.id),
      );

      // Check if job is actually complete (all items done/error)
      const stats = await Effect.runPromise(storage.getJobStats(job.id));
      const isComplete = stats.pending === 0 && stats.running === 0;

      if (isComplete) {
        // Job finished but status wasn't updated - mark as done
        log.info(
          "Startup",
          `Job ${job.id.slice(0, 8)} already complete (${stats.done} done, ${stats.error} errors) - marking done`,
        );
        await Effect.runPromise(storage.updateJobStatus(job.id, "done"));
      } else if (job.status === "paused") {
        // Keep paused jobs paused, just reset any stuck items
        log.info(
          "Startup",
          `Keeping job ${job.id.slice(0, 8)} paused (reset ${resetCount} stuck items)`,
        );
        // Initialize in-memory state as paused
        const state = getJobState(job.id);
        state.paused = true;
      } else {
        // Resume running jobs
        log.info(
          "Startup",
          `Resuming job ${job.id.slice(0, 8)} (reset ${resetCount} stuck items)`,
        );
        await Effect.runPromise(storage.updateJobStatus(job.id, "running"));
        void runBulkJob(job.id, `startup-${job.id}`);
      }
    }
  } catch (error) {
    log.error("Startup", "Failed to resume stuck jobs", error);
  }
};

console.log("");
console.log("╔════════════════════════════════════════════════╗");
console.log("║         SCRAPER SERVER STARTING                ║");
console.log("╠════════════════════════════════════════════════╣");
console.log(`║  WebSocket: ws://localhost:1488/ws             ║`);
console.log(`║  API:       http://localhost:1488/api          ║`);
console.log(
  `║  Workers:   ${BULK_CONCURRENCY} concurrent (rate: ${BULK_RATE_LIMIT_MS}ms)      ║`,
);
console.log("╚════════════════════════════════════════════════╝");
console.log("");

resumeStuckJobs();
