import { type YandexResponse } from "@/src/types/yandex-distribution";

/**
 * Base interface for all Yandex Distribution API strategies
 */
export interface YandexDistributionStrategy<
  T = unknown,
  P extends Record<string, unknown> = Record<string, unknown>
> {
  /**
   * Execute the strategy with the given parameters
   * @param params - Parameters for the strategy
   * @returns A promise that resolves to the API response
   */
  execute(params: P): Promise<YandexResponse<T>>;
}

/**
 * Base class for all Yandex Distribution API strategies
 * Implements common functionality like authorization and request handling
 */
export abstract class BaseYandexDistributionStrategy<
  T = unknown,
  P extends Record<string, unknown> = Record<string, unknown>
> implements YandexDistributionStrategy<T, P>
{
  protected readonly BASE_URL =
    "https://api.content.market.yandex.ru/v3/affiliate";
  protected readonly authKey: string;

  constructor(authKey: string) {
    this.authKey = authKey;
  }

  /**
   * Execute an HTTP request to the Yandex Distribution API
   * @param endpoint - API endpoint
   * @param params - Query parameters
   * @returns Promise with the API response
   */
  protected async makeRequest(
    endpoint: string,
    params: Record<string, unknown>
  ): Promise<YandexResponse<T>> {
    const queryParams = new URLSearchParams();

    // Convert params to URLSearchParams
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        // Handle different types of values appropriately
        if (typeof value === "object" && value !== null) {
          queryParams.append(key, JSON.stringify(value));
        } else if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          queryParams.append(key, value.toString());
        }
      }
    });

    const url = `${this.BASE_URL}${endpoint}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: this.authKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as YandexResponse<T>;
      return data;
    } catch (error) {
      throw new Error(
        `Failed to fetch from Yandex Distribution API: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  abstract execute(params: P): Promise<YandexResponse<T>>;
}
