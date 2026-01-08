import { Effect, Layer, Context, Data } from "effect";
import { SqlClient } from "@effect/sql";
import {
  CatalogueSqlClient,
  CatalogueSqlError,
} from "../sql/catalogue.js";
import {
  LinkResolverService,
  type ResolvedLink,
} from "./link-resolver.js";

export class CatalogueLinkError extends Data.TaggedError("CatalogueLinkError")<{
  type: "NotFound" | "Unavailable" | "Unexpected";
  message: string;
  cause?: unknown;
}> {}

export interface CatalogueLinksResult {
  slug: string;
  catalogueDeviceId: string | null;
  links: ResolvedLink[];
}

interface CatalogueDeviceRow {
  deviceId: string;
  name: string;
}

interface CatalogueLinkRow {
  url: string;
}

interface CachedLinkRow {
  slug: string;
  original_url: string;
  resolved_url: string | null;
  is_yandex_market: number;
  external_id: string | null;
  error: string | null;
  resolved_at: number;
}

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface CatalogueLinkService {
  readonly getLinksBySlug: (
    slug: string,
  ) => Effect.Effect<CatalogueLinksResult, CatalogueLinkError>;
}

export const CatalogueLinkService =
  Context.GenericTag<CatalogueLinkService>("CatalogueLinkService");

const mapCatalogueSqlError = (error: CatalogueSqlError): CatalogueLinkError =>
  new CatalogueLinkError({
    type: "Unavailable",
    message: error.message,
    cause: error,
  });

export const CatalogueLinkServiceLive = Layer.effect(
  CatalogueLinkService,
  Effect.gen(function* () {
    const catalogueSql = yield* CatalogueSqlClient;
    const localSql = yield* SqlClient.SqlClient;
    const resolver = yield* LinkResolverService;

    const getCachedLink = (
      slug: string,
      url: string,
    ): Effect.Effect<ResolvedLink | null, never> =>
      Effect.gen(function* () {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const cutoff = nowSeconds - CACHE_TTL_SECONDS;

        const rows = yield* localSql<CachedLinkRow>`
          SELECT * FROM catalogue_link_cache
          WHERE slug = ${slug} AND original_url = ${url}
          AND resolved_at > ${cutoff}
        `.pipe(
          Effect.catchAll((error) =>
            Effect.logWarning("Cache lookup failed").pipe(
              Effect.annotateLogs({ slug, url, error }),
              Effect.map(() => [] as CachedLinkRow[]),
            ),
          ),
        );

        const row = rows[0];
        if (!row) return null;

        return {
          originalUrl: row.original_url,
          resolvedUrl: row.resolved_url,
          isYandexMarket: row.is_yandex_market === 1,
          externalId: row.external_id,
          error: row.error ?? undefined,
        };
      });

    const saveCachedLink = (
      slug: string,
      link: ResolvedLink,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const nowSeconds = Math.floor(Date.now() / 1000);

        yield* localSql`
          INSERT INTO catalogue_link_cache (slug, original_url, resolved_url, is_yandex_market, external_id, error, resolved_at)
          VALUES (${slug}, ${link.originalUrl}, ${link.resolvedUrl}, ${link.isYandexMarket ? 1 : 0}, ${link.externalId}, ${link.error ?? null}, ${nowSeconds})
          ON CONFLICT(slug, original_url) DO UPDATE SET
            resolved_url = excluded.resolved_url,
            is_yandex_market = excluded.is_yandex_market,
            external_id = excluded.external_id,
            error = excluded.error,
            resolved_at = excluded.resolved_at
        `.pipe(
          Effect.catchAll((error) =>
            Effect.logWarning("Cache save failed").pipe(
              Effect.annotateLogs({ slug, url: link.originalUrl, error }),
            ),
          ),
        );
      });

    const resolveLink = (
      slug: string,
      url: string,
    ): Effect.Effect<ResolvedLink, never> =>
      Effect.gen(function* () {
        const cached = yield* getCachedLink(slug, url);
        if (cached) {
          return cached;
        }

        const resolved = yield* resolver.resolve(url).pipe(
          Effect.catchAll((error) =>
            Effect.succeed({
              originalUrl: url,
              resolvedUrl: null,
              isYandexMarket: false,
              externalId: null,
              error: error.message,
            } satisfies ResolvedLink),
          ),
        );

        yield* saveCachedLink(slug, resolved);

        return resolved;
      });

    return CatalogueLinkService.of({
      getLinksBySlug: (slug: string) =>
        Effect.gen(function* () {
          const deviceRows = yield* catalogueSql
            .executeRaw<CatalogueDeviceRow>(
              `SELECT dc.deviceId, d.name 
               FROM DeviceCharacteristics dc
               JOIN Device d ON dc.deviceId = d.id
               WHERE dc.slug = ?`,
              [slug],
            )
            .pipe(Effect.mapError(mapCatalogueSqlError));

          const device = deviceRows[0];
          if (!device) {
            return yield* Effect.fail(
              new CatalogueLinkError({
                type: "NotFound",
                message: `Device not found for slug: ${slug}`,
              }),
            );
          }

          const linkRows = yield* catalogueSql
            .executeRaw<CatalogueLinkRow>(
              `SELECT l.url FROM Link l 
               WHERE l.deviceId = ? 
               AND (l.url LIKE '%kik.cat%' OR l.url LIKE '%ya.cc%' OR l.url LIKE '%market.yandex%')`,
              [device.deviceId],
            )
            .pipe(Effect.mapError(mapCatalogueSqlError));

          const links = yield* Effect.all(
            linkRows.map((row) => resolveLink(slug, row.url)),
            { concurrency: 3 },
          );

          return {
            slug,
            catalogueDeviceId: device.deviceId,
            links,
          };
        }),
    });
  }),
);
