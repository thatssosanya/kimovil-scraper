import { Effect, Layer, Context, Data } from "effect";
import { SqlClient } from "@effect/sql";
import { safeParseJson } from "./shared/json";

export class WidgetDataError extends Data.TaggedError("WidgetDataError")<{
  message: string;
  cause?: unknown;
}> {}

export interface WidgetPriceOffer {
  seller: string;
  price: number;
  url?: string;
  isAvailable: boolean;
  redirectType?: "to_merchant" | "to_price";
}

export interface WidgetSourcePrices {
  source: string;
  sourceName: string;
  minPrice: number;
  offerCount: number;
  topOffers: WidgetPriceOffer[];
}

export interface WidgetDeviceData {
  device: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
  };
  specs: {
    screenSize: number | null;
    cpu: string | null;
    battery: number | null;
    image: string | null;
  };
  prices: WidgetSourcePrices[];
}

const SHOP_CONFIG: Record<string, string> = {
  yandex_market: "Яндекс Маркет",
  price_ru: "Price.ru",
};

export type TelegramDealsSortOrder = "newest" | "cheapest" | "hottest";

export interface TelegramDealsParams {
  limit: number;
  sort: TelegramDealsSortOrder;
  minBonusMinorUnits?: number;
  channel?: string;
}

export interface TelegramDealItem {
  id: number;
  title: string;
  priceMinorUnits: number;
  bonusMinorUnits: number | null;
  currency: string;
  imageUrl: string | null;
  resolvedUrl: string;
  outboundUrl: string;
  yandexExternalId: string;
  postedAt: number;
  channelTitle: string | null;
  channelUsername: string | null;
}

export interface WidgetDataService {
  readonly getWidgetData: (
    slug: string,
  ) => Effect.Effect<WidgetDeviceData | null, WidgetDataError>;
  readonly getTelegramDealsData: (
    params: TelegramDealsParams,
  ) => Effect.Effect<TelegramDealItem[], WidgetDataError>;
}

export const WidgetDataService =
  Context.GenericTag<WidgetDataService>("WidgetDataService");

type DeviceWithSpecsRow = {
  device_id: string;
  device_slug: string;
  device_name: string;
  device_brand: string | null;
  specs_data: string | null;
  cdn_image_mini: string | null;
  cdn_image_hq: string | null;
  cdn_image_original: string | null;
};

type PriceGroupRow = {
  source: string;
  min_price: number;
  offer_count: number;
};

type PriceOfferRow = {
  source: string;
  seller: string | null;
  price_minor_units: number;
  url: string | null;
  affiliate_url: string | null;
  is_available: number;
  redirect_type: string | null;
  row_num: number;
};

interface RawSpecs {
  size_in?: number;
  cpu?: string;
  batteryCapacity_mah?: number;
  images?: string[];
}

const toWidgetDataError = (error: unknown): WidgetDataError =>
  new WidgetDataError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const NEAR_DUPLICATE_DICE_THRESHOLD = 0.94;

const TITLE_VARIANT_TOKENS = new Set([
  "plus",
  "ultra",
  "pro",
  "max",
  "mini",
  "lite",
  "fe",
]);

interface TitleFingerprint {
  normalized: string;
  tokenSet: Set<string>;
  tokenSetKey: string;
  unitTokens: Set<string>;
  trigrams: Set<string>;
}

const normalizeDealTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/wi[\s_-]*fi/giu, "wifi")
    .replace(/(\p{L}|\d)\+/gu, "$1 plus ")
    .replace(/(\d+)\s*(?:гб|gb)\b/giu, "$1gb")
    .replace(/(\d+)\s*(?:тб|tb)\b/giu, "$1tb")
    .replace(/(\d+)\s*(?:мп|mp)\b/giu, "$1mp")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const makeTrigrams = (value: string): Set<string> => {
  if (!value) return new Set();

  const padded = ` ${value} `;
  const trigrams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }

  if (trigrams.size === 0) {
    trigrams.add(padded);
  }

  return trigrams;
};

const makeTitleFingerprint = (title: string): TitleFingerprint => {
  const normalized = normalizeDealTitle(title);
  const tokenSet = new Set(normalized.split(" ").filter(Boolean));
  const sortedTokens = [...tokenSet].sort();
  const unitTokens = new Set(
    sortedTokens.filter((token) => /^\d+(?:gb|tb|mp)$/.test(token)),
  );

  return {
    normalized,
    tokenSet,
    tokenSetKey: sortedTokens.join("|"),
    unitTokens,
    trigrams: makeTrigrams(normalized),
  };
};

const diceCoefficient = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;

  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;

  for (const token of smaller) {
    if (larger.has(token)) {
      intersection++;
    }
  }

  return (2 * intersection) / (a.size + b.size);
};

const containsWholePhrase = (haystack: string, needle: string): boolean => {
  if (!haystack || !needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
};

const hasMeaningfulTokenConflict = (
  a: TitleFingerprint,
  b: TitleFingerprint,
): boolean => {
  if (a.unitTokens.size > 0 && b.unitTokens.size > 0) {
    if (a.unitTokens.size !== b.unitTokens.size) {
      return true;
    }
    for (const token of a.unitTokens) {
      if (!b.unitTokens.has(token)) {
        return true;
      }
    }
  }

  for (const token of TITLE_VARIANT_TOKENS) {
    if (a.tokenSet.has(token) !== b.tokenSet.has(token)) {
      return true;
    }
  }

  return false;
};

const areTitlesNearDuplicate = (
  a: TitleFingerprint,
  b: TitleFingerprint,
): boolean => {
  if (!a.normalized || !b.normalized) return false;
  if (a.normalized === b.normalized) return true;
  if (a.tokenSetKey === b.tokenSetKey) return true;
  if (hasMeaningfulTokenConflict(a, b)) return false;
  if (
    containsWholePhrase(a.normalized, b.normalized) ||
    containsWholePhrase(b.normalized, a.normalized)
  ) {
    return true;
  }

  return (
    diceCoefficient(a.trigrams, b.trigrams) >= NEAR_DUPLICATE_DICE_THRESHOLD
  );
};

function takeDistinctByTitle<T extends { title: string }>(
  pool: T[],
  limit: number,
  alreadySelected: T[] = [],
): T[] {
  if (limit <= 0) return [];

  const selectedFingerprints = alreadySelected.map((item) =>
    makeTitleFingerprint(item.title),
  );
  const distinct: T[] = [];

  for (const candidate of pool) {
    if (distinct.length >= limit) {
      break;
    }

    const candidateFingerprint = makeTitleFingerprint(candidate.title);
    const isDuplicate = selectedFingerprints.some((selected) =>
      areTitlesNearDuplicate(candidateFingerprint, selected),
    );

    if (isDuplicate) {
      continue;
    }

    distinct.push(candidate);
    selectedFingerprints.push(candidateFingerprint);
  }

  return distinct;
}

export const WidgetDataServiceLive = Layer.effect(
  WidgetDataService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return WidgetDataService.of({
      getWidgetData: (slug) =>
        Effect.gen(function* () {
          const deviceRows = yield* sql<DeviceWithSpecsRow>`
            SELECT 
              d.id as device_id,
              d.slug as device_slug,
              d.name as device_name,
              d.brand as device_brand,
              edr.data as specs_data,
              di_primary.url as cdn_image_mini,
              di_primary.url as cdn_image_hq,
              di_primary.url as cdn_image_original
            FROM devices d
            LEFT JOIN entity_data_raw edr 
              ON edr.device_id = d.id 
              AND edr.source = 'kimovil' 
              AND edr.data_kind = 'specs'
            LEFT JOIN device_images di_primary
              ON di_primary.device_id = d.id
              AND di_primary.is_primary = 1
            WHERE d.slug = ${slug}
          `;

          const deviceRow = deviceRows[0];
          if (!deviceRow) {
            return null;
          }

          const deviceId = deviceRow.device_id;

          const priceGroups = yield* sql<PriceGroupRow>`
            SELECT 
              source,
              MIN(price_minor_units) as min_price,
              COUNT(*) as offer_count
            FROM price_quotes
            WHERE device_id = ${deviceId} AND is_available = 1
            GROUP BY source
            ORDER BY min_price ASC
          `;

          const topOffers = yield* sql<PriceOfferRow>`
            WITH cheapest_per_seller AS (
              SELECT 
                source,
                seller,
                price_minor_units,
                url,
                affiliate_url,
                is_available,
                redirect_type,
                ROW_NUMBER() OVER (PARTITION BY source, seller ORDER BY price_minor_units ASC) as seller_rank
              FROM price_quotes
              WHERE device_id = ${deviceId} AND is_available = 1
            ),
            ranked AS (
              SELECT 
                source,
                seller,
                price_minor_units,
                url,
                affiliate_url,
                is_available,
                redirect_type,
                ROW_NUMBER() OVER (PARTITION BY source ORDER BY price_minor_units ASC) as row_num
              FROM cheapest_per_seller
              WHERE seller_rank = 1
            )
            SELECT source, seller, price_minor_units, url, affiliate_url, is_available, redirect_type, row_num
            FROM ranked
            WHERE row_num <= 3
            ORDER BY source, row_num
          `;

          const offersBySource = new Map<string, WidgetPriceOffer[]>();
          for (const offer of topOffers) {
            const sourceOffers = offersBySource.get(offer.source) ?? [];
            sourceOffers.push({
              seller: offer.seller ?? "Unknown",
              price: offer.price_minor_units,
              url: offer.affiliate_url ?? offer.url ?? undefined,
              isAvailable: offer.is_available === 1,
              redirectType:
                (offer.redirect_type as "to_merchant" | "to_price") ??
                undefined,
            });
            offersBySource.set(offer.source, sourceOffers);
          }

          const prices: WidgetSourcePrices[] = priceGroups.map((group) => ({
            source: group.source,
            sourceName: SHOP_CONFIG[group.source] ?? group.source,
            minPrice: group.min_price,
            offerCount: group.offer_count,
            topOffers: offersBySource.get(group.source) ?? [],
          }));

          // CDN image takes priority regardless of specs_data
          const cdnImage =
            deviceRow.cdn_image_mini ??
            deviceRow.cdn_image_hq ??
            deviceRow.cdn_image_original ??
            null;

          let specs: WidgetDeviceData["specs"] = {
            screenSize: null,
            cpu: null,
            battery: null,
            image: cdnImage,
          };

          if (deviceRow.specs_data) {
            const rawSpecs = safeParseJson(
              deviceRow.specs_data,
            ) as RawSpecs | null;
            if (rawSpecs) {
              specs = {
                screenSize: rawSpecs.size_in ?? null,
                cpu: rawSpecs.cpu ?? null,
                battery: rawSpecs.batteryCapacity_mah ?? null,
                image: cdnImage ?? rawSpecs.images?.[0] ?? null,
              };
            }
          }

          return {
            device: {
              id: deviceRow.device_id,
              slug: deviceRow.device_slug,
              name: deviceRow.device_name,
              brand: deviceRow.device_brand,
            },
            specs,
            prices,
          };
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("WidgetDataService.getWidgetData failed").pipe(
              Effect.annotateLogs({ slug, error: e }),
            ),
          ),
          Effect.mapError((e) =>
            e instanceof WidgetDataError ? e : toWidgetDataError(e),
          ),
        ),

      getTelegramDealsData: (params) =>
        Effect.gen(function* () {
          type DealRow = {
            id: number;
            title: string;
            price_minor_units: number | null;
            text_price_minor_units: number | null;
            bonus_minor_units: number | null;
            currency: string;
            image_url: string | null;
            cdn_image_url: string | null;
            resolved_url: string;
            affiliate_url: string | null;
            short_url: string | null;
            yandex_external_id: string;
            posted_at: number;
            channel_title: string | null;
            channel_username: string | null;
            widget_render_count: number;
            widget_click_count: number;
          };

          // Fetch all eligible items for rotation
          const rows = yield* sql<DealRow>`
            SELECT
              l.id,
              l.title,
              l.price_minor_units,
              l.text_price_minor_units,
              l.bonus_minor_units,
              l.currency,
              l.image_url,
              l.cdn_image_url,
              l.resolved_url,
              l.affiliate_url,
              l.short_url,
              l.yandex_external_id,
              fi.posted_at,
              c.title AS channel_title,
              c.username AS channel_username,
              l.widget_render_count,
              l.widget_click_count
            FROM telegram_feed_item_links l
            JOIN telegram_feed_items fi ON fi.id = l.feed_item_id
            JOIN telegram_channels c ON c.id = fi.channel_id
            WHERE l.processing_state = 'done'
              AND l.is_yandex_market = 1
              AND l.title IS NOT NULL
              AND (l.text_price_minor_units IS NOT NULL OR l.price_minor_units IS NOT NULL)
            ORDER BY fi.posted_at DESC
          `;

          // Dedup by yandex_external_id (keep newest)
          const seen = new Set<string>();
          let items: DealRow[] = [];
          for (const row of rows) {
            if (row.yandex_external_id && seen.has(row.yandex_external_id))
              continue;
            if (row.yandex_external_id) seen.add(row.yandex_external_id);
            items.push(row);
          }

          // Filter by min bonus
          if (params.minBonusMinorUnits && params.minBonusMinorUnits > 0) {
            items = items.filter(
              (r) =>
                r.bonus_minor_units != null &&
                r.bonus_minor_units >= params.minBonusMinorUnits!,
            );
          }

          // Filter by channel
          if (params.channel) {
            const ch = params.channel.replace(/^@/, "").toLowerCase();
            items = items.filter(
              (r) => r.channel_username?.toLowerCase() === ch,
            );
          }

          // ── Rotation selection ──
          // Configurable render target: once all items reach this, switch to exploitation
          const RENDER_TARGET = 50; // ~5000 impressions at ~100 views/cache-hit
          const EXPLORATION_SLOTS = 2; // slots reserved for under-shown items in exploitation

          const allExplored =
            items.length > 0 &&
            items.every((r) => r.widget_render_count >= RENDER_TARGET);

          let selected: DealRow[];

          if (allExplored && items.length > params.limit) {
            // Phase 2: Exploitation — pick by CTR, keep exploration slots
            const exploitSlots = Math.max(1, params.limit - EXPLORATION_SLOTS);
            const exploreSlots = params.limit - exploitSlots;

            // Sort by CTR desc (avoid division by zero)
            const byCtr = [...items].sort((a, b) => {
              const ctrA =
                a.widget_render_count > 0
                  ? a.widget_click_count / a.widget_render_count
                  : 0;
              const ctrB =
                b.widget_render_count > 0
                  ? b.widget_click_count / b.widget_render_count
                  : 0;
              return ctrB - ctrA;
            });

            const topPerformers = takeDistinctByTitle(byCtr, exploitSlots);
            const topIds = new Set(topPerformers.map((r) => r.id));

            // Exploration: pick random items not in top performers
            const remaining = items.filter((r) => !topIds.has(r.id));
            // Deterministic shuffle using epoch seed for cache consistency
            const epoch = Math.floor(Date.now() / 1_800_000);
            const shuffled = remaining
              .map((r) => ({ r, sort: (r.id * 2654435761 + epoch) >>> 0 }))
              .sort((a, b) => a.sort - b.sort)
              .map((x) => x.r);
            const explorePicks = takeDistinctByTitle(
              shuffled,
              exploreSlots,
              topPerformers,
            );

            selected = [...topPerformers, ...explorePicks];
          } else {
            // Phase 1: Exploration — prioritize least-shown items
            const byRenderCount = [...items].sort(
              (a, b) => a.widget_render_count - b.widget_render_count,
            );
            selected = takeDistinctByTitle(byRenderCount, params.limit);
          }

          // Apply user's sort within selected items
          if (params.sort === "cheapest") {
            selected.sort(
              (a, b) =>
                (a.text_price_minor_units ??
                  a.price_minor_units ??
                  Number.POSITIVE_INFINITY) -
                (b.text_price_minor_units ??
                  b.price_minor_units ??
                  Number.POSITIVE_INFINITY),
            );
          } else if (params.sort === "hottest") {
            selected.sort(
              (a, b) => (b.bonus_minor_units ?? 0) - (a.bonus_minor_units ?? 0),
            );
          } else {
            // newest
            selected.sort((a, b) => b.posted_at - a.posted_at);
          }

          return selected.map((r) => ({
            id: r.id,
            title: r.title,
            priceMinorUnits:
              r.text_price_minor_units ?? r.price_minor_units ?? 0,
            bonusMinorUnits: r.bonus_minor_units,
            currency: r.currency ?? "RUB",
            imageUrl: r.cdn_image_url ?? r.image_url,
            resolvedUrl: r.resolved_url,
            outboundUrl: r.short_url ?? r.affiliate_url ?? r.resolved_url,
            yandexExternalId: r.yandex_external_id,
            postedAt: r.posted_at,
            channelTitle: r.channel_title,
            channelUsername: r.channel_username,
          }));
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning(
              "WidgetDataService.getTelegramDealsData failed",
            ).pipe(Effect.annotateLogs({ error: e })),
          ),
          Effect.mapError((e) =>
            e instanceof WidgetDataError ? e : toWidgetDataError(e),
          ),
        ),
    });
  }),
);
