import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
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

export interface WidgetDataService {
  readonly getWidgetData: (
    slug: string,
  ) => Effect.Effect<WidgetDeviceData | null, WidgetDataError>;
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

const wrapSqlError = (error: SqlError.SqlError): WidgetDataError =>
  new WidgetDataError({ message: error.message, cause: error });

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
              redirectType: (offer.redirect_type as "to_merchant" | "to_price") ?? undefined,
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
            const rawSpecs = safeParseJson(deviceRow.specs_data) as RawSpecs | null;
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
            e instanceof WidgetDataError ? e : wrapSqlError(e),
          ),
        ),
    });
  }),
);
