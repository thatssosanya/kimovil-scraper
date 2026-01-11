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

export interface YandexSpecItem {
  section?: string;
  name: string;
  value: string;
}

export interface YandexImages {
  primaryImageUrl?: string;
  galleryImageUrls: string[];
}

export interface YandexProduct {
  name?: string;
  brand?: string;
  msku?: string;
  modelId?: string;
  businessId?: string;
  breadcrumbs: { name: string; url?: string }[];
}

interface SpecSection {
  id: string;
  name: string;
  start: number;
  end: number;
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

// -------------------------------------------
// HTML Text Helpers
// -------------------------------------------

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/·/g, "·")
    .replace(/&#(\d+);/g, (_, code) => {
      const c = Number(code);
      return Number.isFinite(c) ? String.fromCharCode(c) : _;
    });
}

export function cleanHtmlText(htmlFragment: string): string {
  const withoutTags = htmlFragment.replace(/<[^>]*>/g, " ");
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

export function findSpecSections(html: string): SpecSection[] {
  const sections: SpecSection[] = [];
  const sectionLabelRe = /<label[^>]*for="group-collapse-([^"]+)"[^>]*>([\s\S]*?)<\/label>/g;

  let m: RegExpExecArray | null;
  while ((m = sectionLabelRe.exec(html)) !== null) {
    const id = m[1];
    const rawInner = m[2];
    const name = cleanHtmlText(rawInner);
    const start = sectionLabelRe.lastIndex;
    sections.push({ id, name, start, end: html.length });
  }

  // Set end = start of next section
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].end = sections[i + 1].start;
  }

  return sections;
}

// -------------------------------------------
// Image Helpers
// -------------------------------------------

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function toOrigUrl(url: string): string {
  // Normalize Yandex image URLs to /orig resolution
  return url.replace(/\/\d+x\d+(?:_[a-z]+)?(?=\/|$|")/g, "/orig");
}

// -------------------------------------------
// Apiary Patches Helpers
// -------------------------------------------

interface ApiaryPatch {
  widgets: Record<string, unknown>;
  meta: Record<string, unknown>;
  collections?: Record<string, unknown>;
}

function extractApiaryPatches(html: string): ApiaryPatch[] {
  const patches: ApiaryPatch[] = [];
  const re = /<noframes[^>]+data-apiary="patch"[^>]*>([\s\S]*?)<\/noframes>/g;

  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      patches.push(JSON.parse(m[1]));
    } catch {
      // Skip invalid JSON
    }
  }

  return patches;
}

function extractCoreIds(patches: ApiaryPatch[]): {
  msku?: string;
  modelId?: string;
  businessId?: string;
} {
  for (const patch of patches) {
    const root = patch.widgets?.["@baobab/RootNodeRecoverer"] as Record<string, { asyncAttrs?: Record<string, unknown> }> | undefined;
    if (!root) continue;

    for (const key of Object.keys(root)) {
      const asyncAttrs = root[key]?.asyncAttrs;
      if (!asyncAttrs) continue;
      return {
        msku: asyncAttrs.msku as string | undefined,
        modelId: asyncAttrs.modelId?.toString(),
        businessId: asyncAttrs.businessId?.toString(),
      };
    }
  }
  return {};
}

// -------------------------------------------
// Extraction Functions
// -------------------------------------------

export function parseYandexSpecs(html: string): YandexSpecItem[] {
  const result: YandexSpecItem[] = [];
  const sections = findSpecSections(html);

  const nameRe = /<span[^>]*data-auto="product-spec"[^>]*>([\s\S]*?)<\/span>/g;

  for (const section of sections) {
    const block = html.slice(section.start, section.end);
    nameRe.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(block)) !== null) {
      const rawName = m[1];
      const name = cleanHtmlText(rawName);
      if (!name) continue;

      const nameEndInBlock = nameRe.lastIndex;

      // Look ahead in limited window for value span
      const valueWindowEnd = Math.min(block.length, nameEndInBlock + 2000);
      const valueWindow = block.slice(nameEndInBlock, valueWindowEnd);

      // First span WITHOUT data-auto="product-spec"
      const valueRe = /<span(?![^>]*data-auto="product-spec")[^>]*>([\s\S]*?)<\/span>/;
      const vm = valueRe.exec(valueWindow);
      if (!vm) continue;

      const rawValue = vm[1];
      const value = cleanHtmlText(rawValue);
      if (!value) continue;

      result.push({
        section: section.name,
        name,
        value,
      });
    }
  }

  return result;
}

export function parseYandexImages(html: string): YandexImages {
  const urls: string[] = [];

  // Extract from srcset/srcSet attributes
  const attrRe = /(?:srcset|srcSet)="([^"]*avatars\.mds\.yandex\.net[^"]*)"/g;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const srcset = m[1];
    for (const url of parseSrcset(srcset)) {
      if (url.includes("avatars.mds.yandex.net")) {
        urls.push(toOrigUrl(url));
      }
    }
  }

  // Also extract from src attributes
  const srcRe = /src="(https?:\/\/avatars\.mds\.yandex\.net[^"]+)"/g;
  while ((m = srcRe.exec(html)) !== null) {
    if (m[1].includes("/get-mpic/")) {
      urls.push(toOrigUrl(m[1]));
    }
  }

  // Dedupe and filter to only /orig URLs
  const unique = [...new Set(urls)].filter((url) => url.includes("/orig"));

  return {
    primaryImageUrl: unique[0],
    galleryImageUrls: unique,
  };
}

function extractH1Title(html: string): string | null {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return null;
  const text = h1Match[1].replace(/<[^>]+>/g, "").trim();
  return text || null;
}

function extractOgTitle(html: string): string | null {
  const match = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
  if (!match) return null;
  let title = match[1];
  const idx = title.indexOf(" — ");
  if (idx > 0) title = title.slice(0, idx);
  return title.trim() || null;
}

export function parseYandexProduct(html: string): YandexProduct {
  const result: YandexProduct = {
    breadcrumbs: [],
  };

  // Extract from LD+JSON Product block
  const ldJsonPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  
  // Collect all Product blocks to find the main one
  const productBlocks: Array<{ name?: string; brand?: unknown; offers?: unknown; aggregateRating?: unknown }> = [];
  
  while ((match = ldJsonPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);

      // Collect Product data for later selection
      if (parsed["@type"] === "Product") {
        productBlocks.push(parsed);
      }

      // Extract breadcrumbs from BreadcrumbList
      if (parsed["@type"] === "BreadcrumbList" && Array.isArray(parsed.itemListElement)) {
        for (const el of parsed.itemListElement) {
          const item = el?.item;
          if (item?.name) {
            result.breadcrumbs.push({ name: item.name, url: item["@id"] });
          }
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }
  
  // Find the main product: prefer blocks with offers or aggregateRating (main product has these, card products don't)
  const mainProduct = 
    productBlocks.find(p => p.offers && p.aggregateRating) ??
    productBlocks.find(p => p.offers) ??
    productBlocks.find(p => p.aggregateRating) ??
    productBlocks[0];
  
  // Priority for product name:
  // 1. <h1> tag - most accurate for actual SKU/variant being shown
  // 2. og:title (without store suffix)
  // 3. LD+JSON (fallback - often gives model name, not SKU name)
  result.name = extractH1Title(html) ?? extractOgTitle(html) ?? mainProduct?.name;
  
  // Brand from LD+JSON
  if (mainProduct) {
    if (typeof mainProduct.brand === "string") {
      result.brand = mainProduct.brand;
    } else if ((mainProduct.brand as { name?: string })?.name) {
      result.brand = (mainProduct.brand as { name: string }).name;
    }
  }

  // Extract msku/modelId/businessId from apiary patches
  const patches = extractApiaryPatches(html);
  const ids = extractCoreIds(patches);
  result.msku = ids.msku;
  result.modelId = ids.modelId;
  result.businessId = ids.businessId;

  return result;
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
