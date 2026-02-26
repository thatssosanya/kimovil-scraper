import { Elysia } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { BrowserService } from "../services/browser";
import { LinkResolverService } from "../services/link-resolver";
import { parseYandexPrices, extractProductTitle } from "../sources/yandex_market/extractor";
import { ALLOWED_HOSTS, validateYandexMarketUrl } from "../sources/yandex_market/url-utils";
import { YandexBrowserError } from "../sources/yandex_market/errors";
import { log } from "../utils/logger";

const SHORTENER_HOSTS = ["kik.cat", "ya.cc", "clck.ru"];
const SEARCH_LIMIT = 12;
const SEARCH_MIN_RESULTS = 6;
const SEARCH_CACHE_SCHEMA_VERSION = "v4";
const SEARCH_CACHE_FILTER_VERSION = "v1";
const SEARCH_CACHE_REGION = "ru";
const SEARCH_CACHE_FRESH_TTL_SECONDS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_CACHE_TTL_SECONDS ?? "172800",
  10,
);
const SEARCH_CACHE_ZERO_TTL_SECONDS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_ZERO_CACHE_TTL_SECONDS ?? "3600",
  10,
);
const SEARCH_CACHE_MAX_ROWS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_CACHE_MAX_ROWS ?? "100",
  10,
);
const SEARCH_CARD_CACHE_TTL_SECONDS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_CARD_CACHE_TTL_SECONDS ?? "43200",
  10,
);
const SEARCH_CARD_CACHE_MAX_ROWS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_CARD_CACHE_MAX_ROWS ?? "1000",
  10,
);
const SEARCH_CARD_CONCURRENCY = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_CARD_CONCURRENCY ?? "4",
  10,
);
const SEARCH_REQUEST_BUDGET_MS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_BUDGET_MS ?? "12000",
  10,
);
const SEARCH_READY_WAIT_MS = Number.parseInt(
  process.env.EXTENSION_YANDEX_SEARCH_READY_WAIT_MS ?? "1200",
  10,
);
const SEARCH_MIN_QUERY_LENGTH = 4;

const yandexSearchInflight = new Map<string, Promise<{ success: boolean; data?: SearchResponsePayload; error?: string }>>();

type YandexUrlResolution =
  | { valid: true; externalId: string; cleanUrl: string }
  | { valid: false; error: string };

type ParsedBonus = { bonusRubles: number; matchedText: string };
type SearchCardResult = {
  url: string;
  externalId: string;
  title?: string;
  priceRubles?: number;
  bonusRubles?: number;
  matchedText?: string;
};

type SearchMeta = {
  createdAt: number;
  expiresAt: number;
  scrapeDurationMs: number;
  filteredOutCount: number;
  partial: boolean;
  zeroResult: boolean;
  totalCandidates: number;
  failedCards: number;
  limit: number;
};

type SearchResponsePayload = {
  query: string;
  normalizedQuery: string;
  links: SearchCardResult[];
  cacheHit: boolean;
  stale: boolean;
  warning?: string;
  meta: SearchMeta;
};

type CacheableSearchPayload = Omit<SearchResponsePayload, "cacheHit" | "stale">;

type SearchCacheRow = {
  cache_key: string;
  normalized_query: string;
  raw_query: string;
  response_json: string;
  is_zero_result: number;
  created_at: number;
  expires_at: number;
  last_hit_at: number | null;
  hit_count: number;
  schema_version: string;
  filter_version: string;
  source_region: string | null;
};

type SearchCardCacheRow = {
  external_id: string;
  url: string;
  title: string | null;
  price_rubles: number | null;
  bonus_rubles: number | null;
  matched_text: string | null;
  updated_at: number;
  expires_at: number;
};

type SearchAttemptResult = {
  payload: CacheableSearchPayload;
  partial: boolean;
  failedCards: number;
};

const hasUsableCardData = (result: SearchCardResult): boolean =>
  Boolean(result.title) ||
  (typeof result.priceRubles === "number" && result.priceRubles > 0) ||
  (typeof result.bonusRubles === "number" && result.bonusRubles > 0);

const formatErrorForLogs = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === "object" && error !== null) {
    const withMessage = error as { message?: unknown; _tag?: unknown };
    const tag = typeof withMessage._tag === "string" ? withMessage._tag : "Error";
    const message = typeof withMessage.message === "string" ? withMessage.message : "unknown";
    return `${tag}: ${message}`;
  }
  return String(error);
};

const normalizeQueryForCache = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/([\p{L}])(\d)/gu, "$1 $2")
    .replace(/(\d)([\p{L}])/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const makeSearchCacheKey = (normalizedQuery: string): string =>
  [
    SEARCH_CACHE_SCHEMA_VERSION,
    SEARCH_CACHE_FILTER_VERSION,
    SEARCH_CACHE_REGION,
    normalizedQuery,
  ].join("|");

const normalizeForSearch = (value: string): string => normalizeQueryForCache(value);

const getQueryTokens = (query: string): string[] => {
  const normalized = normalizeForSearch(query);
  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return [...new Set(tokens)];
};

const isTextRelevant = (queryTokens: string[], result: SearchCardResult): boolean => {
  if (queryTokens.length === 0) {
    return true;
  }

  const text = normalizeForSearch(`${result.title ?? ""} ${result.matchedText ?? ""}`);
  if (!text) {
    return false;
  }

  const matchedTokens = queryTokens.filter((token) => text.includes(token));
  if (queryTokens.length === 1) {
    return matchedTokens.length >= 1;
  }

  if (queryTokens.length === 2) {
    return matchedTokens.length >= 2;
  }

  return matchedTokens.length >= Math.ceil(queryTokens.length / 2);
};

const filterPriceOutliers = (results: SearchCardResult[]): SearchCardResult[] => {
  const prices = results
    .map((result) => result.priceRubles)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b);

  if (prices.length < 3) {
    return results;
  }

  const median =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

  if (!Number.isFinite(median) || median <= 0) {
    return results;
  }

  return results.filter((result) => {
    if (!result.priceRubles || result.priceRubles <= 0) {
      return true;
    }

    const ratio = result.priceRubles / median;
    return ratio <= 5 && ratio >= 0.2;
  });
};

const filterSearchResults = (query: string, results: SearchCardResult[]): SearchCardResult[] => {
  const queryTokens = getQueryTokens(query);
  const byText = results.filter((result) => isTextRelevant(queryTokens, result));
  const textFiltered = byText.length > 0 ? byText : results;
  const byPrice = filterPriceOutliers(textFiltered);

  return byPrice.length > 0 ? byPrice : textFiltered;
};

const parseCachedPayload = (raw: string): CacheableSearchPayload | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<CacheableSearchPayload>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.query !== "string" || typeof parsed.normalizedQuery !== "string") {
      return null;
    }
    if (!Array.isArray(parsed.links) || !parsed.meta || typeof parsed.meta !== "object") {
      return null;
    }
    return parsed as CacheableSearchPayload;
  } catch {
    return null;
  }
};

const toSearchResponsePayload = (
  payload: CacheableSearchPayload,
  options: { cacheHit: boolean; stale: boolean; warning?: string },
): SearchResponsePayload => ({
  ...payload,
  cacheHit: options.cacheHit,
  stale: options.stale,
  warning: options.warning,
});

const touchSearchCacheHit = (
  cacheKey: string,
  now: number,
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      UPDATE extension_search_cache
      SET last_hit_at = ${now},
          hit_count = hit_count + 1
      WHERE cache_key = ${cacheKey}
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache hit touch failed").pipe(
          Effect.annotateLogs({ cacheKey, error }),
        ),
      ),
    );
  });

const getSearchCacheEntry = (
  cacheKey: string,
): Effect.Effect<SearchCacheRow | null, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<SearchCacheRow>`
      SELECT *
      FROM extension_search_cache
      WHERE cache_key = ${cacheKey}
      LIMIT 1
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache lookup failed").pipe(
          Effect.annotateLogs({ cacheKey, error }),
          Effect.map(() => [] as SearchCacheRow[]),
        ),
      ),
    );

    return rows[0] ?? null;
  });

const saveSearchCacheEntry = (
  params: {
    cacheKey: string;
    normalizedQuery: string;
    rawQuery: string;
    payload: CacheableSearchPayload;
    now: number;
    expiresAt: number;
  },
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const isZeroResult = params.payload.links.length === 0 ? 1 : 0;
    const payloadJson = JSON.stringify(params.payload);

    yield* sql`
      INSERT INTO extension_search_cache (
        cache_key,
        normalized_query,
        raw_query,
        response_json,
        is_zero_result,
        created_at,
        expires_at,
        last_hit_at,
        hit_count,
        schema_version,
        filter_version,
        source_region
      )
      VALUES (
        ${params.cacheKey},
        ${params.normalizedQuery},
        ${params.rawQuery},
        ${payloadJson},
        ${isZeroResult},
        ${params.now},
        ${params.expiresAt},
        ${params.now},
        0,
        ${SEARCH_CACHE_SCHEMA_VERSION},
        ${SEARCH_CACHE_FILTER_VERSION},
        ${SEARCH_CACHE_REGION}
      )
      ON CONFLICT(cache_key) DO UPDATE SET
        normalized_query = excluded.normalized_query,
        raw_query = excluded.raw_query,
        response_json = excluded.response_json,
        is_zero_result = excluded.is_zero_result,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        last_hit_at = excluded.last_hit_at,
        hit_count = 0,
        schema_version = excluded.schema_version,
        filter_version = excluded.filter_version,
        source_region = excluded.source_region
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache save failed").pipe(
          Effect.annotateLogs({ cacheKey: params.cacheKey, error }),
        ),
      ),
    );

    // Lazy cleanup: remove expired rows and keep only most recent N entries.
    yield* sql`
      DELETE FROM extension_search_cache
      WHERE expires_at < ${params.now}
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache expired cleanup failed").pipe(
          Effect.annotateLogs({ error }),
        ),
      ),
    );

    yield* sql.unsafe(`
      DELETE FROM extension_search_cache
      WHERE cache_key IN (
        SELECT cache_key
        FROM extension_search_cache
        ORDER BY created_at DESC
        LIMIT -1 OFFSET ${Math.max(1, SEARCH_CACHE_MAX_ROWS)}
      )
    `).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache size cleanup failed").pipe(
          Effect.annotateLogs({ maxRows: SEARCH_CACHE_MAX_ROWS, error }),
        ),
      ),
    );
  });

const invalidateSearchCacheByPrefix = (
  normalizedPrefix: string,
): Effect.Effect<number, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      DELETE FROM extension_search_cache
      WHERE normalized_query LIKE ${`${normalizedPrefix}%`}
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache prefix invalidation failed").pipe(
          Effect.annotateLogs({ normalizedPrefix, error }),
          Effect.zipRight(Effect.succeed<void>(undefined)),
        ),
      ),
    );

    const result = yield* sql<{ changes: number }>`SELECT changes() as changes`.pipe(
      Effect.catchAll(() => Effect.succeed([{ changes: 0 }])),
    );

    return result[0]?.changes ?? 0;
  });

const invalidateSearchCacheAll = (): Effect.Effect<number, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM extension_search_cache`.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache full invalidation failed").pipe(
          Effect.annotateLogs({ error }),
          Effect.zipRight(Effect.succeed<void>(undefined)),
        ),
      ),
    );

    const result = yield* sql<{ changes: number }>`SELECT changes() as changes`.pipe(
      Effect.catchAll(() => Effect.succeed([{ changes: 0 }])),
    );

    return result[0]?.changes ?? 0;
  });

const getRecentSearchCacheEntries = (
  limit: number,
): Effect.Effect<SearchResponsePayload[], never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const safeLimit = Math.max(1, Math.min(SEARCH_LIMIT, limit));
    const rows = yield* sql<SearchCacheRow>`
      SELECT *
      FROM extension_search_cache
      ORDER BY COALESCE(last_hit_at, created_at) DESC
      LIMIT ${safeLimit}
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search cache recent lookup failed").pipe(
          Effect.annotateLogs({ safeLimit, error }),
          Effect.map(() => [] as SearchCacheRow[]),
        ),
      ),
    );

    const now = Math.floor(Date.now() / 1000);
    const parsedRows = rows
      .map((row) => {
        const parsed = parseCachedPayload(row.response_json);
        if (!parsed) {
          return null;
        }

        return toSearchResponsePayload(parsed, {
          cacheHit: true,
          stale: row.expires_at <= now,
        });
      })
      .filter((row): row is SearchResponsePayload => row !== null);

    return parsedRows;
  });

const getSearchCardCache = (
  externalIds: string[],
  now: number,
): Effect.Effect<Map<string, SearchCardResult>, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const uniqueExternalIds = [...new Set(externalIds.map((value) => value.trim()).filter(Boolean))];
    if (uniqueExternalIds.length === 0) {
      return new Map<string, SearchCardResult>();
    }

    const sql = yield* SqlClient.SqlClient;
    const placeholders = uniqueExternalIds.map(() => "?").join(", ");
    const rows = yield* sql.unsafe(
      `
        SELECT external_id, url, title, price_rubles, bonus_rubles, matched_text, updated_at, expires_at
        FROM extension_search_card_cache
        WHERE external_id IN (${placeholders})
          AND expires_at > ?
      `,
      [...uniqueExternalIds, now],
    ).pipe(
      Effect.map((result) => result as SearchCardCacheRow[]),
      Effect.catchAll((error) =>
        Effect.logWarning("extension search card cache lookup failed").pipe(
          Effect.annotateLogs({ count: uniqueExternalIds.length, error }),
          Effect.map(() => [] as SearchCardCacheRow[]),
        ),
      ),
    );

    const cacheMap = new Map<string, SearchCardResult>();
    for (const row of rows) {
      const cachedResult: SearchCardResult = {
        externalId: row.external_id,
        url: row.url,
        title: row.title ?? undefined,
        priceRubles: typeof row.price_rubles === "number" ? row.price_rubles : undefined,
        bonusRubles: typeof row.bonus_rubles === "number" ? row.bonus_rubles : undefined,
        matchedText: row.matched_text ?? undefined,
      };
      if (hasUsableCardData(cachedResult)) {
        cacheMap.set(row.external_id, cachedResult);
      }
    }

    return cacheMap;
  });

const saveSearchCardCache = (
  params: { results: SearchCardResult[]; now: number },
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    if (params.results.length === 0) {
      return;
    }

    const sql = yield* SqlClient.SqlClient;
    const expiresAt = params.now + SEARCH_CARD_CACHE_TTL_SECONDS;

    for (const result of params.results) {
      yield* sql`
        INSERT INTO extension_search_card_cache (
          external_id,
          url,
          title,
          price_rubles,
          bonus_rubles,
          matched_text,
          updated_at,
          expires_at,
          hit_count,
          last_hit_at
        )
        VALUES (
          ${result.externalId},
          ${result.url},
          ${result.title ?? null},
          ${result.priceRubles ?? null},
          ${result.bonusRubles ?? null},
          ${result.matchedText ?? null},
          ${params.now},
          ${expiresAt},
          0,
          NULL
        )
        ON CONFLICT(external_id) DO UPDATE SET
          url = excluded.url,
          title = excluded.title,
          price_rubles = excluded.price_rubles,
          bonus_rubles = excluded.bonus_rubles,
          matched_text = excluded.matched_text,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at,
          hit_count = 0,
          last_hit_at = NULL
      `.pipe(
        Effect.catchAll((error) =>
          Effect.logWarning("extension search card cache save failed").pipe(
            Effect.annotateLogs({ externalId: result.externalId, error }),
          ),
        ),
      );
    }

    yield* sql`
      DELETE FROM extension_search_card_cache
      WHERE expires_at < ${params.now}
    `.pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search card cache expired cleanup failed").pipe(
          Effect.annotateLogs({ error }),
        ),
      ),
    );

    yield* sql.unsafe(`
      DELETE FROM extension_search_card_cache
      WHERE external_id IN (
        SELECT external_id
        FROM extension_search_card_cache
        ORDER BY updated_at DESC
        LIMIT -1 OFFSET ${Math.max(1, SEARCH_CARD_CACHE_MAX_ROWS)}
      )
    `).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search card cache size cleanup failed").pipe(
          Effect.annotateLogs({ maxRows: SEARCH_CARD_CACHE_MAX_ROWS, error }),
        ),
      ),
    );
  });

const touchSearchCardCacheHits = (
  externalIds: string[],
  now: number,
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const uniqueExternalIds = [...new Set(externalIds.map((value) => value.trim()).filter(Boolean))];
    if (uniqueExternalIds.length === 0) {
      return;
    }

    const sql = yield* SqlClient.SqlClient;
    const placeholders = uniqueExternalIds.map(() => "?").join(", ");

    yield* sql.unsafe(
      `
        UPDATE extension_search_card_cache
        SET last_hit_at = ?,
            hit_count = hit_count + 1
        WHERE external_id IN (${placeholders})
      `,
      [now, ...uniqueExternalIds],
    ).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning("extension search card cache hit touch failed").pipe(
          Effect.annotateLogs({ count: uniqueExternalIds.length, error }),
        ),
      ),
    );
  });

const scrapeYandexSearch = (
  query: string,
  normalizedQuery: string,
): Effect.Effect<SearchAttemptResult, unknown, BrowserService | SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const startedAt = Date.now();
    const now = Math.floor(Date.now() / 1000);
    const deadlineMs = startedAt + SEARCH_REQUEST_BUDGET_MS;
    const searchUrl = `https://market.yandex.ru/search?text=${encodeURIComponent(query)}`;
    const browserService = yield* BrowserService;

    const searchHtml = yield* browserService.withPersistentStealthPage("yandex_market", (page) =>
      Effect.gen(function* () {
        const navigate = (waitUntil: "domcontentloaded" | "commit", timeout: number) =>
          Effect.tryPromise({
            try: () => page.goto(searchUrl, { waitUntil, timeout }),
            catch: (cause) =>
              new YandexBrowserError({
                message: "Failed to open Yandex search",
                url: searchUrl,
                cause,
              }),
          });

        // First try a normal DOM-ready navigation; if it stalls behind anti-bot/challenge,
        // retry with earlier waitUntil=commit and a larger timeout to get parsable HTML.
        yield* navigate("domcontentloaded", 30000).pipe(
          Effect.catchAll(() => navigate("commit", 45000)),
        );

        yield* Effect.tryPromise({
          try: () => page.waitForSelector('a[href*="/card/"]', { timeout: SEARCH_READY_WAIT_MS }),
          catch: () => null,
        });

        return yield* Effect.tryPromise({
          try: () => page.content(),
          catch: (cause) =>
            new YandexBrowserError({
              message: "Failed to get search HTML",
              url: searchUrl,
              cause,
            }),
        });
      }),
    );

    const hasBonus = (result: SearchCardResult): boolean =>
      typeof result.bonusRubles === "number" && result.bonusRubles > 0;
    const appendUnique = (
      target: SearchCardResult[],
      source: SearchCardResult[],
      seen: Set<string>,
    ): void => {
      for (const candidate of source) {
        const key = `${candidate.externalId}|${candidate.url}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        target.push(candidate);
      }
    };

    const scrapeCard = (
      link: { url: string; externalId: string },
    ): Effect.Effect<SearchCardResult, unknown, never> => {
      const parseCardFromPage = (page: Parameters<Parameters<BrowserService["withPooledBrowserPage"]>[0]>[0]) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () => page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 30000 }),
            catch: (cause) =>
              new YandexBrowserError({
                message: "Failed to open Yandex card from search",
                url: link.url,
                cause,
              }),
          });

          yield* Effect.tryPromise({
            try: () =>
              page.waitForSelector(
                '[data-zone-name="referralReward"], [data-auto="snippet-price-current"], h1',
                { timeout: SEARCH_READY_WAIT_MS },
              ),
            catch: () => null,
          });

          const cardHtml = yield* Effect.tryPromise({
            try: () => page.content(),
            catch: (cause) =>
              new YandexBrowserError({
                message: "Failed to extract card HTML",
                url: link.url,
                cause,
              }),
          });

          const cardOffers = parseYandexPrices(cardHtml);
          const primaryOffer = cardOffers.find((offer) => offer.isPrimary) ?? cardOffers[0];
          const priceRubles = primaryOffer ? Math.round(primaryOffer.priceMinorUnits / 100) : undefined;

          let parsedBonus = extractPurpleBonusFromHtml(cardHtml);
          if (!parsedBonus) {
            const cardText = yield* Effect.tryPromise({
              try: () => page.evaluate(() => document.body.innerText || ""),
              catch: (cause) =>
                new YandexBrowserError({
                  message: "Failed to extract card text",
                  url: link.url,
                  cause,
                }),
            });
            parsedBonus = extractPurpleBonusFromText(cardText);
          }

          return {
            url: link.url,
            externalId: link.externalId,
            title: extractProductTitle(cardHtml) ?? undefined,
            priceRubles,
            bonusRubles: parsedBonus?.bonusRubles,
            matchedText: parsedBonus?.matchedText,
          } satisfies SearchCardResult;
        }).pipe(
          Effect.flatMap((parsed) => {
            if (!hasUsableCardData(parsed)) {
              return Effect.fail(
                new YandexBrowserError({
                  message: "Card page did not contain usable product data",
                  url: link.url,
                }),
              );
            }
            return Effect.succeed(parsed);
          }),
        );

      return browserService
        .withPooledBrowserPageForSource("yandex_market", parseCardFromPage)
        .pipe(
          Effect.catchAll((pooledError) =>
            Effect.logWarning("extension yandex pooled card scrape failed, falling back to persistent session").pipe(
              Effect.annotateLogs({
                query,
                normalizedQuery,
                url: link.url,
                pooledError: formatErrorForLogs(pooledError),
              }),
              Effect.zipRight(
                browserService.withPersistentStealthPage("yandex_market", parseCardFromPage),
              ),
            ),
          ),
        );
    };

    const scrapeBatch = (
      links: Array<{ url: string; externalId: string }>,
      cachedByExternalId: Map<string, SearchCardResult>,
    ): Effect.Effect<
      {
        filtered: SearchCardResult[];
        totalBeforeFilter: number;
        failedCards: number;
        cachedHits: number;
        scrapedResults: SearchCardResult[];
        budgetReached: boolean;
      },
      never,
      never
    > =>
      Effect.gen(function* () {
        const cachedResults: SearchCardResult[] = [];
        const toScrape: Array<{ url: string; externalId: string }> = [];

        for (const link of links) {
          const cached = cachedByExternalId.get(link.externalId);
          if (cached) {
            cachedResults.push({ ...cached, url: link.url, externalId: link.externalId });
          } else {
            toScrape.push(link);
          }
        }

        const remainingMs = Math.max(0, deadlineMs - Date.now());
        const estimatedWaveMs = 3500;
        const maxWaves = Math.max(1, Math.floor(remainingMs / estimatedWaveMs));
        const maxLaunch = Math.max(1, maxWaves * Math.max(1, SEARCH_CARD_CONCURRENCY));
        const linksInBudget = toScrape.slice(0, maxLaunch).filter(() => Date.now() < deadlineMs);
        const budgetReached = linksInBudget.length < toScrape.length;

        const scrapeOutcomes = yield* Effect.all(
          linksInBudget.map((link) =>
            scrapeCard(link).pipe(
              Effect.either,
              Effect.map((result) => ({ link, result })),
            ),
          ),
          { concurrency: Math.max(1, SEARCH_CARD_CONCURRENCY) },
        );

        const scrapedResults: SearchCardResult[] = [];
        let failedCards = 0;

        for (const outcome of scrapeOutcomes) {
          if (outcome.result._tag === "Right") {
            scrapedResults.push(outcome.result.right);
            continue;
          }

          failedCards += 1;
          yield* Effect.logWarning("extension yandex search card scrape failed").pipe(
            Effect.annotateLogs({
              query,
              normalizedQuery,
              url: outcome.link.url,
              error: formatErrorForLogs(outcome.result.left),
            }),
          );
        }

        const allResults = [...cachedResults, ...scrapedResults];
        const filtered = filterSearchResults(query, allResults);

        return {
          filtered,
          totalBeforeFilter: allResults.length,
          failedCards,
          cachedHits: cachedResults.length,
          scrapedResults,
          budgetReached,
        };
      });

    const firstPageLinks = extractCardLinksFromSearchHtml(searchHtml, SEARCH_LIMIT, 0);
    const secondPageLinks = extractCardLinksFromSearchHtml(searchHtml, SEARCH_LIMIT, SEARCH_LIMIT);
    const totalCandidates = firstPageLinks.length + secondPageLinks.length;
    const sql = yield* SqlClient.SqlClient;

    const cachedByExternalId = yield* getSearchCardCache(
      [...firstPageLinks, ...secondPageLinks].map((link) => link.externalId),
      now,
    ).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const firstBatch = yield* scrapeBatch(firstPageLinks, cachedByExternalId);
    const composedResults: SearchCardResult[] = [];
    const seenComposed = new Set<string>();
    appendUnique(composedResults, firstBatch.filtered.filter(hasBonus), seenComposed);

    let totalFilteredCandidates = firstBatch.totalBeforeFilter;
    let failedCards = firstBatch.failedCards;
    let budgetReached = firstBatch.budgetReached;
    const scrapedForCache = [...firstBatch.scrapedResults];
    let cachedHits = firstBatch.cachedHits;

    let secondBatch: {
      filtered: SearchCardResult[];
      totalBeforeFilter: number;
      failedCards: number;
      cachedHits: number;
      scrapedResults: SearchCardResult[];
      budgetReached: boolean;
    } | null = null;
    if (composedResults.length < SEARCH_MIN_RESULTS && Date.now() < deadlineMs) {
      secondBatch = yield* scrapeBatch(secondPageLinks, cachedByExternalId);
      totalFilteredCandidates += secondBatch.totalBeforeFilter;
      failedCards += secondBatch.failedCards;
      budgetReached = budgetReached || secondBatch.budgetReached;
      scrapedForCache.push(...secondBatch.scrapedResults);
      cachedHits += secondBatch.cachedHits;

      appendUnique(composedResults, secondBatch.filtered.filter(hasBonus), seenComposed);
    } else if (composedResults.length < SEARCH_MIN_RESULTS && Date.now() >= deadlineMs) {
      budgetReached = true;
    }

    if (composedResults.length < SEARCH_MIN_RESULTS) {
      appendUnique(
        composedResults,
        [
          ...firstBatch.filtered.filter((result) => !hasBonus(result)),
          ...(secondBatch ? secondBatch.filtered.filter((result) => !hasBonus(result)) : []),
        ],
        seenComposed,
      );
      if (composedResults.length > SEARCH_MIN_RESULTS) {
        composedResults.length = SEARCH_MIN_RESULTS;
      }
    }

    const uniqueScrapedForCache = [
      ...new Map(scrapedForCache.map((result) => [`${result.externalId}|${result.url}`, result])).values(),
    ];

    yield* saveSearchCardCache({ results: uniqueScrapedForCache, now }).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
    );

    yield* touchSearchCardCacheHits(
      [...firstPageLinks, ...secondPageLinks]
        .map((link) => link.externalId)
        .filter((externalId) => cachedByExternalId.has(externalId)),
      now,
    ).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const scrapeDurationMs = Date.now() - startedAt;
    log.info(
      "ExtensionSearch",
      `query="${query}" durationMs=${scrapeDurationMs} candidates=${totalCandidates} cachedHits=${cachedHits} scraped=${uniqueScrapedForCache.length} failed=${failedCards} budgetReached=${budgetReached}`,
    );

    return {
      payload: {
        query,
        normalizedQuery,
        links: composedResults,
        meta: {
          createdAt: now,
          expiresAt:
            now +
            (composedResults.length === 0
              ? SEARCH_CACHE_ZERO_TTL_SECONDS
              : SEARCH_CACHE_FRESH_TTL_SECONDS),
          scrapeDurationMs,
          filteredOutCount: Math.max(0, totalFilteredCandidates - composedResults.length),
          partial: failedCards > 0 || budgetReached,
          zeroResult: composedResults.length === 0,
          totalCandidates,
          failedCards,
          limit: SEARCH_LIMIT,
        },
      },
      partial: failedCards > 0 || budgetReached,
      failedCards,
    } satisfies SearchAttemptResult;
  });

const parseRubles = (raw: string): number | null => {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const extractPurpleBonusFromText = (pageText: string): ParsedBonus | null => {
  const lines = pageText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/(балл|бонус|кешб|кэшб|cashback|plus|плюс)/i.test(line)) {
      continue;
    }

    const patterns = [
      /(?:верн[её]т[сяь]|кешб[эе]к|кэшб[эе]к|бонус(?:а|ов)?|балл(?:а|ов)?|plus|плюс)[^\d]{0,24}([\d\s\u00a0\u202f]{2,})/i,
      /([\d\s\u00a0\u202f]{2,})\s*(?:балл(?:а|ов)?|бонус(?:а|ов)?|кешб[эе]к|кэшб[эе]к)/i,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }

      const parsed = parseRubles(match[1]);
      if (!parsed) {
        continue;
      }

      if (parsed > 200_000) {
        continue;
      }

      return { bonusRubles: parsed, matchedText: line };
    }
  }

  return null;
};

const extractCardLinksFromSearchHtml = (
  html: string,
  limit: number,
  offset = 0,
): Array<{ url: string; externalId: string }> => {
  const links: Array<{ url: string; externalId: string }> = [];
  const seen = new Set<string>();
  const hrefRegex = /href="([^"]*\/card\/[^"\s]+\/\d{5,}[^"\s]*)"/g;

  let match: RegExpExecArray | null;
  let skipped = 0;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1].replace(/&amp;/g, "&");

    let parsed: URL;
    try {
      parsed = new URL(rawHref, "https://market.yandex.ru");
    } catch {
      continue;
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      continue;
    }

    const idMatch = parsed.pathname.match(/\/(\d{5,})(?:\/|$)/);
    if (!idMatch) {
      continue;
    }

    parsed.search = "";
    parsed.hash = "";
    const normalized = `${parsed.origin}${parsed.pathname}`;
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    if (skipped < offset) {
      skipped += 1;
      continue;
    }

    links.push({ url: normalized, externalId: idMatch[1] });
    if (links.length >= limit) {
      break;
    }
  }

  return links;
};

const extractPurpleBonusFromHtml = (html: string): ParsedBonus | null => {
  const match = html.match(
    /data-zone-name="referralReward"[\s\S]{0,3000}?<span[^>]*>([\d\s\u00a0\u202f]+)<\/span>/i,
  );
  if (!match) {
    return null;
  }

  const parsed = parseRubles(match[1]);
  if (!parsed) {
    return null;
  }

  return {
    bonusRubles: parsed,
    matchedText: `referralReward:${match[1].trim()}`,
  };
};

const resolveYandexUrl = (url: string): Effect.Effect<YandexUrlResolution, never, LinkResolverService> =>
  Effect.gen(function* () {
    const validation = validateYandexMarketUrl(url);
    if (validation.valid) {
      return {
        valid: true as const,
        externalId: validation.externalId,
        cleanUrl: validation.cleanUrl,
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { valid: false as const, error: "Invalid URL format" };
    }

    if (!SHORTENER_HOSTS.includes(parsedUrl.hostname)) {
      return { valid: false as const, error: validation.error };
    }

    const resolver = yield* LinkResolverService;
    const resolvedEither = yield* resolver.resolve(url).pipe(Effect.either);

    if (resolvedEither._tag === "Left") {
      return { valid: false as const, error: resolvedEither.left.message };
    }

    const resolved = resolvedEither.right;
    if (!resolved.isYandexMarket || !resolved.resolvedUrl || !resolved.externalId) {
      return {
        valid: false as const,
        error: resolved.error ?? "Shortener link did not resolve to a valid Yandex Market URL",
      };
    }

    return { valid: true as const, externalId: resolved.externalId, cleanUrl: resolved.resolvedUrl };
  });

const getExtensionSecret = (): string => process.env.EXTENSION_SECRET || "s2jq43us23n%EeeAbs2!@#mUt";

const isValidExtensionSecret = (secret: unknown): boolean =>
  typeof secret === "string" && secret.length > 0 && secret === getExtensionSecret();

export const createExtensionRoutes = () =>
  new Elysia({ prefix: "/api/extension" })
    .post("/yandex/bonus-from-link", async ({ body, set }) => {
      const { secret, url } = (body || {}) as { secret?: string; url?: string };

      if (!isValidExtensionSecret(secret)) {
        set.status = 401;
        return { success: false, error: "Invalid extension secret" };
      }

      if (!url) {
        set.status = 400;
        return { success: false, error: "Missing required field: url" };
      }

      const program = Effect.gen(function* () {
        const resolved = yield* resolveYandexUrl(url);
        if (!resolved.valid) {
          return { success: false as const, error: resolved.error };
        }

        const navigateUrl = validateYandexMarketUrl(url).valid ? url : resolved.cleanUrl;
        const browserService = yield* BrowserService;

        const parsedBonus = yield* browserService.withPersistentStealthPage("yandex_market", (page) =>
          Effect.gen(function* () {
            yield* Effect.tryPromise({
              try: () => page.goto(navigateUrl, { waitUntil: "domcontentloaded", timeout: 60000 }),
              catch: (cause) =>
                new YandexBrowserError({
                  message: "Failed to navigate to Yandex card",
                  url: navigateUrl,
                  cause,
                }),
            });

            yield* Effect.promise(() => page.waitForTimeout(3000));

            const html = yield* Effect.tryPromise({
              try: () => page.content(),
              catch: (cause) =>
                new YandexBrowserError({
                  message: "Failed to extract card HTML",
                  url: navigateUrl,
                  cause,
                }),
            });

            const fromHtml = extractPurpleBonusFromHtml(html);
            if (fromHtml) {
              return fromHtml;
            }

            const text = yield* Effect.tryPromise({
              try: () => page.evaluate(() => document.body.innerText || ""),
              catch: (cause) =>
                new YandexBrowserError({
                  message: "Failed to extract card text",
                  url: navigateUrl,
                  cause,
                }),
            });

            return extractPurpleBonusFromText(text);
          }),
        );

        if (!parsedBonus) {
          return {
            success: false as const,
            error: "Purple bonus not found",
            externalId: resolved.externalId,
          };
        }

        return {
          success: true as const,
          data: {
            externalId: resolved.externalId,
            bonusRubles: parsedBonus.bonusRubles,
            matchedText: parsedBonus.matchedText,
          },
        };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result.success) {
        set.status = 400;
      }
      return result;
    })
    .post("/yandex/search-links", async ({ body, set }) => {
      const { secret, query } = (body || {}) as {
        secret?: string;
        query?: string;
      };

      if (!isValidExtensionSecret(secret)) {
        set.status = 401;
        return { success: false, error: "Invalid extension secret" };
      }

      if (!query || typeof query !== "string") {
        set.status = 400;
        return { success: false, error: "Missing required field: query" };
      }

      const trimmedQuery = query.trim();
      if (trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
        set.status = 400;
        return {
          success: false,
          error: `Query must be at least ${SEARCH_MIN_QUERY_LENGTH} characters`,
        };
      }

      const normalizedQuery = normalizeQueryForCache(trimmedQuery);
      if (!normalizedQuery) {
        set.status = 400;
        return { success: false, error: "Query is empty after normalization" };
      }
      const cacheKey = makeSearchCacheKey(normalizedQuery);
      const now = Math.floor(Date.now() / 1000);

      const cachedRow = await LiveRuntime.runPromise(getSearchCacheEntry(cacheKey));
      if (cachedRow && cachedRow.expires_at > now) {
        const parsed = parseCachedPayload(cachedRow.response_json);
        if (parsed) {
          await LiveRuntime.runPromise(touchSearchCacheHit(cacheKey, now));
          log.info(
            "ExtensionSearchCache",
            `hit key=${cacheKey} query="${trimmedQuery}" results=${parsed.links.length}`,
          );
          return {
            success: true as const,
            data: toSearchResponsePayload(parsed, { cacheHit: true, stale: false }),
          };
        }
      }

      const inFlight = yandexSearchInflight.get(cacheKey);
      if (inFlight) {
        log.info("ExtensionSearchCache", `inflight-wait key=${cacheKey}`);
        return inFlight;
      }

      log.info("ExtensionSearchCache", `miss key=${cacheKey} query="${trimmedQuery}" limit=${SEARCH_LIMIT}`);

      const leaderPromise = (async () => {
        const staleRow = await LiveRuntime.runPromise(getSearchCacheEntry(cacheKey));
        const stalePayload = staleRow ? parseCachedPayload(staleRow.response_json) : null;

        try {
          const scrapeResult = await LiveRuntime.runPromise(
            scrapeYandexSearch(trimmedQuery, normalizedQuery),
          );

          const payload = scrapeResult.payload;
          await LiveRuntime.runPromise(
            saveSearchCacheEntry({
              cacheKey,
              normalizedQuery,
              rawQuery: trimmedQuery,
              payload,
              now: payload.meta.createdAt,
              expiresAt: payload.meta.expiresAt,
            }),
          );

          log.info(
            "ExtensionSearchCache",
            `store key=${cacheKey} results=${payload.links.length} partial=${payload.meta.partial} failedCards=${payload.meta.failedCards}`,
          );

          return {
            success: true as const,
            data: toSearchResponsePayload(payload, { cacheHit: false, stale: false }),
          };
        } catch (error) {
          if (stalePayload) {
            await LiveRuntime.runPromise(touchSearchCacheHit(cacheKey, now));
            log.warn(
              "ExtensionSearchCache",
              `stale-fallback key=${cacheKey} query="${trimmedQuery}" results=${stalePayload.links.length}`,
            );
            return {
              success: true as const,
              data: toSearchResponsePayload(stalePayload, {
                cacheHit: true,
                stale: true,
                warning: "served_stale_after_scrape_error",
              }),
            };
          }

          log.error("ExtensionSearchCache", `scrape failed key=${cacheKey}`, error);
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Search scrape failed",
          };
        } finally {
          yandexSearchInflight.delete(cacheKey);
        }
      })();

      yandexSearchInflight.set(cacheKey, leaderPromise);
      const result = await leaderPromise;
      if (!result.success) {
        set.status = 500;
      }
      return result;
    })
    .post("/yandex/search-cache/recent", async ({ body, set }) => {
      const { secret, limit } = (body || {}) as {
        secret?: string;
        limit?: number;
      };

      if (!isValidExtensionSecret(secret)) {
        set.status = 401;
        return { success: false, error: "Invalid extension secret" };
      }

      const safeLimit =
        typeof limit === "number" && Number.isFinite(limit)
          ? Math.max(1, Math.min(SEARCH_LIMIT, Math.floor(limit)))
          : SEARCH_LIMIT;

      const entries = await LiveRuntime.runPromise(getRecentSearchCacheEntries(safeLimit));

      return {
        success: true as const,
        data: {
          entries,
        },
      };
    })
    .post("/yandex/search-cache/invalidate", async ({ body, set }) => {
      const { secret, queryPrefix } = (body || {}) as {
        secret?: string;
        queryPrefix?: string;
      };

      if (!isValidExtensionSecret(secret)) {
        set.status = 401;
        return { success: false, error: "Invalid extension secret" };
      }

      if (!queryPrefix || typeof queryPrefix !== "string") {
        set.status = 400;
        return { success: false, error: "Missing required field: queryPrefix" };
      }

      const normalizedPrefix = normalizeQueryForCache(queryPrefix.trim());
      if (!normalizedPrefix) {
        set.status = 400;
        return { success: false, error: "queryPrefix cannot be empty" };
      }

      const deleted = await LiveRuntime.runPromise(invalidateSearchCacheByPrefix(normalizedPrefix));

      log.info("ExtensionSearchCache", `invalidate prefix="${normalizedPrefix}" deleted=${deleted}`);
      return {
        success: true,
        data: {
          deleted,
          normalizedPrefix,
        },
      };
    })
    .post("/yandex/search-cache/invalidate-all", async ({ body, set }) => {
      const { secret } = (body || {}) as { secret?: string };

      if (!isValidExtensionSecret(secret)) {
        set.status = 401;
        return { success: false, error: "Invalid extension secret" };
      }

      const deleted = await LiveRuntime.runPromise(invalidateSearchCacheAll());
      log.info("ExtensionSearchCache", `invalidate all deleted=${deleted}`);

      return {
        success: true,
        data: { deleted },
      };
    });
