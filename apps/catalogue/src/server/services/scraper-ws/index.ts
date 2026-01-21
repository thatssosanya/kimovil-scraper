import { ScraperWSConnection } from "./connection";
import { ScraperWSClient, type ScrapingService } from "./client";
import { logger } from "../logger";
import { JOB_TIMEOUTS, ACK_TIMEOUT } from "../job-manager/types";

declare global {
  // eslint-disable-next-line no-var
  var _scraperWSServiceInstance: ScraperWSService | undefined;
}

export class ScraperWSService {
  private connection: ScraperWSConnection;
  private client: ScraperWSClient;
  private isInitialized = false;

  private constructor(url: string) {
    this.connection = ScraperWSConnection.getInstance(url);
    this.client = new ScraperWSClient(this.connection);
    
    // Register reconnection handler to mark stale jobs as interrupted
    this.connection.onReconnect(() => this.handleReconnect());
  }

  static getInstance(url?: string): ScraperWSService {
    if (!globalThis._scraperWSServiceInstance) {
      if (!url) {
        throw new Error("URL required for first ScraperWSService initialization");
      }
      globalThis._scraperWSServiceInstance = new ScraperWSService(url);
    }
    return globalThis._scraperWSServiceInstance;
  }

  async initialize(maxRetries = 10, retryDelayMs = 2000): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Initializing Scraper WebSocket service (attempt ${attempt}/${maxRetries})`);
        await this.connection.connect();

        const health = await this.client.healthCheck();
        logger.info(`Scraper service healthy: version ${health.version}`);

        this.isInitialized = true;
        logger.info("Scraper WebSocket service initialized successfully");
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          logger.error("Failed to initialize Scraper WebSocket service after all retries", error);
          throw error;
        }
        logger.warn(`Scraper connection attempt ${attempt} failed, retrying in ${retryDelayMs}ms...`, error);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  getClient(): ScrapingService {
    return this.client;
  }

  isReady(): boolean {
    return this.connection.isReady();
  }

  getConnectionState(): string {
    return this.connection.getState();
  }

  async gracefulShutdown(): Promise<void> {
    logger.info("Shutting down Scraper WebSocket service");
    await this.connection.gracefulShutdown();
    this.isInitialized = false;
    logger.info("Scraper WebSocket service shutdown completed");
  }

  private async handleReconnect(): Promise<void> {
    logger.info("WebSocket reconnected, checking for stale jobs...");

    try {
      // Dynamic import to avoid circular dependency
      const { jobManager } = await import("../job-manager");
      const { JobStore } = await import("../job-manager/job-store");
      const jobStore = new JobStore();
      const allActiveJobs = await jobStore.getActiveJobs();

      let interrupted = 0;
      const now = Date.now();

      for (const job of allActiveJobs) {
        const dispatchAge = job.dispatchedAt
          ? now - job.dispatchedAt.getTime()
          : Infinity;
        const updateAge = now - job.updatedAt.getTime();

        // Case 1: Dispatched but never acknowledged - scraper never got it
        if (job.dispatchedAt && !job.acknowledgedAt && dispatchAge > ACK_TIMEOUT) {
          await jobManager.updateJob(job.deviceId, {
            step: "interrupted",
            error: "Request never acknowledged by scraper - connection may have been lost before delivery",
          });
          interrupted++;
          logger.info(`Job ${job.deviceId} interrupted: never acknowledged (${Math.round(dispatchAge / 1000)}s since dispatch)`);
          continue;
        }

        // Case 2: Acknowledged but stale - scraper died mid-work
        const stepTimeout = JOB_TIMEOUTS[job.step as keyof typeof JOB_TIMEOUTS];
        if (stepTimeout && updateAge > stepTimeout) {
          await jobManager.updateJob(job.deviceId, {
            step: "interrupted",
            error: "Connection lost - job timed out during reconnection",
          });
          interrupted++;
          logger.info(`Job ${job.deviceId} interrupted: timed out (${Math.round(updateAge / 1000)}s since last update)`);
          continue;
        }

        // Case 3: Not yet dispatched (in selecting state) or within timeout - leave alone
        // These jobs will either continue after reconnect or timeout naturally
      }

      if (interrupted > 0) {
        logger.warn(`Marked ${interrupted} stale jobs as interrupted after reconnection`);
      } else {
        logger.info("No stale jobs found after reconnection");
      }
    } catch (error) {
      logger.error("Failed to handle reconnection job cleanup", error);
    }
  }
}

export { ScraperWSConnection } from "./connection";
export { ScraperWSClient, type ScrapingService, type TrackedResult } from "./client";
export * from "./types";
