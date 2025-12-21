import { Effect, Layer, Context } from "effect";
import { DatabaseService } from "./db";

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

export const HtmlCacheServiceLive = Layer.effect(
  HtmlCacheService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;

    return HtmlCacheService.of({
      saveRawHtml: (slug: string, html: string, source = "kimovil") =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT OR REPLACE INTO raw_html (slug, source, html, created_at) VALUES (?, ?, ?, unixepoch())`,
            ).run(slug, source, html);
            console.log(
              `[HtmlCache] Saved raw HTML for slug: ${slug} (source: ${source})`,
            );
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to save raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtml: (slug: string, source = "kimovil") =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT html FROM raw_html WHERE slug = ? AND source = ?`,
              )
              .get(slug, source) as { html: string } | undefined;
            return row?.html ?? null;
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtmlIfFresh: (
        slug: string,
        maxAgeSeconds: number,
        source = "kimovil",
      ) =>
        Effect.try({
          try: () => {
            const now = Math.floor(Date.now() / 1000);
            const row = db
              .prepare(
                `SELECT html, created_at FROM raw_html WHERE slug = ? AND source = ?`,
              )
              .get(slug, source) as
              | { html: string; created_at: number }
              | undefined;
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            if (ageSeconds > maxAgeSeconds) return null;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get fresh raw HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawHtmlWithAge: (slug: string, source = "kimovil") =>
        Effect.try({
          try: () => {
            const now = Math.floor(Date.now() / 1000);
            const row = db
              .prepare(
                `SELECT html, created_at FROM raw_html WHERE slug = ? AND source = ?`,
              )
              .get(slug, source) as
              | { html: string; created_at: number }
              | undefined;
            if (!row) return null;
            const ageSeconds = now - row.created_at;
            return { html: row.html, createdAt: row.created_at, ageSeconds };
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get raw HTML with age: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      hasScrapedHtml: (slug: string, source = "kimovil") =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT COUNT(*) as count FROM raw_html WHERE slug = ? AND source = ?`,
              )
              .get(slug, source) as { count: number } | undefined;
            return (row?.count ?? 0) > 0;
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to check scraped HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getScrapedSlugs: (source = "kimovil") =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(`SELECT slug FROM raw_html WHERE source = ?`)
              .all(source) as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get scraped slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      recordVerification: (
        slug: string,
        isCorrupted: boolean,
        reason: string | null,
      ) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
            ).run(slug, isCorrupted ? 1 : 0, reason);
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to record verification: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      verifyHtml: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT html FROM raw_html WHERE slug = ? AND source = 'kimovil'`,
              )
              .get(slug) as { html: string } | undefined;

            if (!row?.html) {
              return { isCorrupted: false, reason: null };
            }

            const html = row.html;
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

            db.prepare(
              `INSERT INTO scrape_verification (slug, is_corrupted, verified_at, corruption_reason)
               VALUES (?, ?, unixepoch(), ?)
               ON CONFLICT(slug) DO UPDATE SET
                 is_corrupted = excluded.is_corrupted,
                 verified_at = excluded.verified_at,
                 corruption_reason = excluded.corruption_reason`,
            ).run(slug, isCorrupted ? 1 : 0, reason);

            return { isCorrupted, reason };
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to verify HTML: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getVerificationStatus: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(
                `SELECT is_corrupted, corruption_reason FROM scrape_verification WHERE slug = ?`,
              )
              .get(slug) as
              | { is_corrupted: number; corruption_reason: string | null }
              | undefined;

            if (!row) return null;

            return {
              isCorrupted: row.is_corrupted === 1,
              reason: row.corruption_reason,
            };
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get verification status: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getCorruptedSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT slug FROM scrape_verification WHERE is_corrupted = 1`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get corrupted slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getValidSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT slug FROM scrape_verification WHERE is_corrupted = 0`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new HtmlCacheError(
              `Failed to get valid slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),
    });
  }),
);
