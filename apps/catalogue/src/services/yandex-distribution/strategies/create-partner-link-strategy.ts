import {
  type CreatePartnerLinkParams,
  type YandexLink,
  type YandexResponse,
} from "@/src/types/yandex-distribution";
import { BaseYandexDistributionStrategy } from "./base-strategy";

type CreatePartnerLinkParamsRecord = CreatePartnerLinkParams &
  Record<string, unknown>;

/**
 * Strategy for creating partner links in Yandex.Market
 */
export class CreatePartnerLinkStrategy extends BaseYandexDistributionStrategy<
  YandexLink,
  CreatePartnerLinkParamsRecord
> {
  /**
   * Creates a partner link using the provided parameters
   * @param params - Parameters for creating a partner link
   * @returns Promise with the partner link information
   */
  async execute(
    params: CreatePartnerLinkParamsRecord
  ): Promise<YandexResponse<YandexLink>> {
    return this.makeRequest("/partner/link/create", params);
  }
}
