export interface YandexOffer {
  sellerName: string;
  sellerId: string;
  priceMinorUnits: number;
  currency: string;
  oldPriceMinorUnits?: number;
  discountPercent?: number;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable: boolean;
}

interface ParsedOfferData {
  offerId?: string;
  shopId?: number;
  shopName?: string;
  businessName?: string;
  businessId?: number;
  price?: { value: string | number; currency: string };
  oldPrice?: number;
  discountPercent?: number;
  cpaUrl?: string;
  skuId?: string;
  isAvailable?: boolean;
  title?: string;
}

function extractVariantFromTitle(title: string): { key: string; label: string } | null {
  const match = title.match(/(\d+)\/(\d+)\s*[Gg][Bb]/);
  if (match) {
    const ram = match[1];
    const storage = match[2];
    return {
      key: `${ram}/${storage}`,
      label: `${ram} GB / ${storage} GB`,
    };
  }
  return null;
}

function normalizeCurrency(currency: string): string {
  return currency === "RUR" ? "RUB" : currency;
}

function toMinorUnits(value: string | number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Math.round(num * 100);
}

function extractJsonBlocks(html: string): unknown[] {
  const results: unknown[] = [];
  const patterns = [
    /<noframes data-apiary="patch">([\s\S]*?)<\/noframes>/g,
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        results.push(parsed);
      } catch {
        // Skip invalid JSON blocks
      }
    }
  }

  return results;
}

function extractOffersFromBlock(block: unknown, offers: Map<string, ParsedOfferData>): void {
  if (!block || typeof block !== "object") return;

  const obj = block as Record<string, unknown>;

  if (obj.offerId && typeof obj.offerId === "string") {
    const existing = offers.get(obj.offerId) ?? {};
    const merged: ParsedOfferData = { ...existing };

    if (obj.offerId) merged.offerId = obj.offerId as string;
    if (obj.shopId && typeof obj.shopId === "number") merged.shopId = obj.shopId;
    if (obj.businessId && typeof obj.businessId === "string") {
      merged.businessId = parseInt(obj.businessId, 10);
    }
    if (obj.businessId && typeof obj.businessId === "number") {
      merged.businessId = obj.businessId;
    }
    if (obj.price && typeof obj.price === "object") {
      const price = obj.price as Record<string, unknown>;
      if (price.value !== undefined && price.currency) {
        merged.price = {
          value: price.value as string | number,
          currency: price.currency as string,
        };
      }
    }
    if (obj.cpaUrl && typeof obj.cpaUrl === "string") merged.cpaUrl = obj.cpaUrl;
    if (obj.skuId && typeof obj.skuId === "string") merged.skuId = obj.skuId;
    if (typeof obj.isDeliveryAvailable === "boolean") merged.isAvailable = obj.isDeliveryAvailable;
    if (obj.title && typeof obj.title === "string") merged.title = obj.title;
    if (obj.skuTitle && typeof obj.skuTitle === "string") merged.title = obj.skuTitle;

    offers.set(obj.offerId as string, merged);
  }

  if (obj.pendingCartItem && typeof obj.pendingCartItem === "object") {
    extractOffersFromBlock(obj.pendingCartItem, offers);
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        extractOffersFromBlock(item, offers);
      }
    } else if (value && typeof value === "object") {
      extractOffersFromBlock(value, offers);
    }
  }
}

function extractActualPricesFromHtml(html: string): Map<string, { price: number; oldPrice?: number; discountPercent?: number }> {
  const prices = new Map<string, { price: number; oldPrice?: number; discountPercent?: number }>();

  const actualPricePattern = /"actualPrice":\{"amount":\{"intPart":(\d+|"(\d+)")/g;
  let match;
  while ((match = actualPricePattern.exec(html)) !== null) {
    const priceValue = parseInt(match[1].replace(/"/g, ""), 10);
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 500);
    const context = html.slice(contextStart, contextEnd);

    const offerIdMatch = context.match(/"offerId":"([^"]+)"/);
    if (offerIdMatch) {
      const existing = prices.get(offerIdMatch[1]) ?? { price: priceValue };
      existing.price = priceValue;
      prices.set(offerIdMatch[1], existing);
    }
  }

  return prices;
}

function extractShopInfoFromHtml(html: string): Map<number, { shopName?: string; businessName?: string }> {
  const shops = new Map<number, { shopName?: string; businessName?: string }>();

  const shopNamePattern = /"shopName":"([^"]+)"/g;
  const businessNamePattern = /"businessName":"([^"]+)"/g;
  const shopIdPattern = /"shopId":(\d+)/g;
  const businessIdPattern = /"businessId":(\d+)/g;

  let match;
  while ((match = shopNamePattern.exec(html)) !== null) {
    const contextStart = Math.max(0, match.index - 300);
    const contextEnd = Math.min(html.length, match.index + 300);
    const context = html.slice(contextStart, contextEnd);

    const shopIdMatch = context.match(/"shopId":(\d+)/);
    if (shopIdMatch) {
      const shopId = parseInt(shopIdMatch[1], 10);
      const existing = shops.get(shopId) ?? {};
      existing.shopName = match[1];
      shops.set(shopId, existing);
    }
  }

  while ((match = businessNamePattern.exec(html)) !== null) {
    const contextStart = Math.max(0, match.index - 300);
    const contextEnd = Math.min(html.length, match.index + 300);
    const context = html.slice(contextStart, contextEnd);

    const businessIdMatch = context.match(/"businessId":(\d+)/);
    if (businessIdMatch) {
      const businessId = parseInt(businessIdMatch[1], 10);
      const existing = shops.get(businessId) ?? {};
      existing.businessName = match[1];
      shops.set(businessId, existing);
    }
  }

  return shops;
}

function extractAvailabilityFromHtml(html: string): Map<string, boolean> {
  const availability = new Map<string, boolean>();

  const deliveryPattern = /"isDeliveryAvailable":(true|false)/g;
  let match;
  while ((match = deliveryPattern.exec(html)) !== null) {
    const isAvailable = match[1] === "true";
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 500);
    const context = html.slice(contextStart, contextEnd);

    const offerIdMatch = context.match(/"offerId":"([^"]+)"/);
    if (offerIdMatch) {
      availability.set(offerIdMatch[1], isAvailable);
    }
  }

  return availability;
}

function extractOldPricesFromHtml(html: string): Map<string, { oldPrice: number; discountPercent?: number }> {
  const oldPrices = new Map<string, { oldPrice: number; discountPercent?: number }>();

  const oldPricePattern = /"oldPrice":(\d+)/g;
  let match;
  while ((match = oldPricePattern.exec(html)) !== null) {
    const oldPrice = parseInt(match[1], 10);
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 500);
    const context = html.slice(contextStart, contextEnd);

    const offerIdMatch = context.match(/"offerId":"([^"]+)"/);
    const discountMatch = context.match(/"discountPercent":(\d+)/);

    if (offerIdMatch) {
      oldPrices.set(offerIdMatch[1], {
        oldPrice,
        discountPercent: discountMatch ? parseInt(discountMatch[1], 10) : undefined,
      });
    }
  }

  return oldPrices;
}

function extractTitlesFromHtml(html: string): Map<string, string> {
  const titles = new Map<string, string>();

  const titlePattern = /"(?:sku)?[Tt]itle":"([^"]+)"/g;
  let match;
  while ((match = titlePattern.exec(html)) !== null) {
    const title = match[1];
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(html.length, match.index + 500);
    const context = html.slice(contextStart, contextEnd);

    const offerIdMatch = context.match(/"offerId":"([^"]+)"/);
    if (offerIdMatch) {
      titles.set(offerIdMatch[1], title);
    }
  }

  return titles;
}

export function parseYandexPrices(html: string): YandexOffer[] {
  const offers = new Map<string, ParsedOfferData>();
  const jsonBlocks = extractJsonBlocks(html);

  for (const block of jsonBlocks) {
    extractOffersFromBlock(block, offers);
  }

  const actualPrices = extractActualPricesFromHtml(html);
  const shopInfo = extractShopInfoFromHtml(html);
  const oldPrices = extractOldPricesFromHtml(html);
  const availability = extractAvailabilityFromHtml(html);
  const titles = extractTitlesFromHtml(html);

  const results: YandexOffer[] = [];
  const seenOffers = new Set<string>();

  for (const [offerId, data] of offers) {
    if (seenOffers.has(offerId)) continue;
    seenOffers.add(offerId);

    if (!data.price?.value) continue;

    const priceValue = typeof data.price.value === "string"
      ? parseFloat(data.price.value)
      : data.price.value;

    if (isNaN(priceValue) || priceValue <= 0) continue;

    const sellerId = data.businessId?.toString() ?? data.shopId?.toString() ?? "";
    const shopData = shopInfo.get(data.shopId ?? 0) ?? shopInfo.get(data.businessId ?? 0);
    const sellerName = shopData?.businessName ?? shopData?.shopName ?? "";
    const oldPriceData = oldPrices.get(offerId);
    const actualPriceData = actualPrices.get(offerId);

    const offer: YandexOffer = {
      sellerName,
      sellerId,
      priceMinorUnits: toMinorUnits(actualPriceData?.price ?? priceValue),
      currency: normalizeCurrency(data.price.currency),
      isAvailable: data.isAvailable ?? availability.get(offerId) ?? true,
    };

    if (oldPriceData?.oldPrice) {
      offer.oldPriceMinorUnits = toMinorUnits(oldPriceData.oldPrice);
    }
    if (oldPriceData?.discountPercent) {
      offer.discountPercent = oldPriceData.discountPercent;
    }

    const title = data.title ?? titles.get(offerId);
    const variant = title ? extractVariantFromTitle(title) : null;
    if (variant) {
      offer.variantKey = variant.key;
      offer.variantLabel = variant.label;
    } else if (data.skuId) {
      offer.variantKey = data.skuId;
    }

    if (data.cpaUrl) {
      offer.url = data.cpaUrl;
    }

    results.push(offer);
  }

  return results;
}
