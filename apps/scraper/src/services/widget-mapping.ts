import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { generateDeviceId } from "@repo/scraper-domain/server";

// =============================================================================
// Brand Detection Patterns (extracted from widget-debug.ts)
// =============================================================================

export const BRAND_PATTERNS: Array<{ pattern: RegExp; brand: string }> = [
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

export function detectBrand(text: string): string | null {
  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(text)) {
      return brand;
    }
  }
  return null;
}

// =============================================================================
// Model Normalization Functions (extracted from widget-debug.ts)
// =============================================================================

export const MODEL_SUFFIXES = ["pro", "max", "ultra", "plus", "lite", "se", "mini", "slim", "xl", "fe"];

export function normalizeModel(raw: string): string {
  let text = raw.toLowerCase();

  text = text.replace(/^(смартфон|телефон|планшет|ноутбук|монитор|телевизор|наушники|часы|смарт-часы|фитнес-браслет)\s+/gi, "");
  text = text.replace(/\s*[—–-]\s*купить.*$/i, "");
  text = text.replace(/\s+на яндекс маркете?$/i, "");
  text = text.replace(/\s+в интернет-магазине.*$/i, "");
  text = text.replace(/\b\d+\s*(gb|гб|tb|тб)\b/gi, "");
  text = text.replace(/\b\d+\/\d+\s*(gb|гб)\b/gi, "");
  text = text.replace(/\b(qualcomm\s+)?snapdragon\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\b(mediatek\s+)?(dimensity|helio)\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\bapple\s+[am]\d+\s*(pro|max|ultra)?\b/gi, "");
  text = text.replace(/\bexynos\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\bkirin\s+\d+[^\s,]*/gi, "");
  text = text.replace(/\btensor\s*(g\d+)?\b/gi, "");
  text = text.replace(/\b4g\b/gi, "");

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

  text = text.replace(/\b(global|глобальная|eu|ru|cn|china|europe|россия|ростест|eac)\b/gi, "");
  text = text.replace(/\b(версия|version)\b/gi, "");
  text = text.replace(/\b(dual|nano|esim|sim)\b/gi, "");
  text = text.replace(/\b(новый|new|оригинал|original)\b/gi, "");
  text = text.replace(/\b(без rustore|не установлен rustore)\b/gi, "");
  text = text.replace(/,\s*,/g, ",");
  text = text.replace(/^[,\s]+|[,\s]+$/g, "");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  text = text.replace(/\s*,\s*$/, "").trim();

  return text;
}

export function toSlugForm(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toSlugVariants(text: string): string[] {
  const base = toSlugForm(text);
  const variants = new Set<string>([base]);

  const collapsed = base.replace(/-(\d)/g, "$1");
  if (collapsed !== base) variants.add(collapsed);

  const expanded = base.replace(/([a-z])(\d)/g, "$1-$2");
  if (expanded !== base) variants.add(expanded);

  if (base.includes("5g")) {
    const without5g = base.replace(/-?5g-?/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    variants.add(without5g);
    variants.add(without5g.replace(/-(\d)/g, "$1"));
    variants.add(without5g.replace(/([a-z])(\d)/g, "$1-$2"));
  }

  return [...variants];
}

export function extractSuffixes(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const suffix of MODEL_SUFFIXES) {
    if (new RegExp(`\\b${suffix}\\b`).test(lower)) {
      found.add(suffix);
    }
  }
  return found;
}

export interface MatchResult {
  slug: string;
  confidence: number;
}

export function findBestMatch(
  normalized: string,
  devices: ReadonlyArray<{ slug: string; name: string }>,
  brand: string | null
): MatchResult | null {
  const slugVariants = toSlugVariants(normalized);
  const modelSuffixes = extractSuffixes(normalized);

  const brandVariants = brand ? toSlugVariants(`${brand} ${normalized}`) : [];
  const allVariants = [...slugVariants, ...brandVariants];

  let bestMatch: MatchResult | null = null;

  for (const device of devices) {
    const deviceSlug = device.slug;
    const deviceSuffixes = extractSuffixes(device.name);

    if (allVariants.includes(deviceSlug)) {
      return { slug: deviceSlug, confidence: 1.0 };
    }

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

    const modelHasSuffix = modelSuffixes.size > 0;
    const deviceHasSuffix = deviceSuffixes.size > 0;
    const allSuffixesMatch = [...modelSuffixes].every(s => deviceSuffixes.has(s));
    const deviceHasExtraSuffixes = [...deviceSuffixes].some(s => !modelSuffixes.has(s));

    let confidence = 0;

    if (modelHasSuffix && allSuffixesMatch && !deviceHasExtraSuffixes) {
      confidence = 0.95;
    } else if (!modelHasSuffix && !deviceHasSuffix) {
      confidence = 0.9;
    } else if (!modelHasSuffix && deviceHasSuffix) {
      confidence = 0.3;
    } else if (modelHasSuffix && !allSuffixesMatch) {
      confidence = 0.4;
    } else if (modelHasSuffix && deviceHasExtraSuffixes) {
      confidence = 0.5;
    }

    if (bestMatch === null || confidence > bestMatch.confidence) {
      bestMatch = { slug: deviceSlug, confidence };
    }
  }

  return bestMatch;
}

// =============================================================================
// Service Types
// =============================================================================

export class WidgetMappingError extends Data.TaggedError("WidgetMappingError")<{
  message: string;
  cause?: unknown;
}> {}

export type MappingStatus = "pending" | "suggested" | "auto_confirmed" | "confirmed" | "ignored";

export interface WidgetMapping {
  id: number;
  source: string;
  rawModel: string;
  normalizedModel: string | null;
  deviceId: string | null;
  confidence: number | null;
  status: MappingStatus;
  usageCount: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SuggestedMatch {
  deviceId: string;
  slug: string;
  name: string;
  confidence: number;
}

export interface PostInfo {
  postId: number;
  title: string;
  url: string;
  dateGmt: string;
}

export interface DevicePreview {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

export interface NewDeviceDefaults {
  brand: string | null;
  modelName: string;
  suggestedSlug: string;
}

export interface MappingContext {
  mapping: WidgetMapping | null;
  suggestions: SuggestedMatch[];
  posts: PostInfo[];
  devicePreview: DevicePreview | null;
  newDeviceDefaults: NewDeviceDefaults;
}

export interface WidgetMappingService {
  syncMappings: () => Effect.Effect<{ created: number; updated: number }, WidgetMappingError>;

  getMapping: (rawModel: string) => Effect.Effect<MappingContext, WidgetMappingError>;

  updateMapping: (
    rawModel: string,
    update: { deviceId?: string | null; status?: MappingStatus }
  ) => Effect.Effect<WidgetMapping, WidgetMappingError>;

  listMappings: (options: {
    status?: MappingStatus | "needs_review";
    limit?: number;
    offset?: number;
    seenAfter?: number;  // Unix timestamp - filter by last_seen_at >= this
    seenBefore?: number; // Unix timestamp - filter by last_seen_at <= this
  }) => Effect.Effect<{ mappings: WidgetMapping[]; total: number }, WidgetMappingError>;

  searchDevices: (query: string, limit?: number) => Effect.Effect<
    Array<{ id: string; slug: string; name: string; brand: string | null }>,
    WidgetMappingError
  >;

  createDevice: (input: {
    slug: string;
    name: string;
    brand: string | null;
  }) => Effect.Effect<{ id: string; slug: string; name: string; brand: string | null }, WidgetMappingError>;
}

export const WidgetMappingService = Context.GenericTag<WidgetMappingService>("WidgetMappingService");

// =============================================================================
// Row Types
// =============================================================================

interface WidgetCacheAggRow {
  raw: string;
  count: number;
  first_seen: number;
  last_seen: number;
}

interface MappingRow {
  id: number;
  source: string;
  raw_model: string;
  normalized_model: string | null;
  device_id: string | null;
  confidence: number | null;
  status: string;
  usage_count: number;
  first_seen_at: number | null;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

interface DeviceRow {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

interface PostRow {
  post_id: number;
  title: string;
  slug: string;
  post_date_gmt: string;
}

// =============================================================================
// Service Implementation
// =============================================================================

const mapError = (e: unknown) =>
  new WidgetMappingError({
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });

function rowToMapping(row: MappingRow): WidgetMapping {
  return {
    id: row.id,
    source: row.source,
    rawModel: row.raw_model,
    normalizedModel: row.normalized_model,
    deviceId: row.device_id,
    confidence: row.confidence,
    status: row.status as MappingStatus,
    usageCount: row.usage_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const WidgetMappingServiceLive = Layer.effect(
  WidgetMappingService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const syncMappings: WidgetMappingService["syncMappings"] = () =>
      sql.withTransaction(
        Effect.gen(function* () {
          const widgetRows = yield* sql<WidgetCacheAggRow>`
            SELECT
              w.search_text as raw,
              COUNT(*) as count,
              CAST(strftime('%s', MIN(w.post_date_gmt)) AS INTEGER) as first_seen,
              CAST(strftime('%s', MAX(w.post_date_gmt)) AS INTEGER) as last_seen
            FROM wordpress_widget_cache w
            JOIN wp_posts_cache p ON w.post_id = p.post_id
            WHERE p.status = 'publish'
            GROUP BY w.search_text
          `;

          yield* Effect.logInfo("syncMappings: loaded widget rows").pipe(
            Effect.annotateLogs({ count: widgetRows.length }),
          );

          const devices = yield* sql<DeviceRow>`
            SELECT id, slug, name, brand FROM devices
          `;

          yield* Effect.logInfo("syncMappings: loaded devices").pipe(
            Effect.annotateLogs({ count: devices.length }),
          );

          let created = 0;
          let updated = 0;

          for (const row of widgetRows) {
          const normalized = normalizeModel(row.raw);
          const brand = detectBrand(row.raw);
          const match = findBestMatch(normalized, devices, brand);

          let status: MappingStatus = "pending";
          if (match) {
            if (match.confidence >= 0.97) {
              status = "auto_confirmed";
            } else if (match.confidence >= 0.90) {
              status = "suggested";
            }
          }

          const deviceId = match?.slug
            ? devices.find(d => d.slug === match.slug)?.id ?? null
            : null;

          // Use INSERT ... ON CONFLICT with RETURNING to get insert/update status
          // RETURNING gives us the row after the operation - we can tell insert vs update
          // by comparing created_at and updated_at (equal = insert, different = update)
          const returned = yield* sql<{ created_at: number; updated_at: number }>`
            INSERT INTO widget_model_mappings (
              source, raw_model, normalized_model, device_id, confidence, status,
              usage_count, first_seen_at, last_seen_at, created_at, updated_at
            )
            VALUES (
              'wordpress',
              ${row.raw},
              ${normalized},
              ${deviceId},
              ${match?.confidence ?? null},
              ${status},
              ${row.count},
              ${row.first_seen},
              ${row.last_seen},
              unixepoch(),
              unixepoch()
            )
            ON CONFLICT(source, raw_model) DO UPDATE SET
              usage_count = excluded.usage_count,
              first_seen_at = COALESCE(widget_model_mappings.first_seen_at, excluded.first_seen_at),
              last_seen_at = excluded.last_seen_at,
              updated_at = unixepoch(),
              device_id = CASE
                WHEN widget_model_mappings.status IN ('auto_confirmed', 'confirmed', 'ignored') OR widget_model_mappings.locked = 1 THEN widget_model_mappings.device_id
                ELSE excluded.device_id
              END,
              confidence = CASE
                WHEN widget_model_mappings.status IN ('auto_confirmed', 'confirmed', 'ignored') OR widget_model_mappings.locked = 1 THEN widget_model_mappings.confidence
                ELSE excluded.confidence
              END,
              status = CASE
                WHEN widget_model_mappings.status IN ('auto_confirmed', 'confirmed', 'ignored') OR widget_model_mappings.locked = 1 THEN widget_model_mappings.status
                ELSE excluded.status
              END,
              normalized_model = CASE
                WHEN widget_model_mappings.status IN ('auto_confirmed', 'confirmed', 'ignored') OR widget_model_mappings.locked = 1 THEN widget_model_mappings.normalized_model
                ELSE excluded.normalized_model
              END
            RETURNING created_at, updated_at
          `;

          if (returned.length > 0) {
            const r = returned[0];
            if (r.created_at === r.updated_at) {
              created++;
            } else {
              updated++;
            }
          }
        }

          return { created, updated };
        }),
      ).pipe(Effect.mapError(mapError));

    const getMapping: WidgetMappingService["getMapping"] = (rawModel) =>
      Effect.gen(function* () {
        const rows = yield* sql<MappingRow>`
          SELECT * FROM widget_model_mappings
          WHERE source = 'wordpress' AND raw_model = ${rawModel}
        `;

        const mapping = rows.length > 0 ? rowToMapping(rows[0]) : null;

        const devices = yield* sql<DeviceRow>`
          SELECT id, slug, name, brand FROM devices
        `;

        const normalized = normalizeModel(rawModel);
        const brand = detectBrand(rawModel);

        const suggestions: SuggestedMatch[] = [];

        for (const device of devices) {
          const match = findBestMatch(normalized, [device], brand);
          if (match && match.confidence > 0.2) {
            suggestions.push({
              deviceId: device.id,
              slug: device.slug,
              name: device.name,
              confidence: match.confidence,
            });
          }
        }

        suggestions.sort((a, b) => b.confidence - a.confidence);
        const topSuggestions = suggestions.slice(0, 10);

        // Fetch posts where this widget appears
        const postRows = yield* sql<PostRow>`
          SELECT DISTINCT
            w.post_id,
            p.title,
            p.slug,
            w.post_date_gmt
          FROM wordpress_widget_cache w
          JOIN wp_posts_cache p ON w.post_id = p.post_id
          WHERE w.search_text = ${rawModel}
            AND p.status = 'publish'
          ORDER BY w.post_date_gmt DESC
          LIMIT 20
        `;

        const posts: PostInfo[] = postRows.map((row) => ({
          postId: row.post_id,
          title: row.title,
          url: `https://click-or-die.ru/${row.slug}/`,
          dateGmt: row.post_date_gmt,
        }));

        // Get device preview for the mapped device or top suggestion
        let devicePreview: DevicePreview | null = null;
        const previewDeviceId = mapping?.deviceId ?? topSuggestions[0]?.deviceId ?? null;
        if (previewDeviceId) {
          const device = devices.find((d) => d.id === previewDeviceId);
          if (device) {
            devicePreview = {
              id: device.id,
              slug: device.slug,
              name: device.name,
              brand: device.brand,
            };
          }
        }

        // Generate defaults for creating a new device
        const suggestedSlug = toSlugForm(normalized);
        const newDeviceDefaults: NewDeviceDefaults = {
          brand,
          modelName: normalized || rawModel,
          suggestedSlug,
        };

        return {
          mapping,
          suggestions: topSuggestions,
          posts,
          devicePreview,
          newDeviceDefaults,
        };
      }).pipe(Effect.mapError(mapError));

    const updateMapping: WidgetMappingService["updateMapping"] = (rawModel, update) =>
      Effect.gen(function* () {
        const sets: string[] = [];
        const values: unknown[] = [];

        if (update.deviceId !== undefined) {
          sets.push("device_id = ?");
          values.push(update.deviceId);
        }
        if (update.status !== undefined) {
          sets.push("status = ?");
          values.push(update.status);
        }

        if (sets.length === 0) {
          const existing = yield* sql<MappingRow>`
            SELECT * FROM widget_model_mappings
            WHERE source = 'wordpress' AND raw_model = ${rawModel}
          `;
          if (existing.length === 0) {
            return yield* Effect.fail(new WidgetMappingError({ message: `Mapping not found: ${rawModel}` }));
          }
          return rowToMapping(existing[0]);
        }

        if (update.deviceId !== undefined && update.status !== undefined) {
          yield* sql`
            UPDATE widget_model_mappings
            SET device_id = ${update.deviceId}, status = ${update.status}, updated_at = unixepoch()
            WHERE source = 'wordpress' AND raw_model = ${rawModel}
          `;
        } else if (update.deviceId !== undefined) {
          yield* sql`
            UPDATE widget_model_mappings
            SET device_id = ${update.deviceId}, updated_at = unixepoch()
            WHERE source = 'wordpress' AND raw_model = ${rawModel}
          `;
        } else if (update.status !== undefined) {
          yield* sql`
            UPDATE widget_model_mappings
            SET status = ${update.status}, updated_at = unixepoch()
            WHERE source = 'wordpress' AND raw_model = ${rawModel}
          `;
        }

        const updated = yield* sql<MappingRow>`
          SELECT * FROM widget_model_mappings
          WHERE source = 'wordpress' AND raw_model = ${rawModel}
        `;

        if (updated.length === 0) {
          return yield* Effect.fail(new WidgetMappingError({ message: `Mapping not found: ${rawModel}` }));
        }

        return rowToMapping(updated[0]);
      }).pipe(Effect.mapError(mapError));

    const listMappings: WidgetMappingService["listMappings"] = (options) =>
      Effect.gen(function* () {
        const limit = options.limit ?? 50;
        const offset = options.offset ?? 0;
        const seenAfter = options.seenAfter ?? null;
        const seenBefore = options.seenBefore ?? null;

        let mappings: WidgetMapping[];
        let total: number;

        // Build date filter conditions
        // Uses last_seen_at to filter widgets active in the selected period
        if (options.status === "needs_review") {
          if (seenAfter !== null && seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else if (seenAfter !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at >= ${seenAfter}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at >= ${seenAfter}
            `;
            total = countRows[0].count;
          } else if (seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
                AND last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status IN ('pending', 'suggested')
            `;
            total = countRows[0].count;
          }
        } else if (options.status) {
          const status = options.status;
          if (seenAfter !== null && seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else if (seenAfter !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at >= ${seenAfter}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at >= ${seenAfter}
            `;
            total = countRows[0].count;
          } else if (seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status = ${status}
                AND last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE status = ${status}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE status = ${status}
            `;
            total = countRows[0].count;
          }
        } else {
          if (seenAfter !== null && seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE last_seen_at >= ${seenAfter} AND last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else if (seenAfter !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE last_seen_at >= ${seenAfter}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE last_seen_at >= ${seenAfter}
            `;
            total = countRows[0].count;
          } else if (seenBefore !== null) {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              WHERE last_seen_at <= ${seenBefore}
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
              WHERE last_seen_at <= ${seenBefore}
            `;
            total = countRows[0].count;
          } else {
            const rows = yield* sql<MappingRow>`
              SELECT * FROM widget_model_mappings
              ORDER BY usage_count DESC, confidence IS NULL, confidence ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
            mappings = rows.map(rowToMapping);
            const countRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM widget_model_mappings
            `;
            total = countRows[0].count;
          }
        }

        return { mappings, total };
      }).pipe(Effect.mapError(mapError));

    const searchDevices: WidgetMappingService["searchDevices"] = (query, limit = 20) =>
      Effect.gen(function* () {
        const pattern = `%${query}%`;
        const rows = yield* sql<DeviceRow>`
          SELECT id, slug, name, brand FROM devices
          WHERE name LIKE ${pattern} OR slug LIKE ${pattern}
          LIMIT ${limit}
        `;
        return [...rows];
      }).pipe(Effect.mapError(mapError));

    const createDevice: WidgetMappingService["createDevice"] = (input) =>
      Effect.gen(function* () {
        const id = generateDeviceId(input.slug);

        // Check if device with same slug already exists
        const existing = yield* sql<DeviceRow>`
          SELECT id, slug, name, brand FROM devices WHERE slug = ${input.slug}
        `;
        if (existing.length > 0) {
          return yield* Effect.fail(
            new WidgetMappingError({ message: `Device with slug "${input.slug}" already exists` })
          );
        }

        yield* sql`
          INSERT INTO devices (id, slug, name, brand, created_at, updated_at)
          VALUES (${id}, ${input.slug}, ${input.name}, ${input.brand}, unixepoch(), unixepoch())
        `;

        return { id, slug: input.slug, name: input.name, brand: input.brand };
      }).pipe(Effect.mapError(mapError));

    return {
      syncMappings,
      getMapping,
      updateMapping,
      listMappings,
      searchDevices,
      createDevice,
    } satisfies WidgetMappingService;
  }),
);
