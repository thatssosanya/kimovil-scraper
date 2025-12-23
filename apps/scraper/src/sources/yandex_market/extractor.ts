export interface YandexOffer {
  offerId: string;
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
  isPrimary?: boolean;
}

interface LdJsonOffer {
  price?: string | number;
  priceCurrency?: string;
  seller?: { name?: string; "@id"?: string };
  url?: string;
  availability?: string;
}

interface LdJsonProduct {
  "@type"?: string;
  name?: string;
  brand?: { name?: string };
  offers?: LdJsonOffer | LdJsonOffer[];
  url?: string;
}

function toMinorUnits(value: string | number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Math.round(num * 100);
}

function normalizeCurrency(currency: string): string {
  return currency === "RUR" ? "RUB" : currency;
}

function extractVariantFromTitle(title: string): { key: string; label: string } | null {
  const match = title.match(/(\d+)\s*[\/\\]\s*(\d+)\s*[GgГБб]/);
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

function extractLdJsonBlocks(html: string): LdJsonProduct[] {
  const products: LdJsonProduct[] = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed["@type"] === "Product") {
        products.push(parsed);
      }
    } catch {
      // Skip invalid JSON
    }
  }
  
  return products;
}

function extractMainPriceFromPatches(html: string): number | null {
  // Try greenPrice first (Ya Pay discounted price)
  const greenPriceMatch = html.match(/"greenPrice":\s*\{\s*"price":\s*\{\s*"value":\s*(\d+)/);
  if (greenPriceMatch) {
    return parseInt(greenPriceMatch[1], 10);
  }
  
  // Try mainPrice
  const mainPriceMatch = html.match(/"mainPrice":\s*\{\s*"price":\s*\{\s*"value":\s*(\d+)/);
  if (mainPriceMatch) {
    return parseInt(mainPriceMatch[1], 10);
  }
  
  // Try actualPrice
  const actualPriceMatch = html.match(/"actualPrice":\s*\{\s*"amount":\s*\{\s*"intPart":\s*(\d+)/);
  if (actualPriceMatch) {
    return parseInt(actualPriceMatch[1], 10);
  }
  
  return null;
}

function extractOldPriceFromPatches(html: string): number | null {
  // Look for oldPrice near mainPrice context
  const oldPriceMatch = html.match(/"oldPrice":\s*(\d+)/);
  if (oldPriceMatch) {
    return parseInt(oldPriceMatch[1], 10);
  }
  return null;
}

function extractSellerInfoFromPatches(html: string): { name: string; id: string } | null {
  // Try shopInfo pattern
  const shopInfoMatch = html.match(/"shopInfo":\s*\{\s*"[^"]+"\s*:\s*\{\s*"name":\s*"([^"]+)"/);
  if (shopInfoMatch) {
    return { name: shopInfoMatch[1], id: "" };
  }
  
  // Try shopName pattern
  const shopNameMatch = html.match(/"shopName":\s*"([^"]+)"/);
  if (shopNameMatch) {
    // Try to find businessId nearby
    const businessIdMatch = html.match(/"businessId":\s*"?(\d+)"?/);
    return { 
      name: shopNameMatch[1], 
      id: businessIdMatch ? businessIdMatch[1] : "" 
    };
  }
  
  // Try supplierName
  const supplierMatch = html.match(/"supplierName":\s*"([^"]+)"/);
  if (supplierMatch) {
    const supplierIdMatch = html.match(/"supplierId":\s*"?(\d+)"?/);
    return {
      name: supplierMatch[1],
      id: supplierIdMatch ? supplierIdMatch[1] : ""
    };
  }
  
  return null;
}

function extractProductUrlFromPatches(html: string): string | null {
  // Look for card URL pattern
  const urlMatch = html.match(/"link":\s*"(https:\/\/market\.yandex\.ru\/card\/[^"?]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return null;
}

function extractPrimaryOfferId(html: string): string | null {
  // Look for isPrimary:true context to find primary offer
  const primaryMatch = html.match(/"isPrimary":\s*true[^}]*"offerId":\s*"([^"]+)"/);
  if (primaryMatch) {
    return primaryMatch[1];
  }
  
  // Alternative: find offerId near mainDO path
  const mainDoMatch = html.match(/mainDO[^}]*"offerId":\s*"([^"]+)"/);
  if (mainDoMatch) {
    return mainDoMatch[1];
  }
  
  // Look for data-offer-id attribute
  const dataOfferMatch = html.match(/data-offer-id="([^"]+)"/);
  if (dataOfferMatch) {
    return dataOfferMatch[1];
  }
  
  return null;
}

function extractProductTitle(html: string): string | null {
  // Try skuTitle from patches first (most accurate for current SKU)
  const skuTitleMatch = html.match(/"skuTitle":\s*"([^"]+)"/);
  if (skuTitleMatch) {
    return skuTitleMatch[1];
  }
  
  // Try title from patches
  const titleMatch = html.match(/"title":\s*"(Смартфон[^"]+)"/);
  if (titleMatch) {
    return titleMatch[1];
  }
  
  // Fallback to LD+JSON (may be a related product)
  const ldProducts = extractLdJsonBlocks(html);
  if (ldProducts.length > 0 && ldProducts[0].name) {
    return ldProducts[0].name;
  }
  
  return null;
}

function extractVariantFromUrl(url: string): { key: string; label: string } | null {
  // Pattern: /card/smartfon-...-4128-gb-... or /card/...-12256-gb-...
  const match = url.match(/[\/-](\d+)(\d{3})-g[b]?[\/-]/i);
  if (match) {
    const combined = match[1] + match[2];
    // Try to split: 4128 -> 4/128, 12256 -> 12/256, 8256 -> 8/256
    if (combined.length === 4) {
      const ram = combined[0];
      const storage = combined.slice(1);
      return { key: `${ram}/${storage}`, label: `${ram} GB / ${storage} GB` };
    } else if (combined.length === 5) {
      const ram = combined.slice(0, 2);
      const storage = combined.slice(2);
      return { key: `${ram}/${storage}`, label: `${ram} GB / ${storage} GB` };
    }
  }
  return null;
}

export function parseYandexPrices(html: string): YandexOffer[] {
  const results: YandexOffer[] = [];
  
  // Strategy 1: Parse LD+JSON schema (most reliable)
  const ldProducts = extractLdJsonBlocks(html);
  
  for (const product of ldProducts) {
    const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
    
    for (const offer of offers) {
      if (!offer.price) continue;
      
      const price = typeof offer.price === "string" ? parseFloat(offer.price) : offer.price;
      if (isNaN(price) || price <= 0) continue;
      
      const title = product.name ?? "";
      const variant = extractVariantFromTitle(title);
      
      const yandexOffer: YandexOffer = {
        offerId: extractPrimaryOfferId(html) ?? `ld-${Date.now()}`,
        sellerName: offer.seller?.name ?? "",
        sellerId: offer.seller?.["@id"] ?? "",
        priceMinorUnits: toMinorUnits(price),
        currency: normalizeCurrency(offer.priceCurrency ?? "RUB"),
        isAvailable: offer.availability !== "OutOfStock",
        isPrimary: true,
        url: product.url ?? offer.url,
      };
      
      if (variant) {
        yandexOffer.variantKey = variant.key;
        yandexOffer.variantLabel = variant.label;
      }
      
      results.push(yandexOffer);
    }
  }
  
  // If LD+JSON gave us results, return them
  if (results.length > 0) {
    // Enhance with additional data from patches
    const sellerInfo = extractSellerInfoFromPatches(html);
    const productUrl = extractProductUrlFromPatches(html);
    const oldPrice = extractOldPriceFromPatches(html);
    const mainPrice = extractMainPriceFromPatches(html);
    const patchTitle = extractProductTitle(html);
    
    for (const offer of results) {
      if (!offer.sellerName && sellerInfo) {
        offer.sellerName = sellerInfo.name;
        offer.sellerId = sellerInfo.id;
      }
      if (!offer.url && productUrl) {
        offer.url = productUrl;
      }
      
      // Extract variant from URL (most reliable) or patch title
      const urlToCheck = offer.url ?? productUrl;
      if (urlToCheck) {
        const urlVariant = extractVariantFromUrl(urlToCheck);
        if (urlVariant) {
          offer.variantKey = urlVariant.key;
          offer.variantLabel = urlVariant.label;
        }
      }
      if (!offer.variantKey && patchTitle) {
        const titleVariant = extractVariantFromTitle(patchTitle);
        if (titleVariant) {
          offer.variantKey = titleVariant.key;
          offer.variantLabel = titleVariant.label;
        }
      }
      
      if (oldPrice && oldPrice > offer.priceMinorUnits / 100) {
        offer.oldPriceMinorUnits = toMinorUnits(oldPrice);
        const discount = Math.round((1 - (offer.priceMinorUnits / 100) / oldPrice) * 100);
        if (discount > 0 && discount < 100) {
          offer.discountPercent = discount;
        }
      }
      // Use greenPrice/mainPrice if available (may be better deal)
      if (mainPrice && mainPrice < offer.priceMinorUnits / 100) {
        offer.priceMinorUnits = toMinorUnits(mainPrice);
      }
    }
    
    return results;
  }
  
  // Strategy 2: Fallback to patch extraction
  const mainPrice = extractMainPriceFromPatches(html);
  if (!mainPrice) {
    return [];
  }
  
  const sellerInfo = extractSellerInfoFromPatches(html);
  const productUrl = extractProductUrlFromPatches(html);
  const oldPrice = extractOldPriceFromPatches(html);
  const title = extractProductTitle(html);
  const variant = title ? extractVariantFromTitle(title) : null;
  const offerId = extractPrimaryOfferId(html);
  
  const offer: YandexOffer = {
    offerId: offerId ?? `patch-${Date.now()}`,
    sellerName: sellerInfo?.name ?? "",
    sellerId: sellerInfo?.id ?? "",
    priceMinorUnits: toMinorUnits(mainPrice),
    currency: "RUB",
    isAvailable: true,
    isPrimary: true,
  };
  
  if (variant) {
    offer.variantKey = variant.key;
    offer.variantLabel = variant.label;
  }
  
  if (productUrl) {
    offer.url = productUrl;
  }
  
  if (oldPrice && oldPrice > mainPrice) {
    offer.oldPriceMinorUnits = toMinorUnits(oldPrice);
    const discount = Math.round((1 - mainPrice / oldPrice) * 100);
    if (discount > 0 && discount < 100) {
      offer.discountPercent = discount;
    }
  }
  
  results.push(offer);
  return results;
}
