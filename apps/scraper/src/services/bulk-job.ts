import { Effect, Stream, Context } from "effect";
import { StreamEvent, BulkJobStats } from "@repo/scraper-protocol";
import { ScrapeService, ScrapeEvent } from "@repo/scraper-domain";
import type { RawPhoneData } from "@repo/scraper-domain";
import { config } from "../config";
import { log } from "../utils/logger";
import type { LiveRuntimeType } from "../layers/live";
import { sleep, formatDuration, createRateLimiter } from "../utils/helpers";
import { classifyScrapeError } from "../utils/errors";
import { HtmlCacheService as HtmlCacheTag } from "./html-cache";
import { PhoneDataService as PhoneDataTag } from "./phone-data";
import {
  JobQueueService as JobQueueTag,
  type JobQueueItem,
  type JobType,
} from "./job-queue";
import { BrowserService } from "./browser";
import { RobotService } from "./robot";
import { extractPhoneData, getHtmlValidationError } from "./kimovil";
import { ScrapeResult } from "@repo/scraper-protocol";

export type Ws = { send: (data: string) => void };

type Services = {
  htmlCache: Context.Tag.Service<typeof HtmlCacheTag>;
  phoneData: Context.Tag.Service<typeof PhoneDataTag>;
  jobQueue: Context.Tag.Service<typeof JobQueueTag>;
  scrapeService: ScrapeService;
};

interface JobControlState {
  workerCount: number;
  paused: boolean;
  requestId: string;
  activeWorkers: number;
}

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

type QueueItemResult = {
  slug: string;
  success: boolean;
  error: string | null;
  rescheduled: boolean;
};

const isScrapeResult = (
  item: ScrapeResult | ScrapeEvent
): item is ScrapeResult => "data" in item;

export class BulkJobManager {
  private workers = new Set<string>();
  private subscribers = new Map<string, Set<Ws>>();
  private listSubscribers = new Set<Ws>();
  private jobState = new Map<string, JobControlState>();
  private runtime: LiveRuntimeType;

  constructor(runtime: LiveRuntimeType) {
    this.runtime = runtime;
  }

  getJobState(jobId: string): JobControlState {
    let state = this.jobState.get(jobId);
    if (!state) {
      state = {
        workerCount: config.bulk.concurrency,
        paused: false,
        requestId: "",
        activeWorkers: 0,
      };
      this.jobState.set(jobId, state);
    }
    return state;
  }

  subscribe(jobId: string, ws: Ws) {
    let subs = this.subscribers.get(jobId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(jobId, subs);
    }
    subs.add(ws);
  }

  unsubscribe(jobId: string, ws: Ws) {
    const subs = this.subscribers.get(jobId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.subscribers.delete(jobId);
      }
    }
  }

  unsubscribeAll(ws: Ws) {
    for (const [jobId, subs] of this.subscribers) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.subscribers.delete(jobId);
      }
    }
  }

  subscribeToList(ws: Ws) {
    this.listSubscribers.add(ws);
  }

  unsubscribeFromList(ws: Ws) {
    this.listSubscribers.delete(ws);
  }

  broadcastProgress(
    jobId: string,
    requestId: string,
    stats: StatsWithTimeout,
    lastCompleted?: { slug: string; success: boolean; error: string | null }
  ) {
    const subs = this.subscribers.get(jobId);
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
  }

  broadcastDone(
    jobId: string,
    requestId: string,
    status: "done" | "error",
    stats: StatsWithTimeout
  ) {
    const subs = this.subscribers.get(jobId);
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
    this.subscribers.delete(jobId);
  }

  broadcastJobUpdate(
    jobId: string,
    status: "pending" | "running" | "paused" | "done" | "error",
    workerCount?: number,
    stats?: StatsWithTimeout
  ) {
    if (this.listSubscribers.size === 0) return;

    const event = new StreamEvent({
      id: "bulk-list",
      event: {
        type: "bulk.jobUpdate" as const,
        job: { id: jobId, status, workerCount },
        stats,
      },
    });

    const message = JSON.stringify(event);
    for (const ws of this.listSubscribers) {
      try {
        ws.send(message);
      } catch {
        this.listSubscribers.delete(ws);
      }
    }
  }

  private async getServices(): Promise<Services> {
    const program = Effect.gen(function* () {
      const htmlCache = yield* HtmlCacheTag;
      const phoneData = yield* PhoneDataTag;
      const jobQueue = yield* JobQueueTag;
      const scrapeService = yield* ScrapeService;
      return { htmlCache, phoneData, jobQueue, scrapeService };
    });
    return this.runtime.runPromise(program);
  }

  private async getStatsWithTimeout(
    jobQueue: Services["jobQueue"],
    jobId: string
  ): Promise<StatsWithTimeout> {
    const [stats, timeout] = await Promise.all([
      Effect.runPromise(jobQueue.getJobStats(jobId)),
      Effect.runPromise(jobQueue.getTimeoutStats(jobId)),
    ]);
    return {
      ...stats,
      timeout: timeout.count > 0 ? timeout : undefined,
    };
  }

  private computeBackoffMs(attemptNumber: number): number {
    const base =
      config.bulk.retryBaseMs * Math.pow(2, Math.max(0, attemptNumber - 1));
    const jitter = Math.floor(Math.random() * 1000);
    return Math.min(base + jitter, config.bulk.retryMaxMs);
  }

  private async runProcessRaw(
    slug: string,
    services: {
      htmlCache: Services["htmlCache"];
      phoneData: Services["phoneData"];
    }
  ): Promise<void> {
    const html = await Effect.runPromise(services.htmlCache.getRawHtml(slug));
    if (!html) {
      throw new Error(`No cached HTML for slug: ${slug}`);
    }

    const validationError = getHtmlValidationError(html);
    if (validationError) {
      throw new Error(`Page invalid: ${validationError}`);
    }

    await this.runtime.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const browserService = yield* BrowserService;
          const browser = yield* browserService.createLocalBrowserScoped();
          const page = yield* Effect.promise(() => browser.newPage());
          yield* Effect.addFinalizer(() =>
            Effect.promise(() => page.close().catch(() => {}))
          );
          yield* Effect.promise(() =>
            page.setContent(html, { waitUntil: "domcontentloaded" })
          );
          const result = yield* extractPhoneData(page, slug);
          yield* services.phoneData.saveRaw(
            slug,
            result.data as unknown as Record<string, unknown>
          );
        })
      )
    );
  }

  private async runProcessAi(
    slug: string,
    phoneData: Services["phoneData"]
  ): Promise<void> {
    const rawData = await Effect.runPromise(phoneData.getRaw(slug));
    if (!rawData) {
      throw new Error(`No raw data for slug: ${slug}`);
    }

    const normalized = await this.runtime.runPromise(
      Effect.flatMap(RobotService, (s) => s.adaptScrapedData(rawData as unknown as RawPhoneData))
    );

    await Effect.runPromise(
      phoneData.save(slug, normalized as Record<string, unknown>)
    );
  }

  async runQueueItem(
    item: JobQueueItem | null,
    services: {
      htmlCache: Services["htmlCache"];
      phoneData: Services["phoneData"];
      jobQueue: Services["jobQueue"];
    },
    scrapeService: ScrapeService
  ): Promise<QueueItemResult | null> {
    if (!item) return null;
    const tag = `Queue:${item.id}`;
    const startTime = Date.now();
    const jobType = item.jobType ?? "scrape";
    log.info(tag, `Starting ${jobType} job: ${item.slug}`);

    try {
      if (jobType === "scrape") {
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
                  `Retry ${event.attempt}/${event.maxAttempts}: ${event.reason}`
                );
              }
            })
          )
        );
        await Effect.runPromise(
          services.htmlCache.recordVerification(item.slug, false, null)
        );
      } else if (jobType === "process_raw") {
        await this.runProcessRaw(item.slug, {
          htmlCache: services.htmlCache,
          phoneData: services.phoneData,
        });
      } else if (jobType === "process_ai") {
        await this.runProcessAi(item.slug, services.phoneData);
      }

      const duration = Date.now() - startTime;
      log.success(tag, `Completed ${item.slug} in ${formatDuration(duration)}`);
      await Effect.runPromise(services.jobQueue.completeQueueItem(item.id));
      return {
        slug: item.slug,
        success: true,
        error: null,
        rescheduled: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error(
        tag,
        `Failed ${item.slug} after ${formatDuration(duration)}`,
        error
      );
      const { retryable, code, message, validationReason } =
        classifyScrapeError(error);
      if (validationReason) {
        await Effect.runPromise(
          services.htmlCache.recordVerification(
            item.slug,
            true,
            validationReason
          )
        );
      }

      const attemptNumber = item.attempt + 1;
      if (retryable && attemptNumber < item.maxAttempts) {
        const delayMs = this.computeBackoffMs(attemptNumber);
        const nextAttemptAt = Math.floor((Date.now() + delayMs) / 1000);
        await Effect.runPromise(
          services.jobQueue.rescheduleQueueItem(
            item.id,
            nextAttemptAt,
            message,
            code
          )
        );
        log.warn(
          tag,
          `Rescheduled in ${formatDuration(delayMs)} (${code}): ${message}`
        );
        return {
          slug: item.slug,
          success: false,
          error: message,
          rescheduled: true,
        };
      }

      log.error(tag, `Permanently failed: ${message}`);
      await Effect.runPromise(
        services.jobQueue.completeQueueItem(item.id, message)
      );
      return {
        slug: item.slug,
        success: false,
        error: message,
        rescheduled: false,
      };
    }
  }

  async runJob(jobId: string, requestId: string) {
    const tag = `Job:${jobId.slice(0, 8)}`;
    const jobStart = Date.now();
    log.info(tag, `Starting bulk job`);

    if (this.workers.has(jobId)) {
      log.warn(tag, `Already running, skipping`);
      return;
    }
    this.workers.add(jobId);

    const state = this.getJobState(jobId);
    state.requestId = requestId;
    state.paused = false;

    try {
      const { htmlCache, phoneData, jobQueue, scrapeService } =
        await this.getServices();
      await Effect.runPromise(jobQueue.updateJobStatus(jobId, "running"));
      this.broadcastJobUpdate(jobId, "running", state.workerCount);

      const initialStats = await this.getStatsWithTimeout(jobQueue, jobId);
      log.info(
        tag,
        `Queue: ${initialStats.pending} pending, ${initialStats.done} done, ${
          initialStats.error
        } errors${
          initialStats.timeout
            ? `, ${initialStats.timeout.count} in timeout`
            : ""
        }`
      );
      this.broadcastProgress(jobId, requestId, initialStats);

      const rateLimit = createRateLimiter(config.bulk.rateLimitMs);
      let lastProgressLog = Date.now();

      const worker = async (workerId: number) => {
        const wtag = `${tag}:W${workerId}`;
        let wasActive = false;

        while (true) {
          if (state.paused) {
            if (wasActive) log.info(wtag, `Paused, exiting`);
            break;
          }

          if (workerId >= state.workerCount) {
            if (wasActive) {
              log.info(wtag, `Stopping (worker count reduced)`);
              wasActive = false;
            }
            const stats = await Effect.runPromise(jobQueue.getJobStats(jobId));
            if (stats.pending === 0 && stats.running === 0) {
              break;
            }
            await sleep(1000);
            continue;
          }

          if (!wasActive) {
            log.info(wtag, `Worker started`);
            wasActive = true;
          }

          const item = await Effect.runPromise(
            jobQueue.claimNextQueueItem(jobId)
          );
          if (!item) {
            const stats = await Effect.runPromise(jobQueue.getJobStats(jobId));
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
              await Effect.runPromise(jobQueue.unclaimRunningItems(jobId));
              state.activeWorkers--;
              break;
            }

            const result = await this.runQueueItem(
              item,
              { htmlCache, phoneData, jobQueue },
              scrapeService
            );
            if (result && !result.rescheduled) {
              const stats = await this.getStatsWithTimeout(jobQueue, jobId);
              this.broadcastProgress(jobId, requestId, stats, {
                slug: result.slug,
                success: result.success,
                error: result.error,
              });
              this.broadcastJobUpdate(
                jobId,
                "running",
                state.workerCount,
                stats
              );

              if (Date.now() - lastProgressLog > 30000) {
                const elapsed = formatDuration(Date.now() - jobStart);
                const pct = Math.round(
                  ((stats.done + stats.error) / stats.total) * 100
                );
                log.info(
                  tag,
                  `Progress: ${pct}% (${stats.done}/${stats.total}) after ${elapsed}`
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
        `Spawning ${state.workerCount} workers (rate limit: ${config.bulk.rateLimitMs}ms)`
      );
      const maxWorkers = 50;
      const workers = Array.from({ length: maxWorkers }, (_, i) => worker(i));
      await Promise.all(workers);

      const totalDuration = formatDuration(Date.now() - jobStart);
      const stats = await this.getStatsWithTimeout(jobQueue, jobId);

      if (state.paused) {
        log.info(tag, `⏸ Workers stopped (paused after ${totalDuration})`);
        return;
      }

      const finalStatus = "done";
      const hasErrors = stats.error > 0;

      if (hasErrors) {
        log.warn(
          tag,
          `Completed with ${stats.error} failures: ${stats.done} done, ${stats.error} failed in ${totalDuration}`
        );
      } else {
        log.success(tag, `Completed: ${stats.done} items in ${totalDuration}`);
      }

      await Effect.runPromise(jobQueue.updateJobStatus(jobId, finalStatus));
      this.broadcastDone(jobId, requestId, finalStatus, stats);
      this.broadcastJobUpdate(jobId, finalStatus, state.workerCount, stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(tag, `Fatal error: ${message}`);
      const { jobQueue: jq } = await this.getServices();
      await Effect.runPromise(jq.updateJobStatus(jobId, "error", message));
      const stats = await this.getStatsWithTimeout(jq, jobId);
      this.broadcastDone(jobId, requestId, "error", stats);
      this.broadcastJobUpdate(jobId, "error", state.workerCount, stats);
    } finally {
      this.workers.delete(jobId);
      if (!state.paused) {
        this.jobState.delete(jobId);
      }
    }
  }

  async resumeStuckJobs() {
    try {
      const { jobQueue } = await this.getServices();
      const allJobs = await Effect.runPromise(jobQueue.getAllJobs());
      const stuckJobs = allJobs.filter(
        (j) => j.status === "running" || j.status === "paused"
      );

      if (stuckJobs.length === 0) {
        log.info("Startup", "No stuck jobs to resume");
        return;
      }

      log.info("Startup", `Found ${stuckJobs.length} stuck job(s)`);

      for (const job of stuckJobs) {
        const resetCount = await Effect.runPromise(
          jobQueue.resetStuckQueueItems(job.id)
        );

        const stats = await Effect.runPromise(jobQueue.getJobStats(job.id));
        const isComplete = stats.pending === 0 && stats.running === 0;

        if (isComplete) {
          log.info(
            "Startup",
            `Job ${job.id.slice(0, 8)} already complete (${stats.done} done, ${
              stats.error
            } errors) - marking done`
          );
          await Effect.runPromise(jobQueue.updateJobStatus(job.id, "done"));
        } else if (job.status === "paused") {
          log.info(
            "Startup",
            `Keeping job ${job.id.slice(
              0,
              8
            )} paused (reset ${resetCount} stuck items)`
          );
          const state = this.getJobState(job.id);
          state.paused = true;
        } else {
          log.info(
            "Startup",
            `Resuming job ${job.id.slice(
              0,
              8
            )} (reset ${resetCount} stuck items)`
          );
          await Effect.runPromise(jobQueue.updateJobStatus(job.id, "running"));
          void this.runJob(job.id, `startup-${job.id}`);
        }
      }
    } catch (error) {
      log.error("Startup", "Failed to resume stuck jobs", error);
    }
  }
}
