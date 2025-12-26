import type { ScraperWSConnection } from "./connection";
import type {
  ScraperEvent,
  SearchResult,
  ScrapeResult,
  HealthCheckResult,
} from "./types";
import { SCRAPER_TIMEOUTS } from "./types";
import { logger } from "../logger";

export interface ScrapingService {
  search(
    query: string,
    opts?: { onEvent?: (event: ScraperEvent) => void }
  ): Promise<SearchResult>;

  scrape(
    slug: string,
    opts?: { onEvent?: (event: ScraperEvent) => void }
  ): Promise<ScrapeResult>;

  healthCheck(): Promise<HealthCheckResult>;

  isReady(): boolean;
}

export class ScraperWSClient implements ScrapingService {
  private connection: ScraperWSConnection;

  constructor(connection: ScraperWSConnection) {
    this.connection = connection;
  }

  async search(
    query: string,
    opts?: { onEvent?: (event: ScraperEvent) => void }
  ): Promise<SearchResult> {
    logger.debug(`Searching for "${query}"`);

    const result = await this.connection.sendRequest(
      "scrape.search",
      { query },
      SCRAPER_TIMEOUTS.search,
      opts?.onEvent
    );

    return result as SearchResult;
  }

  async scrape(
    slug: string,
    opts?: { onEvent?: (event: ScraperEvent) => void }
  ): Promise<ScrapeResult> {
    logger.debug(`Scraping data for "${slug}"`);

    const result = await this.connection.sendRequest(
      "scrape.get",
      { slug },
      SCRAPER_TIMEOUTS.scrape,
      opts?.onEvent
    );

    return result as ScrapeResult;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    logger.debug("Performing health check");

    const result = await this.connection.sendRequest(
      "health.check",
      {},
      SCRAPER_TIMEOUTS.healthCheck
    );

    return result as HealthCheckResult;
  }

  isReady(): boolean {
    return this.connection.isReady();
  }
}
