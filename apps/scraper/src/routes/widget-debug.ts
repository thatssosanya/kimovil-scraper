import { Elysia } from "elysia";
import { Effect } from "effect";
import { LiveRuntime } from "../layers/live";
import { SqlClient } from "@effect/sql";

interface WidgetModel {
  raw: string;
  normalized: string;
  brand: string | null;
  count: number;
  postIds: number[];
  matchedSlug: string | null;
  matchConfidence: number | null;
}

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

// Hardcoded widget data extracted from WordPress
// In production, this would come from a database or be fetched from WordPress API
const WIDGET_DATA = [
  { raw: "Honor 400 Pro", postIds: [444168, 442883, 443857, 444861, 443639, 443008, 442866] },
  { raw: "Samsung Galaxy S25 Ultra", postIds: [444861, 443463, 443147, 442174, 443717, 442866] },
  { raw: "iPhone 17", postIds: [442775, 442866, 442383, 442167, 444861] },
  { raw: "OnePlus 15", postIds: [444861, 444128, 442174, 442650] },
  { raw: "OnePlus Buds 4", postIds: [444510, 443269, 442260, 442650] },
  { raw: "Samsung Galaxy A17", postIds: [444811, 443521, 443047, 442866] },
  { raw: "Xiaomi Pad 7", postIds: [444842, 443322, 443048, 442866] },
  { raw: "Huawei Watch GT 6", postIds: [444987, 443304, 442347, 442347] },
  { raw: "Realme Watch 5", postIds: [444512, 442596, 442961] },
  { raw: "Xiaomi 15T", postIds: [443857, 443076, 442261] },
  { raw: "Google Pixel 9a", postIds: [443857, 443270, 442544] },
  { raw: "Huawei FreeBuds Pro 4", postIds: [444828, 443326, 442908] },
  { raw: "OnePlus 13S", postIds: [444440, 443657, 442650] },
  { raw: "Honor MagicPad 2", postIds: [444674, 443958, 442469] },
  { raw: "Realme GT 7 Pro", postIds: [442775, 442866, 443857] },
  { raw: "Xiaomi Poco F7", postIds: [444987, 443959, 442866] },
  { raw: "Tecno Camon 40 Pro 5G", postIds: [444608, 443289, 443957] },
  { raw: "Samsung Galaxy S25", postIds: [444440, 443463, 442740] },
  { raw: "AirPods Pro 3", postIds: [443729, 443326, 443013] },
  { raw: "Amazfit Balance 2", postIds: [444706, 444355, 442360] },
  { raw: "iQOO 15", postIds: [443147, 442389, 442580] },
  { raw: "Huawei Pura 80 Ultra", postIds: [444697, 443049, 443717] },
  { raw: "CMF Watch 3 Pro", postIds: [444355, 443046] },
  { raw: "Xiaomi 15 Ultra", postIds: [444861, 443076, 442595] },
  { raw: "Samsung Galaxy Buds3 Pro", postIds: [443326, 442739] },
  { raw: "Tuvio 4K Ultra HD OLED Frameless 48'", postIds: [443767, 442439] },
  { raw: "Honor X9d", postIds: [444168, 443491, 442259] },
  { raw: "Xiaomi Poco M7 4G", postIds: [444539, 444126, 442881] },
  { raw: "Realme P3 Ultra", postIds: [444511, 443257, 443743] },
  { raw: "Смартфон Apple iPhone 17 Pro Max 256GB, Orange, Dual eSIM(без RuStore)", postIds: [443717] },
  { raw: "Смартфон Samsung Galaxy S25 Ultra 12/256 ГБ, Dual: nano SIM + eSIM, Titanium Silver blue", postIds: [443717] },
  { raw: "Смартфон Google Pixel 10 Pro XL 16/256GB, Dual: nano SIM + eSIM, Obsidian", postIds: [443151] },
  { raw: "Смартфон iQOO 15 12/256 ГБ, Qualcomm Snapdragon 8 Elite Gen 5, Альфа-черный — купить в интернет-магазине Яндекс Маркет", postIds: [442389, 442580, 443603] },
  { raw: "Беспроводные наушники Apple Airpods Max 2024 USB-C Starlight (Сияющая звезда)", postIds: [443710] },
  { raw: "Фитнес-браслет Garmin Vivosmart 5 Чёрный, OLED (010-02645-00). S-M / L", postIds: [443390] },
  { raw: "Tecno Spark 40 Pro+", postIds: [444608, 443655] },
  { raw: "Infinix Note 50 Pro", postIds: [444675, 442961, 442288] },
  { raw: "Nintendo Switch OLED", postIds: [444409, 444409] },
  { raw: "Steam Deck OLED", postIds: [442807, 442807] },
  { raw: "Huawei Watch Fit 4 Pro", postIds: [444383, 444383, 443304] },
  { raw: "PlayStation 5 Slim Digital Edition", postIds: [443863, 443863] },
  { raw: "OnePlus Watch 3", postIds: [444355, 442290] },
  { raw: "Samsung Galaxy Watch7", postIds: [443490, 442290] },
  { raw: "Hisense 55E7Q Pro", postIds: [444986, 442882] },
  { raw: "MacBook Air 13 M4 (2025)", postIds: [444768] },
  { raw: "Realme GT8 Pro", postIds: [443743] },
  { raw: "Honor Magic7 Pro", postIds: [443639] },
  { raw: "Xiaomi Redmi Pad 2", postIds: [443790] },
  { raw: "iQOO Z10 Lite", postIds: [444539, 443521, 442866] },
];

export const createWidgetDebugRoutes = () =>
  new Elysia({ prefix: "/api/widget-debug" })
    .get("/models", async () => {
      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        
        // Get all device slugs for matching
        const devices = yield* sql<{ slug: string; name: string; brand: string | null }>`
          SELECT slug, name, brand FROM devices
        `;
        
        // Process widget data using token-based matching
        const models: WidgetModel[] = WIDGET_DATA.map(item => {
          const normalized = normalizeModel(item.raw);
          const brand = detectBrand(item.raw);
          
          // Use token-based matching with brand for slug prefix
          const match = findBestMatch(normalized, devices, brand);
          
          return {
            raw: item.raw,
            normalized,
            brand,
            count: item.postIds.length,
            postIds: item.postIds,
            matchedSlug: match?.slug ?? null,
            matchConfidence: match?.confidence ?? null,
          };
        });
        
        // Calculate stats
        const stats: WidgetStats = {
          totalModels: WIDGET_DATA.reduce((sum, item) => sum + item.postIds.length, 0),
          uniqueModels: WIDGET_DATA.length,
          postsWithWidgets: new Set(WIDGET_DATA.flatMap(item => item.postIds)).size,
          matchedCount: models.filter(m => m.matchedSlug !== null).length,
          unmatchedCount: models.filter(m => m.matchedSlug === null).length,
        };
        
        return { stats, models };
      });
      
      return await LiveRuntime.runPromise(program);
    })
    .get("/refresh", async () => {
      // In the future, this could trigger a fresh scrape from WordPress
      return { message: "Not implemented - use manual extraction for now" };
    });
