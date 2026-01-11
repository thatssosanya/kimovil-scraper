#!/usr/bin/env npx tsx
/**
 * Yandex Market HTML Exploration Script
 * 
 * Explores what data can be extracted from Yandex Market product pages.
 * Run with: npx tsx scripts/explore-yandex-html.ts /tmp/yandex_realme_watch5.html
 */

import * as fs from "node:fs";

// -------------------------------------------
// LD+JSON Extraction
// -------------------------------------------

interface LdJsonProduct {
  "@type"?: string;
  name?: string;
  brand?: string | { name?: string };
  description?: string;
  image?: string;
  url?: string;
  offers?: {
    "@type"?: string;
    price?: string | number;
    priceCurrency?: string;
    availability?: string;
  };
}

interface LdJsonBreadcrumb {
  "@type"?: string;
  position?: string;
  item?: {
    "@id"?: string;
    name?: string;
  };
}

interface LdJsonBreadcrumbList {
  "@type"?: string;
  itemListElement?: LdJsonBreadcrumb[];
}

function extractLdJsonBlocks(html: string): any[] {
  const blocks: any[] = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // Skip invalid JSON
    }
  }
  
  return blocks;
}

function extractLdJsonProduct(html: string): LdJsonProduct | null {
  const blocks = extractLdJsonBlocks(html);
  for (const block of blocks) {
    if (block["@type"] === "Product") {
      return block;
    }
  }
  return null;
}

function extractLdJsonBreadcrumbs(html: string): { name: string; url?: string }[] {
  const blocks = extractLdJsonBlocks(html);
  const crumbs: { name: string; url?: string }[] = [];
  
  for (const block of blocks) {
    if (block["@type"] === "BreadcrumbList" && Array.isArray(block.itemListElement)) {
      for (const el of block.itemListElement) {
        const item = el?.item;
        if (item?.name) {
          crumbs.push({ name: item.name, url: item["@id"] });
        }
      }
    }
  }
  
  return crumbs;
}

// -------------------------------------------
// HTML Text Helpers
// -------------------------------------------

function decodeHtmlEntities(text: string): string {
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

function cleanHtmlText(htmlFragment: string): string {
  const withoutTags = htmlFragment.replace(/<[^>]*>/g, " ");
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

// -------------------------------------------
// Apiary Patches Extraction
// -------------------------------------------

interface ApiaryPatch {
  widgets: Record<string, any>;
  meta: Record<string, any>;
  collections?: Record<string, any>;
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
  canonicalUrl?: string;
} {
  for (const patch of patches) {
    const root = patch.widgets?.["@baobab/RootNodeRecoverer"];
    if (!root) continue;
    
    for (const key of Object.keys(root)) {
      const asyncAttrs = root[key]?.asyncAttrs;
      if (!asyncAttrs) continue;
      return {
        msku: asyncAttrs.msku,
        modelId: asyncAttrs.modelId?.toString(),
        businessId: asyncAttrs.businessId?.toString(),
        canonicalUrl: asyncAttrs.relCanonical,
      };
    }
  }
  return {};
}

function extractRating(patches: ApiaryPatch[]): {
  ratingValue?: number;
  ratingCount?: number;
  reviewCount?: number;
} {
  let best: any = null;
  
  function scan(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) scan(item);
      return;
    }
    
    if (
      typeof obj.rating === "number" &&
      (typeof obj.opinions === "number" || 
       typeof obj.reviews === "number" || 
       typeof obj.reviewsCount === "number")
    ) {
      best = obj;
    }
    
    for (const v of Object.values(obj)) scan(v);
  }
  
  for (const patch of patches) {
    for (const w of Object.values(patch.widgets || {})) {
      for (const payload of Object.values(w as any)) scan(payload);
    }
  }
  
  if (!best) return {};
  return {
    ratingValue: best.rating,
    ratingCount: best.votes ?? best.opinions ?? best.reviews ?? best.reviewsCount,
    reviewCount: best.reviews ?? best.reviewsCount ?? best.opinions,
  };
}

interface YandexSpecItem {
  section?: string;
  name: string;
  value: string;
}

interface SpecSection {
  id: string;
  name: string;
  start: number;
  end: number;
}

function findSpecSections(html: string): SpecSection[] {
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

function extractSpecs(html: string): YandexSpecItem[] {
  const result: YandexSpecItem[] = [];
  const sections = findSpecSections(html);

  // Regex for spec names
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

// -------------------------------------------
// Image Extraction
// -------------------------------------------

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function toOrigUrl(url: string): string {
  // Normalize Yandex image URLs to /orig resolution
  // Example: .../120x160 → .../orig
  return url.replace(/\/\d+x\d+(?:_[a-z]+)?(?=\/|$|")/g, "/orig");
}

function extractImages(html: string): {
  primaryImageUrl?: string;
  galleryImageUrls: string[];
} {
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

// -------------------------------------------
// Main Analysis
// -------------------------------------------

function analyzeHtml(html: string): void {
  console.log("=".repeat(60));
  console.log("YANDEX MARKET HTML ANALYSIS");
  console.log("=".repeat(60));
  console.log();

  // 1. LD+JSON Product
  console.log("1. LD+JSON PRODUCT DATA");
  console.log("-".repeat(40));
  const product = extractLdJsonProduct(html);
  if (product) {
    console.log(`  Name: ${product.name}`);
    console.log(`  Brand: ${typeof product.brand === "string" ? product.brand : product.brand?.name}`);
    console.log(`  Image: ${product.image}`);
    console.log(`  URL: ${product.url}`);
    console.log(`  Price: ${product.offers?.price} ${product.offers?.priceCurrency}`);
    console.log(`  Availability: ${product.offers?.availability}`);
  } else {
    console.log("  Not found");
  }
  console.log();

  // 2. Breadcrumbs
  console.log("2. BREADCRUMBS (Category Path)");
  console.log("-".repeat(40));
  const breadcrumbs = extractLdJsonBreadcrumbs(html);
  if (breadcrumbs.length > 0) {
    for (const crumb of breadcrumbs) {
      console.log(`  → ${crumb.name}`);
    }
  } else {
    console.log("  Not found");
  }
  console.log();

  // 3. Apiary Patches
  console.log("3. APIARY PATCHES ANALYSIS");
  console.log("-".repeat(40));
  const patches = extractApiaryPatches(html);
  console.log(`  Found ${patches.length} patches`);
  
  // List widget names
  const widgetNames = new Set<string>();
  for (const patch of patches) {
    for (const name of Object.keys(patch.widgets || {})) {
      widgetNames.add(name);
    }
  }
  console.log(`  Widget types: ${widgetNames.size}`);
  const interesting = [...widgetNames].filter(
    (n) => n.includes("Product") || n.includes("Gallery") || n.includes("Card") || n.includes("Rating")
  );
  if (interesting.length > 0) {
    console.log(`  Interesting widgets:`);
    for (const name of interesting.slice(0, 10)) {
      console.log(`    - ${name}`);
    }
  }
  console.log();

  // 4. Core IDs
  console.log("4. CORE IDs (from RootNodeRecoverer)");
  console.log("-".repeat(40));
  const ids = extractCoreIds(patches);
  console.log(`  MSKU: ${ids.msku ?? "not found"}`);
  console.log(`  Model ID: ${ids.modelId ?? "not found"}`);
  console.log(`  Business ID: ${ids.businessId ?? "not found"}`);
  console.log(`  Canonical URL: ${ids.canonicalUrl ?? "not found"}`);
  console.log();

  // 5. Rating
  console.log("5. RATING DATA");
  console.log("-".repeat(40));
  const rating = extractRating(patches);
  console.log(`  Rating Value: ${rating.ratingValue ?? "not found"}`);
  console.log(`  Rating Count: ${rating.ratingCount ?? "not found"}`);
  console.log(`  Review Count: ${rating.reviewCount ?? "not found"}`);
  console.log();

  // 6. Images
  console.log("6. IMAGES");
  console.log("-".repeat(40));
  const images = extractImages(html);
  console.log(`  Primary Image: ${images.primaryImageUrl ?? "not found"}`);
  console.log(`  Gallery Images: ${images.galleryImageUrls.length} found`);
  if (images.galleryImageUrls.length > 0) {
    for (const url of images.galleryImageUrls.slice(0, 5)) {
      console.log(`    - ${url}`);
    }
    if (images.galleryImageUrls.length > 5) {
      console.log(`    ... and ${images.galleryImageUrls.length - 5} more`);
    }
  }
  console.log();

  // 7. Specs (from rendered HTML, not patches)
  console.log("7. SPECIFICATIONS");
  console.log("-".repeat(40));
  const specs = extractSpecs(html);
  if (specs.length > 0) {
    console.log(`  Found ${specs.length} spec items`);
    const grouped = new Map<string, YandexSpecItem[]>();
    for (const spec of specs) {
      const section = spec.section || "Unknown";
      if (!grouped.has(section)) grouped.set(section, []);
      grouped.get(section)!.push(spec);
    }
    for (const [section, items] of grouped) {
      console.log(`  [${section}]`);
      for (const item of items.slice(0, 3)) {
        console.log(`    ${item.name}: ${item.value}`);
      }
      if (items.length > 3) {
        console.log(`    ... and ${items.length - 3} more`);
      }
    }
  } else {
    console.log("  No specs found in HTML");
    console.log("  (Section labels or product-spec spans not detected)");
  }
  console.log();

  // 8. Summary
  console.log("=".repeat(60));
  console.log("SUMMARY: Extractable Data");
  console.log("=".repeat(60));
  console.log(`  ✓ Product Name: ${product?.name ? "Yes" : "No"}`);
  console.log(`  ✓ Brand: ${product?.brand ? "Yes" : "No"}`);
  console.log(`  ✓ Price: ${product?.offers?.price ? "Yes" : "No"}`);
  console.log(`  ✓ Primary Image: ${images.primaryImageUrl ? "Yes" : "No"}`);
  console.log(`  ✓ Gallery Images: ${images.galleryImageUrls.length > 1 ? `Yes (${images.galleryImageUrls.length})` : "No"}`);
  console.log(`  ✓ Breadcrumbs: ${breadcrumbs.length > 0 ? `Yes (${breadcrumbs.length} levels)` : "No"}`);
  console.log(`  ✓ IDs (msku/modelId): ${ids.msku ? "Yes" : "No"}`);
  console.log(`  ✓ Rating: ${rating.ratingValue ? "Yes" : "No"}`);
  console.log(`  ✓ Specs: ${specs.length > 0 ? `Yes (${specs.length} items)` : "No"}`);
  console.log();
}

// -------------------------------------------
// CLI Entry Point
// -------------------------------------------

const htmlPath = process.argv[2];

if (!htmlPath) {
  console.error("Usage: npx tsx scripts/explore-yandex-html.ts <path-to-html>");
  console.error("Example: npx tsx scripts/explore-yandex-html.ts /tmp/yandex_realme_watch5.html");
  process.exit(1);
}

if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf-8");
analyzeHtml(html);
