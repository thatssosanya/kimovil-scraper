/**
 * Represents the region information in Yandex.Market API responses
 */
export interface YandexRegion {
  id: number;
  name: string;
  type: YandexRegionType;
  childCount: number;
  country: {
    id: number;
    name: string;
    type: "COUNTRY";
    childCount: number;
  };
}

/**
 * Represents the currency information in Yandex.Market API responses
 */
export interface YandexCurrency {
  id: "RUR";
  name: string;
}

/**
 * Represents the context information in Yandex.Market API responses
 */
export interface YandexContext {
  id: string;
  time: string;
  marketUrl: string;
  region: YandexRegion;
  currency: YandexCurrency;
}

/**
 * Represents the link information in Yandex.Market API responses
 */
export interface YandexLink {
  url: string;
  shortUrl: string;
  searchType: YandexSearchType;
  pageName: string;
  productPhoto?: string;
}

/**
 * Represents the complete response from Yandex.Market API
 */
export interface YandexResponse<T> {
  status: "OK" | "ERROR";
  context: YandexContext;
  link?: YandexLink;
  data?: T;
}

/**
 * Available region types in Yandex.Market API
 */
export type YandexRegionType =
  | "CONTINENT"
  | "REGION"
  | "COUNTRY"
  | "COUNTRY_DISTRICT"
  | "SUBJECT_FEDERATION"
  | "CITY"
  | "VILLAGE"
  | "CITY_DISTRICT"
  | "METRO_STATION"
  | "SUBJECT_FEDERATION_DISTRICT"
  | "AIRPORT"
  | "OVERSEAS_TERRITORY"
  | "SECONDARY_DISTRICT"
  | "MONORAIL_STATION"
  | "RURAL_SETTLEMENT"
  | "OTHER";

/**
 * Available search types in Yandex.Market API
 */
export type YandexSearchType =
  | "MARKET_MAIN"
  | "MARKET_PRODUCT"
  | "MARKET_CATEGORY"
  | "MARKET_PRODUCT_CATEGORY_LIST"
  | "MARKET_SEARCH_RESULT"
  | "MARKET_PROMO_LANDING"
  | "MARKET_MARKET_JOURNAL"
  | "MARKET_BRAND";

/**
 * Parameters for creating a partner link
 */
export interface CreatePartnerLinkParams {
  url: string;
  clid: number;
  vid?: string;
  format?: "json" | "xml";
  erid?: string;
}
