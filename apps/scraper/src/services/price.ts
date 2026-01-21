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

  readonly excludeQuotes: (params: {
    deviceId: string;
    source: string;
    externalId: string;
    reason?: string;
  }) => Effect.Effect<void, PriceServiceError>;

  readonly isExcluded: (params: {
    deviceId: string;
    source: string;
    externalId: string;
  }) => Effect.Effect<boolean, PriceServiceError>;

  readonly getExclusions: (
    deviceId: string,
  ) => Effect.Effect<Array<{
    source: string;
    externalId: string;
    reason: string | null;
    createdAt: number;
  }>, PriceServiceError>;

  readonly removeExclusion: (params: {
    deviceId: string;
    source: string;
    externalId: string;
  }) => Effect.Effect<void, PriceServiceError>;

  readonly getOfferCountsByDeviceIds: (
    deviceIds: string[],
  ) => Effect.Effect<Record<string, number>, PriceServiceError>;

  // price.ru URL refresh methods
  readonly hasPriceRuPrices: (
    deviceId: string,
  ) => Effect.Effect<boolean, PriceServiceError>;

  readonly claimUrlRefresh: (params: {
    deviceId: string;
    staleThresholdSecs: number;
    minIntervalSecs: number;
  }) => Effect.Effect<boolean, PriceServiceError>;

  readonly updatePriceRuUrls: (params: {
    deviceId: string;
    offers: Array<{
      offerId: string;
      clickUrl: string | null;
      isAvailable: boolean;
    }>;
  }) => Effect.Effect<{ updated: number; added: number; unavailable: number }, PriceServiceError>;

  readonly setUrlRefreshedAt: (
    deviceId: string,
  ) => Effect.Effect<void, PriceServiceError>;

  readonly releaseUrlRefreshClaim: (
    deviceId: string,
  ) => Effect.Effect<void, PriceServiceError>;

  readonly getSearchQueryForDevice: (
    deviceId: string,
  ) => Effect.Effect<string | null, PriceServiceError>;
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
  offer_count: number | null;
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

            // Check if this external_id is excluded for this device
            if (externalId) {
              const exclusionRows = yield* sql<{ cnt: number }>`
                SELECT COUNT(*) as cnt FROM price_quote_exclusions
                WHERE device_id = ${deviceId}
                  AND source = ${source}
                  AND external_id = ${externalId}
              `;
              if ((exclusionRows[0]?.cnt ?? 0) > 0) {
                return 0;
              }
            }

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

          const countRows = yield* sql<{ offer_count: number }>`
            SELECT COUNT(*) as offer_count FROM price_quotes WHERE device_id = ${deviceId}
          `;
          const offerCount = countRows[0]?.offer_count ?? 0;

          yield* sql`
            INSERT OR REPLACE INTO price_summary (device_id, min_price_minor_units, max_price_minor_units, currency, updated_at, offer_count)
            VALUES (${deviceId}, ${row.min_price}, ${row.max_price}, ${row.currency}, unixepoch(), ${offerCount})
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

      excludeQuotes: (params) =>
        sql.withTransaction(
          Effect.gen(function* () {
            const { deviceId, source, externalId, reason } = params;

            yield* sql`
              INSERT INTO price_quote_exclusions (device_id, source, external_id, reason)
              VALUES (${deviceId}, ${source}, ${externalId}, ${reason ?? null})
              ON CONFLICT(device_id, source, external_id) DO NOTHING
            `;

            yield* sql`
              DELETE FROM price_quotes
              WHERE device_id = ${deviceId}
                AND source = ${source}
                AND external_id = ${externalId}
            `;
          }),
        ).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.excludeQuotes failed").pipe(
              Effect.annotateLogs({ ...params, error: e }),
            ),
          ),
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),

      isExcluded: (params) =>
        sql<{ cnt: number }>`
          SELECT COUNT(*) as cnt FROM price_quote_exclusions
          WHERE device_id = ${params.deviceId}
            AND source = ${params.source}
            AND external_id = ${params.externalId}
        `.pipe(
          Effect.map((rows) => (rows[0]?.cnt ?? 0) > 0),
          Effect.mapError(wrapSqlError),
        ),

      getExclusions: (deviceId) =>
        sql<{
          source: string;
          external_id: string;
          reason: string | null;
          created_at: number;
        }>`
          SELECT source, external_id, reason, created_at
          FROM price_quote_exclusions
          WHERE device_id = ${deviceId}
          ORDER BY created_at DESC
        `.pipe(
          Effect.map((rows) =>
            rows.map((r) => ({
              source: r.source,
              externalId: r.external_id,
              reason: r.reason,
              createdAt: r.created_at,
            })),
          ),
          Effect.mapError(wrapSqlError),
        ),

      removeExclusion: (params) =>
        sql`
          DELETE FROM price_quote_exclusions
          WHERE device_id = ${params.deviceId}
            AND source = ${params.source}
            AND external_id = ${params.externalId}
        `.pipe(
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),

      getOfferCountsByDeviceIds: (deviceIds) => {
        if (deviceIds.length === 0) {
          return Effect.succeed({});
        }

        return sql<{ device_id: string; offer_count: number }>`
          SELECT device_id, COALESCE(offer_count, 0) as offer_count
          FROM price_summary
          WHERE device_id IN ${sql.in(deviceIds)}
        `.pipe(
          Effect.map((rows) => {
            const result: Record<string, number> = {};
            for (const row of rows) {
              result[row.device_id] = row.offer_count;
            }
            return result;
          }),
          Effect.mapError(wrapSqlError),
        );
      },

      hasPriceRuPrices: (deviceId) =>
        sql<{ cnt: number }>`
          SELECT COUNT(*) as cnt FROM price_quotes
          WHERE device_id = ${deviceId} AND source = 'price_ru'
          LIMIT 1
        `.pipe(
          Effect.map((rows) => (rows[0]?.cnt ?? 0) > 0),
          Effect.mapError(wrapSqlError),
        ),

      claimUrlRefresh: ({ deviceId, staleThresholdSecs, minIntervalSecs }) =>
        Effect.gen(function* () {
          // Atomic claim: UPDATE only if stale AND not recently started
          yield* sql`
            UPDATE price_summary
            SET url_refresh_started_at = unixepoch()
            WHERE device_id = ${deviceId}
              AND (url_refreshed_at IS NULL OR url_refreshed_at < unixepoch() - ${staleThresholdSecs})
              AND (url_refresh_started_at IS NULL OR url_refresh_started_at < unixepoch() - ${minIntervalSecs})
          `;

          // Check if we actually claimed it
          const changesRow = yield* sql<{ changes: number }>`SELECT changes() as changes`;
          return (changesRow[0]?.changes ?? 0) === 1;
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.claimUrlRefresh failed").pipe(
              Effect.annotateLogs({ deviceId, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),

      updatePriceRuUrls: ({ deviceId, offers }) =>
        sql.withTransaction(
          Effect.gen(function* () {
            let updated = 0;
            const added = 0;
            let unavailable = 0;

            // Empty offers = possible API error, don't clear started_at to let backoff apply
            if (offers.length === 0) {
              return { updated, added, unavailable };
            }

            // Get ALL existing offer_ids for this device (not just available)
            // so previously-unavailable offers can be revived. Use DISTINCT for duplicate rows.
            const existingRows = yield* sql<{ offer_id: string | null }>`
              SELECT DISTINCT offer_id FROM price_quotes
              WHERE device_id = ${deviceId} AND source = 'price_ru'
            `;
            const existingOfferIds = new Set(existingRows.map((r) => r.offer_id).filter(Boolean));

            // Track which offers are still present
            const presentOfferIds = new Set<string>();

            for (const offer of offers) {
              presentOfferIds.add(offer.offerId);

              if (existingOfferIds.has(offer.offerId)) {
                // Update existing offer URL and availability
                yield* sql`
                  UPDATE price_quotes
                  SET url = ${offer.clickUrl}, is_available = ${offer.isAvailable ? 1 : 0}
                  WHERE device_id = ${deviceId}
                    AND source = 'price_ru'
                    AND offer_id = ${offer.offerId}
                    AND (url IS NOT ${offer.clickUrl} OR is_available != ${offer.isAvailable ? 1 : 0})
                `;
                // Count all changed rows (handles duplicate offer_id)
                const changesRow = yield* sql<{ changes: number }>`SELECT changes() as changes`;
                updated += changesRow[0]?.changes ?? 0;
              }
              // Note: we don't add new offers here - that would require full price data
              // The refresh only updates URLs for existing offers
            }

            // Mark disappeared offers as unavailable
            for (const existingId of existingOfferIds) {
              if (existingId && !presentOfferIds.has(existingId)) {
                yield* sql`
                  UPDATE price_quotes
                  SET is_available = 0
                  WHERE device_id = ${deviceId}
                    AND source = 'price_ru'
                    AND offer_id = ${existingId}
                    AND is_available = 1
                `;
                const changesRow = yield* sql<{ changes: number }>`SELECT changes() as changes`;
                unavailable += changesRow[0]?.changes ?? 0;
              }
            }

            // Update refresh timestamp and clear started_at
            yield* sql`
              UPDATE price_summary
              SET url_refreshed_at = unixepoch(), url_refresh_started_at = NULL
              WHERE device_id = ${deviceId}
            `;

            return { updated, added, unavailable };
          }),
        ).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.updatePriceRuUrls failed").pipe(
              Effect.annotateLogs({ deviceId, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),

      setUrlRefreshedAt: (deviceId) =>
        sql`
          UPDATE price_summary
          SET url_refreshed_at = unixepoch(), url_refresh_started_at = NULL
          WHERE device_id = ${deviceId}
        `.pipe(
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),

      releaseUrlRefreshClaim: (deviceId) =>
        sql`
          UPDATE price_summary
          SET url_refresh_started_at = NULL
          WHERE device_id = ${deviceId}
        `.pipe(
          Effect.asVoid,
          Effect.mapError(wrapSqlError),
        ),

      getSearchQueryForDevice: (deviceId) =>
        Effect.gen(function* () {
          // Try to get query from device_sources metadata first
          const metadataRows = yield* sql<{ metadata: string | null }>`
            SELECT metadata FROM device_sources
            WHERE device_id = ${deviceId} AND source = 'price_ru'
            LIMIT 1
          `;

          const metadata = metadataRows[0]?.metadata;
          if (metadata) {
            try {
              const parsed = JSON.parse(metadata);
              if (parsed.query) return parsed.query as string;
            } catch {
              // Ignore parse errors
            }
          }

          // Fallback to device name
          const deviceRows = yield* sql<{ name: string }>`
            SELECT name FROM devices WHERE id = ${deviceId}
          `;

          return deviceRows[0]?.name ?? null;
        }).pipe(
          Effect.tapError((e) =>
            Effect.logWarning("PriceService.getSearchQueryForDevice failed").pipe(
              Effect.annotateLogs({ deviceId, error: e }),
            ),
          ),
          Effect.mapError(wrapSqlError),
        ),
    });
  }),
);
