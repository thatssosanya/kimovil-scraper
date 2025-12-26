import { type YandexDistributionStrategy } from "./strategies/base-strategy";
import { CreatePartnerLinkStrategy } from "./strategies/create-partner-link-strategy";
import { type CreatePartnerLinkParams } from "@/src/types/yandex-distribution";
import { env } from "@/src/env.mjs";

/**
 * Service for interacting with Yandex Distribution API
 * Uses the Strategy pattern to handle different types of requests
 */
export class YandexDistributionService {
  private strategy: YandexDistributionStrategy<
    unknown,
    Record<string, unknown>
  >;

  constructor(
    strategy?: YandexDistributionStrategy<unknown, Record<string, unknown>>
  ) {
    if (!env.YANDEX_DISTRIBUTION_AUTH_KEY) {
      throw new Error(
        "YANDEX_DISTRIBUTION_AUTH_KEY is not set in environment variables"
      );
    }

    this.strategy =
      strategy ??
      new CreatePartnerLinkStrategy(env.YANDEX_DISTRIBUTION_AUTH_KEY);
  }

  /**
   * Set a new strategy for the service
   * @param strategy - The new strategy to use
   */
  setStrategy<T, P extends Record<string, unknown>>(
    strategy: YandexDistributionStrategy<T, P>
  ): void {
    this.strategy = strategy as YandexDistributionStrategy<
      unknown,
      Record<string, unknown>
    >;
  }

  /**
   * Execute the current strategy with the given parameters
   * @param params - Parameters for the strategy
   * @returns Promise with the result of the strategy execution
   */
  async execute<T, P extends Record<string, unknown>>(params: P) {
    return (this.strategy as YandexDistributionStrategy<T, P>).execute(params);
  }

  /**
   * Convenience method to create a partner link
   * @param params - Parameters for creating a partner link
   * @returns Promise with the partner link information
   */
  async createPartnerLink(params: CreatePartnerLinkParams) {
    const strategy = new CreatePartnerLinkStrategy(
      env.YANDEX_DISTRIBUTION_AUTH_KEY
    );
    return strategy.execute(
      params as CreatePartnerLinkParams & Record<string, unknown>
    );
  }
}

// Create a singleton instance
export const yandexDistributionService = new YandexDistributionService();
