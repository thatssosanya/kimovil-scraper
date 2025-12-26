import { ScraperWSConnection } from "./connection";
import { ScraperWSClient, type ScrapingService } from "./client";
import { logger } from "../logger";

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

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info("Initializing Scraper WebSocket service");
      await this.connection.connect();

      const health = await this.client.healthCheck();
      logger.info(`Scraper service healthy: version ${health.version}`);

      this.isInitialized = true;
      logger.info("Scraper WebSocket service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Scraper WebSocket service", error);
      throw error;
    }
  }

  getClient(): ScrapingService {
    return this.client;
  }

  isReady(): boolean {
    return this.isInitialized && this.connection.isReady();
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
}

export { ScraperWSConnection } from "./connection";
export { ScraperWSClient, type ScrapingService } from "./client";
export * from "./types";
