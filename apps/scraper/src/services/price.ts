import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

export class PriceServiceError extends Data.TaggedError("PriceServiceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface PriceQuoteInput {
  seller: string;
  sellerId?: string;
  priceMinorUnits: number;
  currency: string;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable: boolean;
  offerId?: string;
  redirectType?: "to_merchant" | "to_price";
}

export interface PriceHistoryPoint {
  date: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  count: number;
}

export interface CurrentPrices {
  minPrice: number;
  maxPrice: number;
  currency: string;
  updatedAt: number;
  quotes: Array<{
    seller: string;
    price: number;
    variantKey?: string;
    variantLabel?: string;
    url?: string;
    isAvailable?: boolean;
    externalId?: string;
    scrapedAt: number;
  }>;
}

export interface PriceService {
  readonly savePriceQuotes: (params: {
    deviceId: string;
    source: string;
    offers: PriceQuoteInput[];
    scrapeId?: number;
    externalId?: string;
  }) => Effect.Effect<number, PriceServiceError>;

  readonly updatePriceSummary: (
    deviceId: string,
  ) => Effect.Effect<void, PriceServiceError>;

  readonly getPriceHistory: (params: {
    deviceId: string;
    days?: number;
    variantKey?: string;
    externalId?: string;
  }) => Effect.Effect<PriceHistoryPoint[], PriceServiceError>;

  readonly getCurrentPrices: (
    deviceId: string,
  ) => Effect.Effect<CurrentPrices | null, PriceServiceError>;

  readonly getAllQuotes: (params: {
    deviceId: string;
    source?: string;
    externalId?: string;
    limit?: number;
  }) => Effect.Effect<Array<{
    seller: string;
    price: number;
    variantKey?: string;
    variantLabel?: string;
    url?: string;
    isAvailable: boolean;
    externalId?: string;
    source: string;
    scrapedAt: number;
  }>, PriceServiceError>;
}

export const PriceService = Context.GenericTag<PriceService>("PriceService");

type PriceQuoteRow = {
  id: number;
  device_id: string;
  source: string;
  seller: string | null;
  seller_id: string | null;
  price_minor_units: number;
  currency: string;
  variant_key: string | null;
  variant_label: string | null;
  url: string | null;
  offer_id: string | null;
  external_id: string | null;
  scraped_at: number;
  scrape_id: number | null;
  is_available: number;
};

type PriceSummaryRow = {
  device_id: string;
  min_price_minor_units: number | null;
  max_price_minor_units: number | null;
  currency: string | null;
  updated_at: number | null;
};

type PriceHistoryRow = {
  date: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  count: number;
};

const wrapSqlError = (error: SqlError.SqlError): PriceServiceError =>
  new PriceServiceError({ message: error.message, cause: error });

export const PriceServiceLive = Layer.effect(
  PriceService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return PriceService.of({
      savePriceQuotes: (params) =>
        sql.withTransaction(
          Effect.gen(function* () {
            const { deviceId, source, offers, scrapeId, externalId } = params;
            let count = 0;

            for (const offer of offers) {
              yield* sql`
                INSERT INTO price_quotes (
                  device_id, source, seller, seller_id, price_minor_units, currency,
                  variant_key, variant_label, url, offer_id, external_id, scraped_at, scrape_id, is_available, redirect_type
                ) VALUES (
                  ${deviceId}, ${source}, ${offer.seller}, ${offer.sellerId ?? null},
                  ${offer.priceMinorUnits}, ${offer.currency},
                  ${offer.variantKey ?? null}, ${offer.variantLabel ?? null},
                  ${offer.url ?? null}, ${offer.offerId ?? null}, ${externalId ?? null},
                  unixepoch(), ${scrapeId ?? null}, ${offer.isAvailable ? 1 : 0}, ${offer.redirectType ?? null}
                )
              `;
              count++;
            }

            return count;
          }),
        ).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.savePriceQuotes failed").pipe(
              Effect.annotateLogs({ deviceId: params.deviceId, source: params.source, error: e }),
            ),
          ),
          Effect.mapError((e) =>
            e instanceof PriceServiceError ? e : wrapSqlError(e),
          ),
        ),

      updatePriceSummary: (deviceId) =>
        Effect.gen(function* () {
          // Try available offers first, fall back to all offers
          const availableRows = yield* sql<{
            min_price: number | null;
            max_price: number | null;
            currency: string | null;
          }>`
            SELECT 
              MIN(price_minor_units) as min_price,
              MAX(price_minor_units) as max_price,
              currency
            FROM price_quotes
            WHERE device_id = ${deviceId} AND is_available = 1
            GROUP BY currency
            ORDER BY COUNT(*) DESC
            LIMIT 1
          `;

          let row = availableRows[0];
          
          // Fall back to all offers if no available ones
          if (!row || row.min_price === null) {
            const allRows = yield* sql<{
              min_price: number | null;
              max_price: number | null;
              currency: string | null;
            }>`
              SELECT 
                MIN(price_minor_units) as min_price,
                MAX(price_minor_units) as max_price,
                currency
              FROM price_quotes
              WHERE device_id = ${deviceId}
              GROUP BY currency
              ORDER BY COUNT(*) DESC
              LIMIT 1
            `;
            row = allRows[0];
          }

          if (!row || row.min_price === null) {
            return;
          }

          yield* sql`
            INSERT OR REPLACE INTO price_summary (device_id, min_price_minor_units, max_price_minor_units, currency, updated_at)
            VALUES (${deviceId}, ${row.min_price}, ${row.max_price}, ${row.currency}, unixepoch())
          `;
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.updatePriceSummary failed").pipe(
              Effect.annotateLogs({ deviceId, error: e }),
            ),
          ),
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),

      getPriceHistory: (params) => {
        const { deviceId, days = 30, variantKey, externalId } = params;

        const getQuery = () => {
          if (variantKey && externalId) {
            return sql<PriceHistoryRow>`
              SELECT 
                date(scraped_at, 'unixepoch') as date,
                MIN(price_minor_units) as min_price,
                AVG(price_minor_units) as avg_price,
                MAX(price_minor_units) as max_price,
                COUNT(*) as count
              FROM price_quotes
              WHERE device_id = ${deviceId}
                AND is_available = 1
                AND scraped_at >= unixepoch() - ${days * 86400}
                AND variant_key = ${variantKey}
                AND external_id = ${externalId}
              GROUP BY date(scraped_at, 'unixepoch')
              ORDER BY date DESC
            `;
          } else if (variantKey) {
            return sql<PriceHistoryRow>`
              SELECT 
                date(scraped_at, 'unixepoch') as date,
                MIN(price_minor_units) as min_price,
                AVG(price_minor_units) as avg_price,
                MAX(price_minor_units) as max_price,
                COUNT(*) as count
              FROM price_quotes
              WHERE device_id = ${deviceId}
                AND is_available = 1
                AND scraped_at >= unixepoch() - ${days * 86400}
                AND variant_key = ${variantKey}
              GROUP BY date(scraped_at, 'unixepoch')
              ORDER BY date DESC
            `;
          } else if (externalId) {
            return sql<PriceHistoryRow>`
              SELECT 
                date(scraped_at, 'unixepoch') as date,
                MIN(price_minor_units) as min_price,
                AVG(price_minor_units) as avg_price,
                MAX(price_minor_units) as max_price,
                COUNT(*) as count
              FROM price_quotes
              WHERE device_id = ${deviceId}
                AND is_available = 1
                AND scraped_at >= unixepoch() - ${days * 86400}
                AND external_id = ${externalId}
              GROUP BY date(scraped_at, 'unixepoch')
              ORDER BY date DESC
            `;
          } else {
            return sql<PriceHistoryRow>`
              SELECT 
                date(scraped_at, 'unixepoch') as date,
                MIN(price_minor_units) as min_price,
                AVG(price_minor_units) as avg_price,
                MAX(price_minor_units) as max_price,
                COUNT(*) as count
              FROM price_quotes
              WHERE device_id = ${deviceId}
                AND is_available = 1
                AND scraped_at >= unixepoch() - ${days * 86400}
              GROUP BY date(scraped_at, 'unixepoch')
              ORDER BY date DESC
            `;
          }
        };

        return getQuery().pipe(
          Effect.map((rows) =>
            rows.map((r) => ({
              date: r.date,
              minPrice: r.min_price,
              avgPrice: r.avg_price,
              maxPrice: r.max_price,
              count: r.count,
            })),
          ),
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.getPriceHistory failed").pipe(
              Effect.annotateLogs({ deviceId: params.deviceId, days: params.days, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        );
      },

      getCurrentPrices: (deviceId) =>
        Effect.gen(function* () {
          const summaryRows = yield* sql<PriceSummaryRow>`
            SELECT * FROM price_summary WHERE device_id = ${deviceId}
          `;

          const summary = summaryRows[0];
          if (
            !summary ||
            summary.min_price_minor_units === null ||
            summary.currency === null
          ) {
            return null;
          }

          const latestRows = yield* sql<{
            max_scraped: number;
          }>`
            SELECT MAX(scraped_at) as max_scraped
            FROM price_quotes
            WHERE device_id = ${deviceId}
          `;

          const latestScrapedAt = latestRows[0]?.max_scraped;
          if (!latestScrapedAt) {
            return null;
          }

          // Try available quotes first
          let quoteRows = yield* sql<PriceQuoteRow>`
            SELECT * FROM price_quotes
            WHERE device_id = ${deviceId}
              AND scraped_at = ${latestScrapedAt}
              AND is_available = 1
            ORDER BY price_minor_units ASC
          `;

          // Fall back to all quotes if none available
          if (quoteRows.length === 0) {
            quoteRows = yield* sql<PriceQuoteRow>`
              SELECT * FROM price_quotes
              WHERE device_id = ${deviceId}
                AND scraped_at = ${latestScrapedAt}
              ORDER BY price_minor_units ASC
            `;
          }

          return {
            minPrice: summary.min_price_minor_units,
            maxPrice: summary.max_price_minor_units ?? summary.min_price_minor_units,
            currency: summary.currency,
            updatedAt: summary.updated_at ?? latestScrapedAt,
            quotes: quoteRows.map((q) => ({
              seller: q.seller ?? "Unknown",
              price: q.price_minor_units,
              variantKey: q.variant_key ?? undefined,
              variantLabel: q.variant_label ?? undefined,
              url: q.url ?? undefined,
              isAvailable: q.is_available === 1,
              externalId: q.external_id ?? undefined,
              scrapedAt: q.scraped_at,
            })),
          };
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.getCurrentPrices failed").pipe(
              Effect.annotateLogs({ deviceId, error: e }),
            ),
          ),
          Effect.mapError((e) =>
            e instanceof PriceServiceError ? e : wrapSqlError(e),
          ),
        ),

      getAllQuotes: (params) =>
        Effect.gen(function* () {
          const { deviceId, source, externalId, limit = 500 } = params;

          let quoteRows: readonly PriceQuoteRow[];

          if (source && externalId) {
            quoteRows = yield* sql<PriceQuoteRow>`
              SELECT * FROM price_quotes
              WHERE device_id = ${deviceId}
                AND source = ${source}
                AND external_id = ${externalId}
              ORDER BY scraped_at DESC
              LIMIT ${limit}
            `;
          } else if (source) {
            quoteRows = yield* sql<PriceQuoteRow>`
              SELECT * FROM price_quotes
              WHERE device_id = ${deviceId}
                AND source = ${source}
              ORDER BY scraped_at DESC
              LIMIT ${limit}
            `;
          } else if (externalId) {
            quoteRows = yield* sql<PriceQuoteRow>`
              SELECT * FROM price_quotes
              WHERE device_id = ${deviceId}
                AND external_id = ${externalId}
              ORDER BY scraped_at DESC
              LIMIT ${limit}
            `;
          } else {
            quoteRows = yield* sql<PriceQuoteRow>`
              SELECT * FROM price_quotes
              WHERE device_id = ${deviceId}
              ORDER BY scraped_at DESC
              LIMIT ${limit}
            `;
          }

          return quoteRows.map((q) => ({
            seller: q.seller ?? "Unknown",
            price: q.price_minor_units,
            variantKey: q.variant_key ?? undefined,
            variantLabel: q.variant_label ?? undefined,
            url: q.url ?? undefined,
            isAvailable: q.is_available === 1,
            externalId: q.external_id ?? undefined,
            source: q.source,
            scrapedAt: q.scraped_at,
          }));
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.getAllQuotes failed").pipe(
              Effect.annotateLogs({ ...params, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
