export class Shortio {
  private apiURL: string;
  private signature: string;

  constructor(
    apiURL: string = "https://kik.cat/yourls-api.php",
    signature: string,
  ) {
    this.apiURL = apiURL;
    this.signature = signature;
  }

  async sh(longURL: string, keyword?: string): Promise<string> {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: keyword
        ? new URLSearchParams({
            action: "shorturl",
            url: longURL,
            keyword: keyword,
            signature: this.signature,
            format: "json",
          })
        : new URLSearchParams({
            action: "shorturl",
            url: longURL,
            signature: this.signature,
            format: "json",
          }),
    });

    // Check for HTTP errors
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    
    // Check for API errors in response
    if (json.status && json.status !== 'success') {
      throw new Error(json.message || json.statusCode || 'API Error');
    }
    
    // Check if we got a valid short URL
    if (!json.shorturl) {
      throw new Error('No shortened URL returned from service');
    }
    
    return json.shorturl;
  }

  async expand(shortURL: string): Promise<string> {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "expand",
        shorturl: shortURL,
        signature: this.signature,
        format: "json",
      }),
    });
    const json = await response.json();
    return json.longurl;
  }

  async getStats(shortURL: string) {
    const response = await fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "url-stats",
        shorturl: shortURL,
        signature: this.signature,
        format: "json",
      }),
    });
    const json: unknown = await response.json();
    return json;
  }

  async getTitle(longURL: string): Promise<string> {
    const response = await fetch(longURL);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1] : "";
    return title;
  }
}

export interface YandexMarketParams {
  productId: string | null;
  sku: string | null;
  uniqueId: string | null;
  doWaremd5: string | null;
  productName?: string | null;
  isCardFormat: boolean;
}

export interface AliExpressParams {
  productId: string | null;
  storeId: string | null;
  originalUrl: string;
}

export interface PriceRuParams {
  originalUrl: string;
}

export interface AliExpressCommissionRate {
  url: string;
  product_name: string | null;
  commission_rate: number | null;
  hot_commission_rate: number | null;
  is_hot: boolean;
}

export interface AliExpressCommissionResponse {
  commission_rates: AliExpressCommissionRate[];
}

export interface AliExpressDeeplinkResponse {
  url: string;
  deeplink: string;
  status: string;
}

export function parseYandexMarketUrl(url: string): YandexMarketParams | null {
  try {
    const parsedUrl = new URL(url);

    if (!parsedUrl.hostname.includes("market.yandex.ru")) {
      return null;
    }

    const pathParts = parsedUrl.pathname.split("/");
    let productId: string | null = null;
    let productName: string | null = null;
    let isCardFormat = false;

    // Handle /card/{product-name}/{productId} format
    if (pathParts.includes("card") && pathParts.length >= 4) {
      const cardIndex = pathParts.indexOf("card");
      if (cardIndex >= 0 && cardIndex + 2 < pathParts.length) {
        productName = pathParts[cardIndex + 1];
        productId = pathParts[cardIndex + 2];
        isCardFormat = true;
      }
    }
    // Handle /product/{productId} format
    else if (pathParts.includes("product") && pathParts.length >= 3) {
      const productIndex = pathParts.indexOf("product");
      if (productIndex >= 0 && productIndex + 1 < pathParts.length) {
        productId = pathParts[productIndex + 1];
      }
    }

    // If no productId found yet, try to find any numeric part in the path
    if (!productId) {
      productId = pathParts.find((part) => part.match(/^\d+$/)) || null;
    }

    const searchParams = parsedUrl.searchParams;

    return {
      productId,
      productName,
      sku: searchParams.get("sku"), // Returns null if sku doesn't exist
      uniqueId: searchParams.get("uniqueId"), // Returns null if uniqueId doesn't exist
      doWaremd5: searchParams.get("do-waremd5"), // Returns null if do-waremd5 doesn't exist
      isCardFormat,
    };
  } catch {
    return null;
  }
}

export function parsePriceRuUrl(url: string): PriceRuParams | null {
  try {
    const parsedUrl = new URL(url);
    
    // Check if it's a price.ru URL
    if (!parsedUrl.hostname.includes("price.ru")) {
      return null;
    }
    
    return {
      originalUrl: url
    };
  } catch {
    return null;
  }
}

export function parseAliExpressUrl(url: string): AliExpressParams | null {
  try {
    const parsedUrl = new URL(url);

    // Check if it's an AliExpress URL
    if (
      !parsedUrl.hostname.includes("aliexpress.com") &&
      !parsedUrl.hostname.includes("aliexpress.ru") &&
      !parsedUrl.hostname.includes("aliexpress.us")
    ) {
      return null;
    }

    let productId: string | null = null;
    let storeId: string | null = null;

    // Extract product ID from various AliExpress URL formats
    const pathParts = parsedUrl.pathname.split("/");

    // Format: /item/{productId}.html or /item/{productName}/{productId}.html
    const itemIndex = pathParts.findIndex((part) => part === "item");
    if (itemIndex >= 0 && itemIndex + 1 < pathParts.length) {
      // First try the next part directly (for /item/{productId}.html format)
      const nextPart = pathParts[itemIndex + 1];
      const directMatch = nextPart.match(/^(\d+)\.html/);
      if (directMatch) {
        productId = directMatch[1];
      } else if (itemIndex + 2 < pathParts.length) {
        // Try the part after that (for /item/{productName}/{productId}.html format)
        const productPart = pathParts[itemIndex + 2];
        const match = productPart.match(/(\d+)\.html/);
        if (match) {
          productId = match[1];
        }
      }
    }

    // Format: /store/product/{productName}/{productId}.html
    const productIndex = pathParts.findIndex((part) => part === "product");
    if (
      !productId &&
      productIndex >= 0 &&
      productIndex + 2 < pathParts.length
    ) {
      const productPart = pathParts[productIndex + 2];
      const match = productPart.match(/(\d+)\.html/);
      if (match) {
        productId = match[1];
      }
    }

    // Extract from search params if not found in path
    if (!productId) {
      productId =
        parsedUrl.searchParams.get("productId") ||
        parsedUrl.searchParams.get("item") ||
        parsedUrl.searchParams.get("id");
    }

    // Extract store ID
    storeId =
      parsedUrl.searchParams.get("storeId") ||
      parsedUrl.searchParams.get("store");

    // Try to extract store ID from path
    if (!storeId) {
      const storeIndex = pathParts.findIndex((part) => part === "store");
      if (storeIndex >= 0 && storeIndex + 1 < pathParts.length) {
        storeId = pathParts[storeIndex + 1];
      }
    }

    return {
      productId,
      storeId,
      originalUrl: url,
    };
  } catch {
    return null;
  }
}

/**
 * Converts a Yandex Market URL to the desired format
 * @param url The original Yandex Market URL
 * @param targetFormat The desired format ('card' or 'product')
 * @returns The converted URL or the original if conversion fails
 */
export function convertYandexMarketUrl(
  url: string,
  targetFormat: "card" | "product",
): string {
  try {
    const params = parseYandexMarketUrl(url);
    if (!params || !params.productId) {
      return url; // Return original URL if parsing fails
    }

    // If already in the desired format, return the original URL
    if (
      (targetFormat === "card" && params.isCardFormat) ||
      (targetFormat === "product" && !params.isCardFormat)
    ) {
      return url;
    }

    // Create new URL with the desired format
    return createLink(
      {
        productId: params.productId,
        productName: params.productName || undefined,
        sku: params.sku,
        uniqueId: params.uniqueId,
        doWaremd5: params.doWaremd5,
        useCardFormat: targetFormat === "card",
      },
      "site",
    ); // Default to 'site' clid type
  } catch (error) {
    console.error("Error converting URL:", error);
    return url; // Return original URL if conversion fails
  }
}

interface CreateLinkParams {
  productId: string;
  productName?: string | null;
  sku?: string | null;
  uniqueId?: string | null;
  doWaremd5?: string | null;
  pp?: string;
  mclid?: string;
  distr_type?: string;
  vid?: string;
  useCardFormat?: boolean;
  originalUrl?: string; // Add original URL to extract additional parameters
}

export function createLink(
  {
    productId,
    productName = null,
    sku = null,
    uniqueId = null,
    doWaremd5 = null,
    pp = "900",
    mclid = "1003",
    distr_type = "7",
    vid = "322",
    useCardFormat = false,
    originalUrl = null,
  }: CreateLinkParams,
  clidType: "site" | "blogger" | "kick",
) {
  try {
    // Create base URL based on format
    let baseUrl: string;
    if (useCardFormat && productName) {
      baseUrl = `https://market.yandex.ru/card/${productName}/${productId}`;
    } else {
      baseUrl = `https://market.yandex.ru/product/${productId}`;
    }

    const url = new URL(baseUrl);
    // Robust clid logic
    let clid: string;
    if (clidType === "kick") {
      clid = "11999773";
    } else if (clidType === "site") {
      clid = "2510955";
    } else {
      clid = "2913665";
    }

    // Initialize parameters
    const params = new URLSearchParams({
      pp,
      mclid,
      distr_type,
      clid,
      vid,
    });

    // Add optional parameters if they exist
    if (sku) {
      params.append("sku", sku);
    }

    if (uniqueId) {
      params.append("uniqueId", uniqueId);
    }

    if (doWaremd5) {
      params.append("do-waremd5", doWaremd5);
    }

    // append showOriginalKmEmptyOffer=1
    params.append("showOriginalKmEmptyOffer", "1");

    // If original URL is provided, extract additional parameters
    if (originalUrl) {
      try {
        const originalParsedUrl = new URL(originalUrl);
        const originalParams = originalParsedUrl.searchParams;

        // List of parameters to preserve from the original URL
        // Exclude parameters we've already handled
        const preserveParams = ["sponsored", "cpc"];

        preserveParams.forEach((param) => {
          if (originalParams.has(param)) {
            params.append(param, originalParams.get(param)!);
          }
        });
      } catch {
        // Ignore errors parsing original URL
      }
    }

    // Set search params to URL
    url.search = params.toString();

    return url.toString();
  } catch (error) {
    // Fallback in case of invalid parameters
    console.error("Error creating URL:", error);
    return `https://market.yandex.ru/product/${productId}`;
  }
}

// AliExpress API client functions
const EXTENSION_SECRET =
  process.env.EXTENSION_SECRET || "s2jq43us23n%EeeAbs2!@#mUt";
const API_BASE_URL = "https://c.click-or-die.ru";

export class AliExpressClient {
  private baseUrl: string;
  private secret: string;

  constructor(
    baseUrl: string = API_BASE_URL,
    secret: string = EXTENSION_SECRET,
  ) {
    this.baseUrl = baseUrl;
    this.secret = secret;
  }

  async checkCommission(urls: string[]): Promise<AliExpressCommissionResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/extension/check-commission`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: this.secret,
          urls: urls,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to check commission");
    }

    return result.data;
  }

  async createDeeplink(url: string): Promise<AliExpressDeeplinkResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/extension/create-deeplinks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: this.secret,
          url: url,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to create deeplink");
    }

    return result.data;
  }
}

export function createPriceRuLink(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // Add UTM parameters for price.ru
    parsedUrl.searchParams.set("utm_medium", "cpc");
    parsedUrl.searchParams.set("utm_campaign", "reflink-81");
    parsedUrl.searchParams.set("erid", "2W5zFHqRUR6");
    
    return parsedUrl.toString();
  } catch {
    return url; // Return original URL if parsing fails
  }
}
