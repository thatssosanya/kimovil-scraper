import { Effect, Layer, Context } from "effect";
import { SqlClient } from "@effect/sql";
import { ScrapeRecordService } from "./scrape-record";

export class HtmlCacheError extends Error {
  readonly _tag = "HtmlCacheError";
  cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
  }
}

export interface HtmlCacheService {
  readonly recordVerification: (
    slug: string,
    isCorrupted: boolean,
    reason: string | null,
    source?: string,
  ) => Effect.Effect<void, HtmlCacheError>;

  readonly verifyHtml: (
    slug: string,
    source?: string,
  ) => Effect.Effect<
    { isCorrupted: boolean | null; reason: string | null },
    HtmlCacheError
  >;

  readonly getVerificationStatus: (
    slug: string,
    source?: string,
  ) => Effect.Effect<
    { isCorrupted: boolean; reason: string | null } | null,
    HtmlCacheError
  >;

  readonly getCorruptedSlugs: (source?: string) => Effect.Effect<string[], HtmlCacheError>;
  readonly getValidSlugs: (source?: string) => Effect.Effect<string[], HtmlCacheError>;

  // scrape_id-based methods for multi-source architecture
  readonly saveHtmlByScrapeId: (
    scrapeId: number,
    html: string,
  ) => Effect.Effect<void, HtmlCacheError>;

  readonly getHtmlByScrapeId: (
    scrapeId: number,
  ) => Effect.Effect<string | null, HtmlCacheError>;

  readonly deleteHtmlByScrapeId: (
    scrapeId: number,
  ) => Effect.Effect<void, HtmlCacheError>;

  // Slug-based lookup helpers (use scrapes + scrape_html internally)
  readonly getHtmlBySlug: (
    slug: string,
    source: string,
    dataKind: string,
  ) => Effect.Effect<string | null, HtmlCacheError>;

  readonly getHtmlBySlugWithAge: (
    slug: string,
    source: string,
    dataKind: string,
  ) => Effect.Effect<{ html: string; createdAt: number; ageSeconds: number } | null, HtmlCacheError>;

  readonly getHtmlBySlugIfFresh: (
    slug: string,
    source: string,
    dataKind: string,
    maxAgeSeconds: number,
  ) => Effect.Effect<string | null, HtmlCacheError>;

  readonly hasHtmlForSlug: (
    slug: string,
    source: string,
    dataKind: string,
  ) => Effect.Effect<boolean, HtmlCacheError>;
}

export const HtmlCacheService =
  Context.GenericTag<HtmlCacheService>("HtmlCacheService");

const wrapError = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, HtmlCacheError> =>
  Effect.mapError(effect, (e) =>
    new HtmlCacheError(
      e instanceof Error ? e.message : String(e),
      e instanceof Error ? { cause: e } : undefined,
    )
  );

export const HtmlCacheServiceLive = Layer.effect(
  HtmlCacheService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const scrapeRecord = yield* ScrapeRecordService;

    return HtmlCacheService.of({
      recordVerification: (slug: string, isCorrupted: boolean, reason: string | null, source = "kimovil") =>
        wrapError(
          sql`
            INSERT INTO scrape_verification (slug, source, is_corrupted, verified_at, corruption_reason)
            VALUES (${slug}, ${source}, ${isCorrupted ? 1 : 0}, unixepoch(), ${reason})
            ON CONFLICT(slug, source) DO UPDATE SET
              is_corrupted = excluded.is_corrupted,
              verified_at = excluded.verified_at,
              corruption_reason = excluded.corruption_reason
          `.pipe(Effect.asVoid),
        ),

      verifyHtml: (slug: string, source = "kimovil") =>
        Effect.gen(function* () {
          const scrape = yield* scrapeRecord.getLatestScrape(source, slug, "specs");
          if (!scrape) {
            yield* sql`
              INSERT INTO scrape_verification (slug, source, is_corrupted, verified_at, corruption_reason)
              VALUES (${slug}, ${source}, 0, unixepoch(), 'No HTML found')
              ON CONFLICT(slug, source) DO UPDATE SET
                is_corrupted = 0,
                verified_at = excluded.verified_at,
                corruption_reason = 'No HTML found'
            `;
            return { isCorrupted: null, reason: "No HTML found" };
          }

          const rows = yield* sql<{ html: string }>`
            SELECT html FROM scrape_html WHERE scrape_id = ${scrape.id}
          `;

          if (!rows[0]?.html) {
            yield* sql`
              INSERT INTO scrape_verification (slug, source, is_corrupted, verified_at, corruption_reason)
              VALUES (${slug}, ${source}, 0, unixepoch(), 'No HTML found')
              ON CONFLICT(slug, source) DO UPDATE SET
                is_corrupted = 0,
                verified_at = excluded.verified_at,
                corruption_reason = 'No HTML found'
            `;
            return { isCorrupted: null, reason: "No HTML found" };
          }

          const html = rows[0].html;
          let reason: string | null = null;

          if (html.includes("Enable JavaScript and cookies to continue")) {
            reason = "Bot protection: JavaScript/cookies required";
          } else if (html.includes("Please verify you are a human")) {
            reason = "Bot protection: Human verification required";
          } else if (html.includes("Access denied")) {
            reason = "Bot protection: Access denied";
          } else if (!html.includes("<main")) {
            reason = "Missing main content element";
          } else if (
            !html.includes("k-dltable") &&
            !html.includes("container-sheet")
          ) {
            reason = "Missing expected content structure";
          }

          const isCorrupted = reason !== null;

          yield* sql`
            INSERT INTO scrape_verification (slug, source, is_corrupted, verified_at, corruption_reason)
            VALUES (${slug}, ${source}, ${isCorrupted ? 1 : 0}, unixepoch(), ${reason})
            ON CONFLICT(slug, source) DO UPDATE SET
              is_corrupted = excluded.is_corrupted,
              verified_at = excluded.verified_at,
              corruption_reason = excluded.corruption_reason
          `;

          return { isCorrupted, reason };
        }).pipe(Effect.mapError((e) =>
          new HtmlCacheError(
            e instanceof Error ? e.message : String(e),
            e instanceof Error ? { cause: e } : undefined,
          )
        )),

      getVerificationStatus: (slug: string, source = "kimovil") =>
        wrapError(
          sql<{ is_corrupted: number; corruption_reason: string | null }>`
            SELECT is_corrupted, corruption_reason FROM scrape_verification WHERE slug = ${slug} AND source = ${source}
          `.pipe(
            Effect.map((rows) => {
              const row = rows[0];
              if (!row) return null;
              return {
                isCorrupted: row.is_corrupted === 1,
                reason: row.corruption_reason,
              };
            }),
          ),
        ),

      getCorruptedSlugs: (source = "kimovil") =>
        wrapError(
          sql<{ slug: string }>`
            SELECT slug FROM scrape_verification WHERE is_corrupted = 1 AND source = ${source}
          `.pipe(
            Effect.map((rows) => rows.map((r) => r.slug)),
          ),
        ),

      getValidSlugs: (source = "kimovil") =>
        wrapError(
          sql<{ slug: string }>`
            SELECT slug FROM scrape_verification WHERE is_corrupted = 0 AND source = ${source}
          `.pipe(
            Effect.map((rows) => rows.map((r) => r.slug)),
          ),
        ),

      // scrape_id-based methods
      saveHtmlByScrapeId: (scrapeId: number, html: string) =>
        wrapError(
          sql`
            INSERT INTO scrape_html (scrape_id, html, created_at)
            VALUES (${scrapeId}, ${html}, unixepoch())
            ON CONFLICT(scrape_id) DO UPDATE SET html = excluded.html
          `.pipe(Effect.asVoid),
        ),

      getHtmlByScrapeId: (scrapeId: number) =>
        wrapError(
          sql<{ html: string }>`
            SELECT html FROM scrape_html WHERE scrape_id = ${scrapeId}
          `.pipe(Effect.map((rows) => rows[0]?.html ?? null)),
        ),

      deleteHtmlByScrapeId: (scrapeId: number) =>
        wrapError(
          sql`
            DELETE FROM scrape_html WHERE scrape_id = ${scrapeId}
          `.pipe(Effect.asVoid),
        ),

      // Slug-based lookup helpers
      getHtmlBySlug: (slug: string, source: string, dataKind: string) =>
        Effect.gen(function* () {
          const scrape = yield* scrapeRecord.getLatestScrape(source, slug, dataKind);
          if (!scrape) return null;
          const rows = yield* sql<{ html: string }>`
            SELECT html FROM scrape_html WHERE scrape_id = ${scrape.id}
          `;
          return rows[0]?.html ?? null;
        }).pipe(Effect.mapError((e) =>
          new HtmlCacheError(
            e instanceof Error ? e.message : String(e),
            e instanceof Error ? { cause: e } : undefined,
          )
        )),

      getHtmlBySlugWithAge: (slug: string, source: string, dataKind: string) =>
        Effect.gen(function* () {
          const scrape = yield* scrapeRecord.getLatestScrape(source, slug, dataKind);
          if (!scrape || !scrape.completedAt) return null;
          const rows = yield* sql<{ html: string }>`
            SELECT html FROM scrape_html WHERE scrape_id = ${scrape.id}
          `;
          const html = rows[0]?.html;
          if (!html) return null;
          const ageSeconds = Math.floor(Date.now() / 1000 - scrape.completedAt);
          return { html, createdAt: scrape.completedAt, ageSeconds };
        }).pipe(Effect.mapError((e) =>
          new HtmlCacheError(
            e instanceof Error ? e.message : String(e),
            e instanceof Error ? { cause: e } : undefined,
          )
        )),

      getHtmlBySlugIfFresh: (slug: string, source: string, dataKind: string, maxAgeSeconds: number) =>
        Effect.gen(function* () {
          const scrape = yield* scrapeRecord.getLatestScrape(source, slug, dataKind);
          if (!scrape || !scrape.completedAt) return null;
          const ageSeconds = Math.floor(Date.now() / 1000 - scrape.completedAt);
          if (ageSeconds > maxAgeSeconds) return null;
          const rows = yield* sql<{ html: string }>`
            SELECT html FROM scrape_html WHERE scrape_id = ${scrape.id}
          `;
          return rows[0]?.html ?? null;
        }).pipe(Effect.mapError((e) =>
          new HtmlCacheError(
            e instanceof Error ? e.message : String(e),
            e instanceof Error ? { cause: e } : undefined,
          )
        )),

      hasHtmlForSlug: (slug: string, source: string, dataKind: string) =>
        Effect.gen(function* () {
          const scrape = yield* scrapeRecord.getLatestScrape(source, slug, dataKind);
          if (!scrape) return false;
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM scrape_html WHERE scrape_id = ${scrape.id}
          `;
          return (rows[0]?.count ?? 0) > 0;
        }).pipe(Effect.mapError((e) =>
          new HtmlCacheError(
            e instanceof Error ? e.message : String(e),
            e instanceof Error ? { cause: e } : undefined,
          )
        )),
    });
  }),
);
