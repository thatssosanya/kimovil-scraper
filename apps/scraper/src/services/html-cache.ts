import { Effect, Layer, Context } from "effect";
import { SqlClient } from "@effect/sql";

export interface RawHtmlCacheHit {
  html: string;
  createdAt: number;
  ageSeconds: number;
}

export class HtmlCacheError extends Error {
  readonly _tag = "HtmlCacheError";
  cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
  }
}

export interface HtmlCacheService {
  readonly saveRawHtml: (
    slug: string,
    html: string,
    source?: string,
  ) => Effect.Effect<void, HtmlCacheError>;

  readonly getRawHtml: (
    slug: string,
    source?: string,
  ) => Effect.Effect<string | null, HtmlCacheError>;

  readonly getRawHtmlIfFresh: (
    slug: string,
    maxAgeSeconds: number,
    source?: string,
  ) => Effect.Effect<RawHtmlCacheHit | null, HtmlCacheError>;

  readonly getRawHtmlWithAge: (
    slug: string,
    source?: string,
  ) => Effect.Effect<RawHtmlCacheHit | null, HtmlCacheError>;

  readonly hasScrapedHtml: (
    slug: string,
    source?: string,
  ) => Effect.Effect<boolean, HtmlCacheError>;

  readonly getScrapedSlugs: (
    source?: string,
  ) => Effect.Effect<string[], HtmlCacheError>;

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

    return HtmlCacheService.of({
      saveRawHtml: (slug: string, html: string, source = "kimovil") =>
        wrapError(
          sql`
            INSERT OR REPLACE INTO raw_html (slug, source, html, created_at)
            VALUES (${slug}, ${source}, ${html}, unixepoch())
          `.pipe(
            Effect.tap(() =>
              Effect.logDebug(`[HtmlCache] Saved raw HTML for slug: ${slug} (source: ${source})`)
            ),
            Effect.asVoid,
          ),
        ),

      getRawHtml: (slug: string, source = "kimovil") =>
        wrapError(
          sql<{ html: string }>`
            SELECT html FROM raw_html WHERE slug = ${slug} AND source = ${source}
          `.pipe(
            Effect.map((rows) => rows[0]?.html ?? null),
          ),
        ),

      getRawHtmlIfFresh: (slug: string, maxAgeSeconds: number, source = "kimovil") =>
        wrapError(
          Effect.gen(function* () {
            const now = Math.floor(Date.now() / 1000);
            const rows = yield* sql<{ html: string; created_at: number }>`
              SELECT html, created_at FROM raw_html WHERE slug = ${slug} AND source = ${source}
            `;
            const row = rows[0];
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            if (ageSeconds > maxAgeSeconds) return null;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          }),
        ),

      getRawHtmlWithAge: (slug: string, source = "kimovil") =>
        wrapError(
          Effect.gen(function* () {
            const now = Math.floor(Date.now() / 1000);
            const rows = yield* sql<{ html: string; created_at: number }>`
              SELECT html, created_at FROM raw_html WHERE slug = ${slug} AND source = ${source}
            `;
            const row = rows[0];
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          }),
        ),

      hasScrapedHtml: (slug: string, source = "kimovil") =>
        wrapError(
          sql<{ count: number }>`
            SELECT COUNT(*) as count FROM raw_html WHERE slug = ${slug} AND source = ${source}
          `.pipe(
            Effect.map((rows) => (rows[0]?.count ?? 0) > 0),
          ),
        ),

      getScrapedSlugs: (source = "kimovil") =>
        wrapError(
          sql<{ slug: string }>`
            SELECT slug FROM raw_html WHERE source = ${source}
          `.pipe(
            Effect.map((rows) => rows.map((r) => r.slug)),
          ),
        ),

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
        wrapError(
          Effect.gen(function* () {
            const rows = yield* sql<{ html: string }>`
              SELECT html FROM raw_html WHERE slug = ${slug} AND source = ${source}
            `;

            if (!rows[0]?.html) {
              // No HTML found - record as missing and return null for isCorrupted
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
          }),
        ),

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
    });
  }),
);
