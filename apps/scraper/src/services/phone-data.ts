import { Effect, Layer, Context } from "effect";
import { DatabaseService } from "./db";

export class PhoneDataError extends Error {
  readonly _tag = "PhoneDataError";
}

export interface PhoneDataService {
  readonly saveRaw: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;

  readonly getRaw: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;

  readonly hasRaw: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly getRawCount: () => Effect.Effect<number, PhoneDataError>;

  readonly getRawBulk: (
    slugs: string[],
  ) => Effect.Effect<
    Array<{ slug: string; data: Record<string, unknown> }>,
    PhoneDataError
  >;

  readonly save: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;

  readonly get: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;

  readonly has: (slug: string) => Effect.Effect<boolean, PhoneDataError>;

  readonly getCount: () => Effect.Effect<number, PhoneDataError>;

  readonly getSlugsNeedingExtraction: () => Effect.Effect<
    string[],
    PhoneDataError
  >;

  readonly getSlugsNeedingAi: () => Effect.Effect<string[], PhoneDataError>;

  readonly getRawDataSlugs: () => Effect.Effect<string[], PhoneDataError>;

  readonly getAiDataSlugs: () => Effect.Effect<string[], PhoneDataError>;
}

export const PhoneDataService =
  Context.GenericTag<PhoneDataService>("PhoneDataService");

export const PhoneDataServiceLive = Layer.effect(
  PhoneDataService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;

    return PhoneDataService.of({
      saveRaw: (slug: string, data: Record<string, unknown>) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO phone_data_raw (slug, data, created_at, updated_at)
               VALUES (?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 data = excluded.data,
                 updated_at = unixepoch()`,
            ).run(slug, JSON.stringify(data));
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to save raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRaw: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT data FROM phone_data_raw WHERE slug = ?`)
              .get(slug) as { data: string } | undefined;
            if (!row) return null;
            return JSON.parse(row.data) as Record<string, unknown>;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      hasRaw: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT 1 FROM phone_data_raw WHERE slug = ? LIMIT 1`)
              .get(slug);
            return row !== undefined;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to check raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM phone_data_raw`)
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get raw phone data count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawBulk: (slugs: string[]) =>
        Effect.try({
          try: () => {
            if (slugs.length === 0) return [];
            const placeholders = slugs.map(() => "?").join(",");
            const rows = db
              .prepare(
                `SELECT slug, data FROM phone_data_raw WHERE slug IN (${placeholders})`,
              )
              .all(...slugs) as { slug: string; data: string }[];
            return rows.map((r) => ({
              slug: r.slug,
              data: JSON.parse(r.data) as Record<string, unknown>,
            }));
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get bulk raw phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      save: (slug: string, data: Record<string, unknown>) =>
        Effect.try({
          try: () => {
            db.prepare(
              `INSERT INTO phone_data (slug, data, created_at, updated_at)
               VALUES (?, ?, unixepoch(), unixepoch())
               ON CONFLICT(slug) DO UPDATE SET
                 data = excluded.data,
                 updated_at = unixepoch()`,
            ).run(slug, JSON.stringify(data));
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to save phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      get: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT data FROM phone_data WHERE slug = ?`)
              .get(slug) as { data: string } | undefined;
            if (!row) return null;
            return JSON.parse(row.data) as Record<string, unknown>;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      has: (slug: string) =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT 1 FROM phone_data WHERE slug = ? LIMIT 1`)
              .get(slug);
            return row !== undefined;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to check phone data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getCount: () =>
        Effect.try({
          try: () => {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM phone_data`)
              .get() as { count: number } | undefined;
            return row?.count ?? 0;
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get phone data count: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getSlugsNeedingExtraction: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT r.slug FROM raw_html r
                 LEFT JOIN phone_data_raw p ON r.slug = p.slug
                 WHERE p.slug IS NULL`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get slugs needing extraction: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getSlugsNeedingAi: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(
                `SELECT r.slug FROM phone_data_raw r
                 LEFT JOIN phone_data p ON r.slug = p.slug
                 WHERE p.slug IS NULL`,
              )
              .all() as { slug: string }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get slugs needing AI: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getRawDataSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db
              .prepare(`SELECT slug FROM phone_data_raw`)
              .all() as {
              slug: string;
            }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get raw data slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),

      getAiDataSlugs: () =>
        Effect.try({
          try: () => {
            const rows = db.prepare(`SELECT slug FROM phone_data`).all() as {
              slug: string;
            }[];
            return rows.map((r) => r.slug);
          },
          catch: (error) =>
            new PhoneDataError(
              `Failed to get AI data slugs: ${error instanceof Error ? error.message : String(error)}`,
            ),
        }),
    });
  }),
);
