import { Effect, Layer, Context } from "effect";
import { SqlClient } from "@effect/sql";

export interface RawHtmlCacheHit {
  html: string;
  createdAt: number;
  ageSeconds: number;
}

export class HtmlCacheError extends Error {
  readonly _tag = "HtmlCacheError";
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
  ) => Effect.Effect<void, HtmlCacheError>;

  readonly verifyHtml: (
    slug: string,
  ) => Effect.Effect<
    { isCorrupted: boolean; reason: string | null },
    HtmlCacheError
  >;

  readonly getVerificationStatus: (
    slug: string,
  ) => Effect.Effect<
    { isCorrupted: boolean; reason: string | null } | null,
    HtmlCacheError
  >;

  readonly getCorruptedSlugs: () => Effect.Effect<string[], HtmlCacheError>;
  readonly getValidSlugs: () => Effect.Effect<string[], HtmlCacheError>;
}

export const HtmlCacheService =
  Context.GenericTag<HtmlCacheService>("HtmlCacheService");

const wrapError = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, HtmlCacheError> =>
  Effect.mapError(effect, (e) =>
    new HtmlCacheError(e instanceof Error ? e.message : String(e))
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

      recordVerification: (slug: string, isCorrupted: boolean, reason: string | null) =>
        wrapError(
          sql`
            INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
            VALUES (${slug}, ${isCorrupted ? 1 : 0}, unixepoch(), ${reason})
            ON CONFLICT(slug) DO UPDATE SET
              is_corrupted = excluded.is_corrupted,
              verified_at = excluded.verified_at,
              corruption_reason = excluded.corruption_reason
          `.pipe(Effect.asVoid),
        ),

      verifyHtml: (slug: string) =>
        wrapError(
          Effect.gen(function* () {
            const rows = yield* sql<{ html: string }>`
              SELECT html FROM raw_html WHERE slug = ${slug} AND source = 'kimovil'
            `;

            if (!rows[0]?.html) {
              return { isCorrupted: false, reason: null };
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
              INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
              VALUES (${slug}, ${isCorrupted ? 1 : 0}, unixepoch(), ${reason})
              ON CONFLICT(slug) DO UPDATE SET
                is_corrupted = excluded.is_corrupted,
                verified_at = excluded.verified_at,
                corruption_reason = excluded.corruption_reason
            `;

            return { isCorrupted, reason };
          }),
        ),

      getVerificationStatus: (slug: string) =>
        wrapError(
          sql<{ is_corrupted: number; corruption_reason: string | null }>`
            SELECT is_corrupted, corruption_reason FROM scrape_verification WHERE slug = ${slug}
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

      getCorruptedSlugs: () =>
        wrapError(
          sql<{ slug: string }>`
            SELECT slug FROM scrape_verification WHERE is_corrupted = 1
          `.pipe(
            Effect.map((rows) => rows.map((r) => r.slug)),
          ),
        ),

      getValidSlugs: () =>
        wrapError(
          sql<{ slug: string }>`
            SELECT slug FROM scrape_verification WHERE is_corrupted = 0
          `.pipe(
            Effect.map((rows) => rows.map((r) => r.slug)),
          ),
        ),
    });
  }),
);
