import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { SqlClient } from "@effect/sql";
import { WordPressSyncService } from "../services/wordpress-sync";
import { WidgetMappingService } from "../services/widget-mapping";

interface WidgetModel {
  raw: string;
  normalized: string;
  brand: string | null;
  count: number;
  postIds: number[];
  firstSeen: string;
  lastSeen: string;
  matchedSlug: string | null;
  matchConfidence: number | null;
}

type PeriodParam = "1m" | "3m" | "6m" | "all";

const PERIOD_DAYS: Record<PeriodParam, number | null> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "all": null,
};

interface WidgetStats {
  totalModels: number;
  uniqueModels: number;
  postsWithWidgets: number;
  matchedCount: number;
  unmatchedCount: number;
}

const BRAND_PATTERNS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /\b(apple|iphone|ipad|airpods|macbook)\b/i, brand: "Apple" },
  { pattern: /\b(samsung|galaxy)\b/i, brand: "Samsung" },
  { pattern: /\b(xiaomi|redmi|poco|mijia)\b/i, brand: "Xiaomi" },
  { pattern: /\b(huawei|honor|mate\s*pad|magic\s*book)\b/i, brand: "Huawei/Honor" },
  { pattern: /\b(oneplus|one\s*plus)\b/i, brand: "OnePlus" },
  { pattern: /\b(realme)\b/i, brand: "Realme" },
  { pattern: /\b(oppo)\b/i, brand: "OPPO" },
  { pattern: /\b(vivo|iqoo)\b/i, brand: "Vivo/iQOO" },
  { pattern: /\b(google|pixel)\b/i, brand: "Google" },
  { pattern: /\b(sony|playstation|xperia)\b/i, brand: "Sony" },
  { pattern: /\b(nintendo|switch)\b/i, brand: "Nintendo" },
  { pattern: /\b(tecno)\b/i, brand: "Tecno" },
  { pattern: /\b(infinix)\b/i, brand: "Infinix" },
  { pattern: /\b(nothing|cmf)\b/i, brand: "Nothing" },
  { pattern: /\b(amazfit)\b/i, brand: "Amazfit" },
  { pattern: /\b(garmin)\b/i, brand: "Garmin" },
  { pattern: /\b(asus|rog)\b/i, brand: "ASUS" },
  { pattern: /\b(lenovo|legion)\b/i, brand: "Lenovo" },
  { pattern: /\b(motorola|moto)\b/i, brand: "Motorola" },
  { pattern: /\b(zte|nubia|red\s*magic)\b/i, brand: "ZTE/Nubia" },
  { pattern: /\b(hisense)\b/i, brand: "Hisense" },
  { pattern: /\b(tuvio)\b/i, brand: "Tuvio" },
  { pattern: /\b(haier)\b/i, brand: "Haier" },
  { pattern: /\b(tcl)\b/i, brand: "TCL" },
  { pattern: /\b(jbl)\b/i, brand: "JBL" },
  { pattern: /\b(beats)\b/i, brand: "Beats" },
  { pattern: /\b(anker|soundcore)\b/i, brand: "Anker" },
  { pattern: /\b(baseus)\b/i, brand: "Baseus" },
  { pattern: /\b(ugreen)\b/i, brand: "Ugreen" },
  { pattern: /\b(logitech)\b/i, brand: "Logitech" },
  { pattern: /\b(razer)\b/i, brand: "Razer" },
  { pattern: /\b(steam\s*deck)\b/i, brand: "Valve" },
  { pattern: /\b(retroid)\b/i, brand: "Retroid" },
  { pattern: /\b(divoom)\b/i, brand: "Divoom" },
  { pattern: /\b(casio)\b/i, brand: "Casio" },
  { pattern: /\b(tissot|swatch|mido|certina)\b/i, brand: "Swatch Group" },
  { pattern: /\b(orient)\b/i, brand: "Orient" },
  { pattern: /\b(fossil)\b/i, brand: "Fossil" },
  { pattern: /\b(diesel)\b/i, brand: "Diesel" },
  { pattern: /\b(armani)\b/i, brand: "Armani" },
  { pattern: /\b(tommy\s*hilfiger)\b/i, brand: "Tommy Hilfiger" },
  { pattern: /\b(victorinox)\b/i, brand: "Victorinox" },
  { pattern: /\b(polar)\b/i, brand: "Polar" },
  { pattern: /\b(delonghi|de'longhi)\b/i, brand: "DeLonghi" },
  { pattern: /\b(tefal)\b/i, brand: "Tefal" },
  { pattern: /\b(dreame)\b/i, brand: "Dreame" },
  { pattern: /\b(hoto)\b/i, brand: "HOTO" },
  { pattern: /\b(huohou)\b/i, brand: "HuoHou" },
  { pattern: /\b(nextool)\b/i, brand: "NexTool" },
  { pattern: /\b(gigabyte)\b/i, brand: "Gigabyte" },
  { pattern: /\b(msi)\b/i, brand: "MSI" },
  { pattern: /\b(молния)\b/i, brand: "Молния" },
  { pattern: /\b(восток)\b/i, brand: "Восток" },
];

function detectBrand(text: string): string | null {
  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(text)) {
      return brand;
    }
  }
  return null;
}

const MODEL_SUFFIXES = ["pro", "max", "ultra", "plus", "lite", "se", "mini", "slim", "xl", "fe"];

function normalizeModel(raw: string): string {
  let text = raw.toLowerCase();
  
  // Remove common prefixes
  text = text.replace(/^(смартфон|телефон|планшет|ноутбук|монитор|телевизор|наушники|часы|смарт-часы|фитнес-браслет)\s+/gi, "");
  
  // Remove marketplace suffixes
  text = text.replace(/\s*[—–-]\s*купить.*$/i, "");
  text = text.replace(/\s+на яндекс маркете?$/i, "");
  text = text.replace(/\s+в интернет-магазине.*$/i, "");
  
  // Remove storage/RAM specs
  text = text.replace(/\b\d+\s*(gb|гб|tb|тб)\b/gi, "");
  text = text.replace(/\b\d+\/\d+\s*(gb|гб)\b/gi, "");
  
  // Remove processor specs (careful not to match model numbers like M7, A15)
  text = text.replace(/\b(qualcomm\s+)?snapdragon\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\b(mediatek\s+)?(dimensity|helio)\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\bapple\s+[am]\d+\s*(pro|max|ultra)?\b/gi, ""); // Only with "apple" prefix
  text = text.replace(/\bexynos\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\bkirin\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\btensor\s*(g\d+)?\b/gi, "");
  
  // Remove 4G suffix (5G kept for now, handled in matching)
  text = text.replace(/\b4g\b/gi, "");
  
  // Remove colors (including Russian compound colors like "альфа-черный")
  const colors = [
    "черный", "black", "белый", "white", "синий", "blue", "красный", "red",
    "зеленый", "green", "серый", "gray", "grey", "золотой", "gold", "серебристый",
    "silver", "розовый", "pink", "фиолетовый", "purple", "violet", "оранжевый",
    "orange", "желтый", "yellow", "graphite", "графитовый", "titanium", "титановый",
    "midnight", "starlight", "сияющая звезда", "космический", "space", "obsidian",
    "peony", "sage", "teal", "бирюзовый", "альфа-черный", "альфа-белый"
  ];
  for (const color of colors) {
    text = text.replace(new RegExp(`\\b${color}\\b`, "gi"), "");
  }
  
  // Remove version markers
  text = text.replace(/\b(global|глобальная|eu|ru|cn|china|europe|россия|ростест|eac)\b/gi, "");
  text = text.replace(/\b(версия|version)\b/gi, "");
  text = text.replace(/\b(dual|nano|esim|sim)\b/gi, "");
  
  // Remove marketing words
  text = text.replace(/\b(новый|new|оригинал|original)\b/gi, "");
  text = text.replace(/\b(без rustore|не установлен rustore)\b/gi, "");
  
  // Remove trailing/leading commas and clean up
  text = text.replace(/,\s*,/g, ",");
  text = text.replace(/^[,\s]+|[,\s]+$/g, "");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  
  // Remove trailing punctuation/parentheses content
  text = text.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  text = text.replace(/\s*,\s*$/, "").trim();
  
  return text;
}

function toSlugForm(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Generate multiple slug variants to handle inconsistent naming (gt7 vs gt-7)
function toSlugVariants(text: string): string[] {
  const base = toSlugForm(text);
  const variants = new Set<string>([base]);
  
  // Add variant with numbers attached to preceding letters (gt-7 -> gt7)
  const collapsed = base.replace(/-(\d)/g, "$1");
  if (collapsed !== base) variants.add(collapsed);
  
  // Add variant with numbers separated (gt7 -> gt-7)
  const expanded = base.replace(/([a-z])(\d)/g, "$1-$2");
  if (expanded !== base) variants.add(expanded);
  
  // For 5G models, also try without 5G suffix (fallback to base model)
  if (base.includes("5g")) {
    const without5g = base.replace(/-?5g-?/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    variants.add(without5g);
    // Also add collapsed/expanded variants of the non-5G version
    variants.add(without5g.replace(/-(\d)/g, "$1"));
    variants.add(without5g.replace(/([a-z])(\d)/g, "$1-$2"));
  }
  
  return [...variants];
}

function extractSuffixes(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const suffix of MODEL_SUFFIXES) {
    if (new RegExp(`\\b${suffix}\\b`).test(lower)) {
      found.add(suffix);
    }
  }
  return found;
}

interface MatchResult {
  slug: string;
  confidence: number;
}

function findBestMatch(normalized: string, devices: ReadonlyArray<{ slug: string; name: string }>, brand: string | null): MatchResult | null {
  const slugVariants = toSlugVariants(normalized);
  const modelSuffixes = extractSuffixes(normalized);
  
  // Also try with brand prefix (e.g., "iphone 17" -> "apple-iphone-17")
  const brandVariants = brand ? toSlugVariants(`${brand} ${normalized}`) : [];
  const allVariants = [...slugVariants, ...brandVariants];
  
  let bestMatch: MatchResult | null = null;
  
  for (const device of devices) {
    const deviceSlug = device.slug;
    const deviceSuffixes = extractSuffixes(device.name);
    
    // Exact slug match (any variant)
    if (allVariants.includes(deviceSlug)) {
      return { slug: deviceSlug, confidence: 1.0 };
    }
    
    // Check if slugs share the same base (one is prefix of the other + suffix)
    let matches = false;
    for (const variant of allVariants) {
      if (deviceSlug.startsWith(variant + "-") || variant.startsWith(deviceSlug + "-") ||
          deviceSlug.endsWith("-" + variant) || variant.endsWith("-" + deviceSlug) ||
          deviceSlug === variant.replace(/-(?:pro|max|ultra|plus|lite|se|mini|slim|xl|fe).*$/, "")) {
        matches = true;
        break;
      }
    }
    
    if (!matches) continue;
    
    // Calculate suffix match score
    const modelHasSuffix = modelSuffixes.size > 0;
    const deviceHasSuffix = deviceSuffixes.size > 0;
    
    // Check if all model suffixes are in device
    const allSuffixesMatch = [...modelSuffixes].every(s => deviceSuffixes.has(s));
    // Check if device has extra suffixes not in model
    const deviceHasExtraSuffixes = [...deviceSuffixes].some(s => !modelSuffixes.has(s));
    
    let confidence = 0;
    
    if (modelHasSuffix && allSuffixesMatch && !deviceHasExtraSuffixes) {
      // Model has suffixes and device matches exactly (e.g., "GT8 Pro" -> "realme-gt-8-pro")
      confidence = 0.95;
    } else if (!modelHasSuffix && !deviceHasSuffix) {
      // Neither has suffixes - base model match (e.g., "iPhone 17" -> "iphone-17")
      confidence = 0.9;
    } else if (!modelHasSuffix && deviceHasSuffix) {
      // Model is base but device has suffix - wrong match (e.g., "iPhone 17" -> "iphone-17-pro-max")
      confidence = 0.3;
    } else if (modelHasSuffix && !allSuffixesMatch) {
      // Model has suffixes that device doesn't have
      confidence = 0.4;
    } else if (modelHasSuffix && deviceHasExtraSuffixes) {
      // Device has more suffixes than model
      confidence = 0.5;
    }
    
    if (bestMatch === null || confidence > bestMatch.confidence) {
      bestMatch = { slug: deviceSlug, confidence };
    }
  }
  
  return bestMatch;
}

type WidgetCacheRow = {
  raw: string;
  count: number;
  post_ids: string;
  first_seen: string;
  last_seen: string;
};

export const createWidgetDebugRoutes = () =>
  new Elysia({ prefix: "/api/widget-debug" })
    .get(
      "/models",
      async ({ query }) => {
        const period = (query.period as PeriodParam) || "3m";
        const days = PERIOD_DAYS[period];

        const program = Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          // Calculate from_date based on period
          const fromDate =
            days !== null
              ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .replace("Z", "")
              : null;

          // Query widget cache grouped by search_text (only from published posts)
          const widgetRows = yield* sql<WidgetCacheRow>`
            SELECT 
              w.search_text as raw,
              COUNT(*) as count,
              GROUP_CONCAT(DISTINCT w.post_id) as post_ids,
              MIN(w.post_date_gmt) as first_seen,
              MAX(w.post_date_gmt) as last_seen
            FROM wordpress_widget_cache w
            JOIN wp_posts_cache p ON w.post_id = p.post_id
            WHERE (${fromDate} IS NULL OR w.post_date_gmt >= ${fromDate})
              AND p.status = 'publish'
            GROUP BY w.search_text
            ORDER BY count DESC
          `;

          // Get all device slugs for matching
          const devices = yield* sql<{
            slug: string;
            name: string;
            brand: string | null;
          }>`
            SELECT slug, name, brand FROM devices
          `;

          // Process widget data using token-based matching
          const models: WidgetModel[] = widgetRows.map((row) => {
            const normalized = normalizeModel(row.raw);
            const brand = detectBrand(row.raw);
            const postIds = row.post_ids
              .split(",")
              .map((id) => parseInt(id, 10));

            // Use token-based matching with brand for slug prefix
            const match = findBestMatch(normalized, devices, brand);

            return {
              raw: row.raw,
              normalized,
              brand,
              count: Number(row.count),
              postIds,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
              matchedSlug: match?.slug ?? null,
              matchConfidence: match?.confidence ?? null,
            };
          });

          // Calculate stats
          const stats: WidgetStats = {
            totalModels: models.reduce((sum, m) => sum + m.count, 0),
            uniqueModels: models.length,
            postsWithWidgets: new Set(models.flatMap((m) => m.postIds)).size,
            matchedCount: models.filter((m) => m.matchedSlug !== null).length,
            unmatchedCount: models.filter((m) => m.matchedSlug === null).length,
          };

          return { stats, models, period };
        });

        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          period: t.Optional(
            t.Union([
              t.Literal("1m"),
              t.Literal("3m"),
              t.Literal("6m"),
              t.Literal("all"),
            ]),
          ),
        }),
      },
    )
    .get("/sync-status", async () => {
      const program = Effect.gen(function* () {
        const syncService = yield* WordPressSyncService;
        const status = yield* syncService.getSyncStatus();
        return {
          lastSyncedAt: status.lastRunAt,
          lastModifiedGmt: status.lastSyncedModifiedGmt,
          postsCount: status.totalPosts,
          widgetsCount: status.totalWidgets,
        };
      });

      return await LiveRuntime.runPromise(program);
    })
    .post("/refresh", async () => {
      const program = Effect.gen(function* () {
        const syncService = yield* WordPressSyncService;
        const mappingService = yield* WidgetMappingService;
        
        // Sync posts from WordPress
        const syncResult = yield* syncService.syncPosts();
        
        // Sync mappings to update last_seen_at timestamps
        const mappingResult = yield* mappingService.syncMappings();
        
        return {
          success: true,
          postsProcessed: syncResult.postsProcessed,
          postsInserted: syncResult.postsInserted,
          postsUpdated: syncResult.postsUpdated,
          postsSkipped: syncResult.postsSkipped,
          widgetsInserted: syncResult.widgetsInserted,
          mappingsCreated: mappingResult.created,
          mappingsUpdated: mappingResult.updated,
        };
      });

      return await LiveRuntime.runPromise(program);
    });
