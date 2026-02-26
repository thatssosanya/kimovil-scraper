import {
  Shortio,
  AliExpressClient,
  createLink,
  parseYandexMarketUrl,
  parseAliExpressUrl,
  parsePriceRuUrl,
  createPriceRuLink,
  YandexMarketParams,
  AliExpressParams,
  PriceRuParams,
  AliExpressCommissionRate,
} from "@src/shared/utils/utils";
import linksStorage, {
  GeneratedLinks,
} from "@src/shared/storages/linksStorage";
import yandexLinkCacheStorage from "@src/shared/storages/yandexLinkCacheStorage";
import { VidAuthor } from "@src/shared/storages/vidStorage";

export interface YandexLinkResult {
  siteLink: string;
  siteLinkLong: string;
  telegramLink?: string;
  telegramLinkLong?: string;
}

export interface AliExpressLinkResult {
  link: string;
  linkLong: string;
}

export interface PriceRuLinkResult {
  link: string;
  linkLong: string;
}

export interface YandexSearchLinkResult {
  url: string;
  externalId: string;
  title?: string;
  priceRubles?: number;
  bonusRubles?: number;
  matchedText?: string;
}

export interface YandexSearchLinksResponse {
  query: string;
  links: YandexSearchLinkResult[];
  cacheHit?: boolean;
  stale?: boolean;
  warning?: string;
  meta?: {
    createdAt?: number;
    expiresAt?: number;
    scrapeDurationMs?: number;
    filteredOutCount?: number;
    partial?: boolean;
    zeroResult?: boolean;
    totalCandidates?: number;
    failedCards?: number;
    limit?: number;
  };
}

export interface YandexRecentSearchesResponse {
  entries: YandexSearchLinksResponse[];
}

export interface LinkGenerationError extends Error {
  code: "INVALID_URL" | "NETWORK_ERROR" | "API_ERROR" | "COMMISSION_ZERO";
  retryable?: boolean;
  userMessage?: string;
}

type GenericServiceError = {
  message?: string;
};

const YANDEX_SEARCH_LIMIT = 12;
const YANDEX_SEARCH_MIN_QUERY_LENGTH = 4;

// Utility function for retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof Error && "retryable" in error && !error.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export class LinkService {
  private shortio: Shortio;
  private aliExpressClient: AliExpressClient;
  private scraperApiBaseUrl: string;
  private extensionSecret: string;

  constructor() {
    this.shortio = new Shortio(undefined, "a85fcd480f");
    this.aliExpressClient = new AliExpressClient();
    this.scraperApiBaseUrl = import.meta.env.VITE_SCRAPER_API_URL ?? "http://localhost:1488";
    this.extensionSecret = process.env.EXTENSION_SECRET || "s2jq43us23n%EeeAbs2!@#mUt";
  }

  parseUrl(url: string): {
    type: "yandex" | "aliexpress" | "priceru" | "invalid";
    params: YandexMarketParams | AliExpressParams | PriceRuParams | null;
  } {
    const yandexParams = parseYandexMarketUrl(url);
    if (yandexParams && yandexParams.productId) {
      return { type: "yandex", params: yandexParams };
    }

    const aliExpressParams = parseAliExpressUrl(url);
    if (aliExpressParams && aliExpressParams.productId) {
      return { type: "aliexpress", params: aliExpressParams };
    }

    const priceRuParams = parsePriceRuUrl(url);
    if (priceRuParams) {
      return { type: "priceru", params: priceRuParams };
    }

    return { type: "invalid", params: null };
  }

  async generateYandexLinks(
    url: string,
    author: VidAuthor,
  ): Promise<YandexLinkResult> {
    const yandexParams = parseYandexMarketUrl(url);
    if (!yandexParams || !yandexParams.productId) {
      const error = new Error(
        "Invalid Yandex Market URL",
      ) as LinkGenerationError;
      error.code = "INVALID_URL";
      error.retryable = false;
      error.userMessage =
        "URL не является ссылкой на товар Яндекс.Маркета. Проверьте правильность ссылки.";
      throw error;
    }

    return retryWithBackoff(async () => {
      try {
        // Check if it's kick user (special case)
        if (author.id === "kick") {
          const kickMarketUrl = createLink(
            {
              ...yandexParams,
              vid: author.vid,
              useCardFormat: true,
            },
            "kick",
          );

          const kickShortLink = await this.shortio.sh(kickMarketUrl);

          return {
            siteLink: kickShortLink,
            siteLinkLong: kickMarketUrl,
          };
        }

        // For all other users, generate both site and telegram links
        const siteMarketUrl = createLink(
          {
            ...yandexParams,
            vid: author.vid,
            useCardFormat: true,
          },
          "site",
        );

        const telegramMarketUrl = createLink(
          {
            ...yandexParams,
            vid: author.vid,
            useCardFormat: true,
          },
          "blogger",
        );

        const [siteLink, telegramLink] = await Promise.all([
          this.shortio.sh(siteMarketUrl),
          this.shortio.sh(telegramMarketUrl),
        ]);

        return {
          siteLink,
          siteLinkLong: siteMarketUrl,
          telegramLink,
          telegramLinkLong: telegramMarketUrl,
        };
      } catch (error: unknown) {
        console.error("Yandex link generation error:", error);
        const parsedError = (error && typeof error === "object") ? (error as GenericServiceError) : null;
        const errorMessage = parsedError?.message ?? String(error);

        // Check if it's a network/fetch error
        if (error instanceof TypeError && errorMessage.includes("fetch")) {
          const linkError = new Error(
            "Network connection error",
          ) as LinkGenerationError;
          linkError.code = "NETWORK_ERROR";
          linkError.retryable = true;
          linkError.userMessage =
            "Проблема с сетевым соединением. Проверьте подключение к интернету.";
          throw linkError;
        }

        // Check if it's an HTTP error (from our Shortio improvements)
        if (errorMessage.includes("HTTP")) {
          const linkError = new Error(
            "Shortening service error",
          ) as LinkGenerationError;
          linkError.code = "API_ERROR";
          linkError.retryable = true;
          linkError.userMessage = `Сервис сокращения ссылок вернул ошибку: ${errorMessage}`;
          throw linkError;
        }

        // Generic API error
        const linkError = new Error(
          "Failed to generate Yandex links",
        ) as LinkGenerationError;
        linkError.code = "API_ERROR";
        linkError.retryable = true;
        linkError.userMessage = `Ошибка генерации ссылок: ${errorMessage}`;
        throw linkError;
      }
    });
  }

  async checkAliExpressCommission(
    url: string,
  ): Promise<AliExpressCommissionRate | null> {
    const aliExpressParams = parseAliExpressUrl(url);
    if (!aliExpressParams || !aliExpressParams.productId) {
      const error = new Error("Invalid AliExpress URL") as LinkGenerationError;
      error.code = "INVALID_URL";
      throw error;
    }

    try {
      const response = await this.aliExpressClient.checkCommission([url]);
      if (response.commission_rates && response.commission_rates.length > 0) {
        return response.commission_rates[0];
      }
      return null;
    } catch {
      const linkError = new Error(
        "Failed to check AliExpress commission",
      ) as LinkGenerationError;
      linkError.code = "API_ERROR";
      throw linkError;
    }
  }

  async generateAliExpressLink(url: string): Promise<AliExpressLinkResult> {
    const aliExpressParams = parseAliExpressUrl(url);
    if (!aliExpressParams || !aliExpressParams.productId) {
      const error = new Error("Invalid AliExpress URL") as LinkGenerationError;
      error.code = "INVALID_URL";
      throw error;
    }

    try {
      const deeplinkData = await this.aliExpressClient.createDeeplink(url);
      const shortLink = await this.shortio.sh(deeplinkData.deeplink);

      return {
        link: shortLink,
        linkLong: deeplinkData.deeplink,
      };
    } catch {
      const linkError = new Error(
        "Failed to generate AliExpress link",
      ) as LinkGenerationError;
      linkError.code = "NETWORK_ERROR";
      throw linkError;
    }
  }

  async getCachedLinks(
    tabId: number,
    authorId: string,
  ): Promise<GeneratedLinks | null> {
    return linksStorage.getLinksForTab(tabId, authorId);
  }

  async saveYandexLinks(
    tabId: number,
    authorId: string,
    links: YandexLinkResult,
  ): Promise<void> {
    await linksStorage.saveLinksForTab(tabId, authorId, {
      siteLink: links.siteLink,
      siteLinkLong: links.siteLinkLong,
      telegramLink: links.telegramLink || links.siteLink,
      telegramLinkLong: links.telegramLinkLong || links.siteLinkLong,
      timestamp: Date.now(),
      linkType: "yandex",
    });
  }

  async getCachedYandexLinksByUrl(
    authorId: string,
    url: string,
  ): Promise<YandexLinkResult | null> {
    return yandexLinkCacheStorage.getByAuthorAndUrl(authorId, url);
  }

  async saveYandexLinksByUrl(
    authorId: string,
    url: string,
    links: YandexLinkResult,
  ): Promise<void> {
    await yandexLinkCacheStorage.saveByAuthorAndUrl(authorId, url, links);
  }

  async saveAliExpressLink(
    tabId: number,
    result: AliExpressLinkResult,
    commission?: AliExpressCommissionRate,
  ): Promise<void> {
    await linksStorage.saveLinksForTab(tabId, "aliexpress", {
      siteLink: result.link,
      siteLinkLong: result.linkLong,
      telegramLink: result.link,
      telegramLinkLong: result.linkLong,
      aliExpressLink: result.link,
      aliExpressLinkLong: result.linkLong,
      commissionRate: commission?.commission_rate || 0,
      hotCommissionRate: commission?.hot_commission_rate || 0,
      isHot: commission?.is_hot || false,
      productName: commission?.product_name || undefined,
      timestamp: Date.now(),
      linkType: "aliexpress",
    });
  }

  async clearCacheForTab(tabId: number): Promise<void> {
    await linksStorage.clearLinksForTab(tabId);
  }

  async generatePriceRuLink(url: string): Promise<PriceRuLinkResult> {
    const priceRuParams = parsePriceRuUrl(url);
    if (!priceRuParams) {
      const error = new Error("Invalid price.ru URL") as LinkGenerationError;
      error.code = "INVALID_URL";
      throw error;
    }

    try {
      const priceRuLinkLong = createPriceRuLink(url);
      const shortLink = await this.shortio.sh(priceRuLinkLong);

      return {
        link: shortLink,
        linkLong: priceRuLinkLong,
      };
    } catch {
      const linkError = new Error(
        "Failed to generate price.ru link",
      ) as LinkGenerationError;
      linkError.code = "NETWORK_ERROR";
      throw linkError;
    }
  }

  async savePriceRuLink(
    tabId: number,
    result: PriceRuLinkResult,
  ): Promise<void> {
    await linksStorage.saveLinksForTab(tabId, "priceru", {
      siteLink: result.link,
      siteLinkLong: result.linkLong,
      telegramLink: result.link,
      telegramLinkLong: result.linkLong,
      priceRuLink: result.link,
      priceRuLinkLong: result.linkLong,
      timestamp: Date.now(),
      linkType: "priceru",
    });
  }

  async searchYandexLinks(
    query: string,
    limit: number = 10,
  ): Promise<YandexSearchLinksResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      const error = new Error("Query is empty") as LinkGenerationError;
      error.code = "INVALID_URL";
      error.retryable = false;
      throw error;
    }

    if (trimmed.length < YANDEX_SEARCH_MIN_QUERY_LENGTH) {
      const error = new Error(`Введите минимум ${YANDEX_SEARCH_MIN_QUERY_LENGTH} символа`) as LinkGenerationError;
      error.code = "INVALID_URL";
      error.retryable = false;
      throw error;
    }

    const response = await fetch(`${this.scraperApiBaseUrl}/api/extension/yandex/search-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: this.extensionSecret,
        query: trimmed,
        limit: Math.max(1, Math.min(YANDEX_SEARCH_LIMIT, limit)),
      }),
    });

    const result = await response.json() as {
      success: boolean;
      error?: string;
      data?: {
        query?: string;
        links?: readonly YandexSearchLinkResult[];
        cacheHit?: boolean;
        stale?: boolean;
        warning?: string;
        meta?: YandexSearchLinksResponse["meta"];
      };
    };

    if (!response.ok || !result.success) {
      const error = new Error(result.error ?? "Search failed") as LinkGenerationError;
      error.code = "API_ERROR";
      error.retryable = true;
      throw error;
    }

    return {
      query: result.data?.query ?? trimmed,
      links: [...(result.data?.links ?? [])],
      cacheHit: result.data?.cacheHit,
      stale: result.data?.stale,
      warning: result.data?.warning,
      meta: result.data?.meta,
    };
  }

  async getRecentYandexSearches(limit: number = YANDEX_SEARCH_LIMIT): Promise<YandexRecentSearchesResponse> {
    const response = await fetch(`${this.scraperApiBaseUrl}/api/extension/yandex/search-cache/recent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: this.extensionSecret,
        limit: Math.max(1, Math.min(YANDEX_SEARCH_LIMIT, limit)),
      }),
    });

    const result = await response.json() as {
      success: boolean;
      error?: string;
      data?: {
        entries?: Array<{
          query?: string;
          links?: readonly YandexSearchLinkResult[];
          cacheHit?: boolean;
          stale?: boolean;
          warning?: string;
          meta?: YandexSearchLinksResponse["meta"];
        }>;
      };
    };

    if (!response.ok || !result.success) {
      const error = new Error(result.error ?? "Failed to load recent searches") as LinkGenerationError;
      error.code = "API_ERROR";
      error.retryable = true;
      throw error;
    }

    return {
      entries: (result.data?.entries ?? []).map((entry) => ({
        query: entry.query ?? "",
        links: [...(entry.links ?? [])],
        cacheHit: entry.cacheHit,
        stale: entry.stale,
        warning: entry.warning,
        meta: entry.meta,
      })),
    };
  }
}

export const linkService = new LinkService();
