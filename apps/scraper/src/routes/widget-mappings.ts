import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { LiveRuntime } from "../layers/live";
import { WidgetMappingService, type MappingStatus, WidgetMappingError } from "../services/widget-mapping";
import { CatalogueLinkService, CatalogueLinkError } from "../services/catalogue-link";
import { DeviceRegistryService } from "../services/device-registry";
import { PriceService } from "../services/price";
import { PriceRuClient } from "../sources/price_ru/client";
import { EntityDataService } from "../services/entity-data";
import { BrowserService } from "../services/browser";
import { HtmlCacheService } from "../services/html-cache";
import { WidgetService } from "../services/widget";
import { parseYandexPrices } from "../sources/yandex_market/extractor";
import { validateYandexMarketUrl, ALLOWED_HOSTS } from "../sources/yandex_market/url-utils";
import { YandexBrowserError } from "../sources/yandex_market/errors";
import { YandexAffiliateService } from "../services/yandex-affiliate";
import { extractVariantKey } from "../sources/price_ru/variant-utils";
import { LinkResolverService } from "../services/link-resolver";

const SHORTENER_HOSTS = ["kik.cat", "ya.cc", "clck.ru"];

const VALID_STATUSES = ["pending", "suggested", "auto_confirmed", "confirmed", "ignored", "needs_review"] as const;
const MAX_LIMIT = 1000;
type ValidStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string | undefined): s is ValidStatus {
  return s !== undefined && VALID_STATUSES.includes(s as ValidStatus);
}

function parseIntSafe(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const createWidgetMappingsRoutes = () =>
  new Elysia({ prefix: "/api/widget-mappings" })
    .get(
      "/",
      async ({ query }) => {
        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.listMappings({
            status: isValidStatus(query.status) ? (query.status as MappingStatus | "needs_review") : undefined,
            limit: Math.min(parseIntSafe(query.limit, 50), MAX_LIMIT),
            offset: parseIntSafe(query.offset, 0),
            seenAfter: query.seenAfter ? parseIntSafe(query.seenAfter, 0) : undefined,
            seenBefore: query.seenBefore ? parseIntSafe(query.seenBefore, 0) : undefined,
          });
        });
        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
          seenAfter: t.Optional(t.String()),
          seenBefore: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/devices/search",
      async ({ query }) => {
        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.searchDevices(query.q || "", Math.min(parseIntSafe(query.limit, 20), MAX_LIMIT));
        });
        return await LiveRuntime.runPromise(program);
      },
      {
        query: t.Object({
          q: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    )
    .get("/by-id/:id", async ({ params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: "Invalid id" };
      }

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql<{
          id: number;
          source: string;
          raw_model: string;
          normalized_model: string | null;
          device_id: string | null;
          device_slug: string | null;
          confidence: number | null;
          status: string;
          usage_count: number;
          first_seen_at: number | null;
          last_seen_at: number | null;
          created_at: number;
          updated_at: number;
        }>`
          SELECT wm.*, d.slug as device_slug 
          FROM widget_model_mappings wm
          LEFT JOIN devices d ON wm.device_id = d.id
          WHERE wm.id = ${id}
        `;

        if (rows.length === 0) {
          return null;
        }

        const row = rows[0];
        return {
          id: row.id,
          source: row.source,
          rawModel: row.raw_model,
          normalizedModel: row.normalized_model,
          deviceId: row.device_id,
          deviceSlug: row.device_slug,
          confidence: row.confidence,
          status: row.status as MappingStatus,
          usageCount: row.usage_count,
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result) {
        set.status = 404;
        return { error: "Mapping not found" };
      }
      return result;
    })
    .get("/by-raw-model", async ({ query, set }) => {
      const rawModel = query.raw_model;
      const source = query.source ?? "wordpress";
      
      if (!rawModel) {
        set.status = 400;
        return { error: "raw_model parameter required" };
      }

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql<{
          id: number;
          source: string;
          raw_model: string;
          normalized_model: string | null;
          device_id: string | null;
          device_slug: string | null;
          confidence: number | null;
          status: string;
          usage_count: number;
          first_seen_at: number | null;
          last_seen_at: number | null;
          created_at: number;
          updated_at: number;
        }>`
          SELECT wm.*, d.slug as device_slug 
          FROM widget_model_mappings wm
          LEFT JOIN devices d ON wm.device_id = d.id
          WHERE wm.source = ${source} AND wm.raw_model = ${rawModel}
        `;

        if (rows.length === 0) {
          return null;
        }

        const row = rows[0];
        return {
          id: row.id,
          source: row.source,
          rawModel: row.raw_model,
          normalizedModel: row.normalized_model,
          deviceId: row.device_id,
          deviceSlug: row.device_slug,
          confidence: row.confidence,
          status: row.status as MappingStatus,
          usageCount: row.usage_count,
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result) {
        set.status = 404;
        return { error: "Mapping not found" };
      }
      return result;
    }, {
      query: t.Object({
        raw_model: t.Optional(t.String()),
        source: t.Optional(t.String()),
      }),
    })
    .get("/:rawModel", async ({ params }) => {
      const rawModel = decodeURIComponent(params.rawModel);
      const program = Effect.gen(function* () {
        const service = yield* WidgetMappingService;
        return yield* service.getMapping(rawModel);
      });
      return await LiveRuntime.runPromise(program);
    })
    .put(
      "/:rawModel",
      async ({ params, body, set }) => {
        const rawModel = decodeURIComponent(params.rawModel);
        
        // Validate status if provided
        if (body.status !== undefined && !["pending", "suggested", "auto_confirmed", "confirmed", "ignored"].includes(body.status)) {
          set.status = 400;
          return { error: `Invalid status: ${body.status}` };
        }
        
        const update: { deviceId?: string | null; status?: MappingStatus } = {};
        if (body.deviceId !== undefined) update.deviceId = body.deviceId;
        if (body.status !== undefined) update.status = body.status as MappingStatus;

        // Validate deviceId exists if provided and non-null
        if (body.deviceId !== undefined && body.deviceId !== null) {
          const checkProgram = Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const rows = yield* sql<{ id: string }>`SELECT id FROM devices WHERE id = ${body.deviceId}`;
            return rows.length > 0;
          });
          const exists = await LiveRuntime.runPromise(checkProgram);
          if (!exists) {
            set.status = 400;
            return { error: `Device not found: ${body.deviceId}` };
          }
        }

        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.updateMapping(rawModel, update);
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          if (err instanceof WidgetMappingError && err.message.includes("not found")) {
            set.status = 404;
            return { error: err.message };
          }
          set.status = 500;
          return { error: err instanceof Error ? err.message : "Internal error" };
        }
      },
      {
        body: t.Object({
          deviceId: t.Optional(t.Union([t.String(), t.Null()])),
          status: t.Optional(t.String()),
        }),
      },
    )
    .post("/sync", async () => {
      const program = Effect.gen(function* () {
        const service = yield* WidgetMappingService;
        return yield* service.syncMappings();
      });
      return await LiveRuntime.runPromise(program);
    })
    .post(
      "/devices",
      async ({ body, set }) => {
        const program = Effect.gen(function* () {
          const service = yield* WidgetMappingService;
          return yield* service.createDevice({
            slug: body.slug,
            name: body.name,
            brand: body.brand ?? null,
          });
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          if (err instanceof WidgetMappingError && err.message.includes("already exists")) {
            set.status = 409;
            return { error: err.message };
          }
          set.status = 500;
          return { error: err instanceof Error ? err.message : "Internal error" };
        }
      },
      {
        body: t.Object({
          slug: t.String(),
          name: t.String(),
          brand: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      },
    )
    // Price scraping endpoints
    .post(
      "/scrape/price-ru/:deviceId",
      async ({ params, set }) => {
        const program = Effect.gen(function* () {
          const registry = yield* DeviceRegistryService;
          const client = yield* PriceRuClient;
          const priceService = yield* PriceService;
          const entityData = yield* EntityDataService;

          const device = yield* registry.getDeviceById(params.deviceId);
          if (!device) {
            return { success: false, error: "Device not found" };
          }

          const searchQuery = device.name;
          const search = yield* client.searchOffers(searchQuery, 20).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("price.ru search failed").pipe(
                  Effect.annotateLogs({ deviceId: device.id, error: error.message }),
                );
                return { items: [], total: 0 };
              }),
            ),
          );

          if (search.items.length === 0) {
            return {
              success: true,
              offerCount: 0,
              savedCount: 0,
              message: `No offers found for "${searchQuery}"`,
            };
          }

          // Save raw data
          yield* entityData.saveRawData({
            deviceId: device.id,
            source: "price_ru",
            dataKind: "prices",
            data: { query: searchQuery, search, fetchedAt: Date.now() },
          });

          // Group by modelId
          const offersByModel = new Map<number, typeof search.items[number][]>();
          for (const offer of search.items) {
            const key = offer.modelId ?? 0;
            const arr = offersByModel.get(key);
            if (arr) arr.push(offer);
            else offersByModel.set(key, [offer]);
          }

          const anchorExternalId = `device:${device.id}`;
          let savedCount = 0;

          for (const [modelId, offers] of offersByModel) {
            const externalId = modelId > 0 ? String(modelId) : anchorExternalId;
            const groupName = modelId > 0 ? offers[0]?.name : undefined;
            const count = yield* priceService.savePriceQuotes({
              deviceId: device.id,
              source: "price_ru",
              externalId,
              offers: offers.map((o) => ({
                seller: o.shopName,
                priceMinorUnits: Math.round(o.price * 100),
                currency: "RUB",
                isAvailable: o.availability !== "out_of_stock" && o.availability !== "not_available",
                variantKey: extractVariantKey(o.name) ?? undefined,
                variantLabel: modelId > 0 ? groupName : o.name,
                url: o.clickUrl ?? undefined,
                offerId: String(o.id),
              })),
            });
            savedCount += count;
          }

          yield* priceService.updatePriceSummary(device.id);

          // Link device to price_ru source
          yield* registry.linkDeviceToSource({
            deviceId: device.id,
            source: "price_ru",
            externalId: anchorExternalId,
          });

          // Invalidate widget cache
          const widgetService = yield* WidgetService;
          yield* widgetService.invalidateSlug(device.slug);

          return {
            success: true,
            offerCount: search.items.length,
            savedCount,
            minPrice: Math.min(...search.items.map((o) => o.price)),
            maxPrice: Math.max(...search.items.map((o) => o.price)),
          };
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          set.status = 500;
          return { success: false, error: err instanceof Error ? err.message : "Internal error" };
        }
      },
    )
    .post(
      "/scrape/yandex/:deviceId",
      async ({ params, body, set }) => {
        const url = body.url as string;
        if (!url) {
          set.status = 400;
          return { success: false, error: "url is required" };
        }

        let parsedHost: string;
        try {
          parsedHost = new URL(url).hostname;
        } catch {
          set.status = 400;
          return { success: false, error: "Invalid URL format" };
        }

        const isShortenerUrl = SHORTENER_HOSTS.includes(parsedHost);
        const validation = validateYandexMarketUrl(url);

        if (!validation.valid && !isShortenerUrl) {
          set.status = 400;
          return { success: false, error: validation.error };
        }

        const program = Effect.gen(function* () {
          const registry = yield* DeviceRegistryService;
          const browserService = yield* BrowserService;
          const priceService = yield* PriceService;
          const entityData = yield* EntityDataService;

          const device = yield* registry.getDeviceById(params.deviceId);
          if (!device) {
            return { success: false, error: "Device not found" };
          }

          let externalId: string;
          let cleanUrl: string;

          if (isShortenerUrl) {
            const resolver = yield* LinkResolverService;
            const resolved = yield* resolver.resolve(url);

            if (!resolved.isYandexMarket || !resolved.resolvedUrl || !resolved.externalId) {
              return {
                success: false,
                error: resolved.error ?? "Shortener link did not resolve to a valid Yandex Market URL",
              };
            }

            externalId = resolved.externalId;
            cleanUrl = resolved.resolvedUrl;
          } else if (validation.valid) {
            externalId = validation.externalId;
            cleanUrl = validation.cleanUrl;
          } else {
            return { success: false, error: validation.error };
          }

          // Scrape with browser
          const html = yield* browserService.withPersistentStealthPage((page) =>
            Effect.gen(function* () {
              yield* Effect.tryPromise({
                try: () => page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 60000 }),
                catch: (cause) => new YandexBrowserError({ message: "Failed to navigate", url: cleanUrl, cause }),
              });

              const finalUrl = page.url();
              const finalParsed = new URL(finalUrl);
              if (!ALLOWED_HOSTS.includes(finalParsed.hostname)) {
                return yield* Effect.fail(new YandexBrowserError({
                  message: `Redirected to disallowed host: ${finalParsed.hostname}`,
                  url: cleanUrl,
                }));
              }

              yield* Effect.promise(() => page.waitForTimeout(3000));
              return yield* Effect.tryPromise({
                try: () => page.content(),
                catch: (cause) => new YandexBrowserError({ message: "Failed to get content", url: cleanUrl, cause }),
              });
            }),
          );

          const offers = parseYandexPrices(html);

          if (offers.length === 0) {
            return { success: true, offerCount: 0, savedCount: 0, message: "No prices found on page" };
          }

          // Link device to yandex_market
          yield* registry.linkDeviceToSource({
            deviceId: device.id,
            source: "yandex_market",
            externalId,
            url,
          });

          // Save raw data
          yield* entityData.saveRawData({
            deviceId: device.id,
            source: "yandex_market",
            dataKind: "prices",
            data: { offers, extractedAt: Date.now() },
          });

          // Save price quotes
          const savedCount = yield* priceService.savePriceQuotes({
            deviceId: device.id,
            source: "yandex_market",
            externalId,
            offers: offers.map((o) => ({
              seller: o.sellerName,
              sellerId: o.sellerId,
              priceMinorUnits: o.priceMinorUnits,
              currency: o.currency,
              variantKey: o.variantKey,
              variantLabel: o.variantLabel,
              url: o.url,
              isAvailable: o.isAvailable,
              offerId: o.offerId,
            })),
          });

          yield* priceService.updatePriceSummary(device.id);

          // Generate affiliate links (best-effort)
          yield* Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const affiliateService = yield* YandexAffiliateService;

            // Check for existing ERID (never auto-create)
            const erid = yield* affiliateService.getErid(device.id).pipe(
              Effect.catchAll(() => Effect.succeed(null)),
            );

            // Create affiliate links for each offer with valid Yandex URL
            const offersWithUrls = offers.filter((o) => {
              if (!o.url) return false;
              try {
                const u = new URL(o.url);
                return ALLOWED_HOSTS.includes(u.hostname);
              } catch {
                return false;
              }
            });
            for (const offer of offersWithUrls) {
              yield* Effect.gen(function* () {
                let affiliateUrl: string;

                if (erid) {
                  // Use full API with ERID
                  affiliateUrl = yield* affiliateService.createAffiliateLinkWithErid({
                    url: offer.url!,
                    erid,
                  });
                } else {
                  // Fallback to CLID-only URL (no API call)
                  affiliateUrl = yield* affiliateService.buildBasicAffiliateUrl(offer.url!);
                }

                yield* sql`
                  UPDATE price_quotes 
                  SET affiliate_url = ${affiliateUrl}, 
                      affiliate_url_created_at = CURRENT_TIMESTAMP, 
                      affiliate_error = NULL
                  WHERE device_id = ${device.id} 
                    AND source = 'yandex_market' 
                    AND url = ${offer.url}
                `.pipe(Effect.asVoid);
              }).pipe(
                Effect.catchAll((error) =>
                  sql`
                    UPDATE price_quotes 
                    SET affiliate_error = ${error instanceof Error ? error.message : String(error)}
                    WHERE device_id = ${device.id} 
                      AND source = 'yandex_market' 
                      AND url = ${offer.url}
                  `.pipe(
                    Effect.asVoid,
                    Effect.catchAll(() => Effect.void),
                  ),
                ),
              );
            }
          }).pipe(
            Effect.catchAll((error) =>
              Effect.logWarning("Affiliate link generation failed").pipe(
                Effect.annotateLogs({ deviceId: device.id, error }),
              ),
            ),
          );

          // Invalidate widget cache
          const widgetService = yield* WidgetService;
          yield* widgetService.invalidateSlug(device.slug);

          const prices = offers.map((o) => o.priceMinorUnits / 100);
          return {
            success: true,
            offerCount: offers.length,
            savedCount,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
          };
        });

        try {
          return await LiveRuntime.runPromise(program);
        } catch (err) {
          set.status = 500;
          return { success: false, error: err instanceof Error ? err.message : "Internal error" };
        }
      },
      {
        body: t.Object({
          url: t.String(),
        }),
      },
    )
    .get("/catalogue-links/:slug", async ({ params, set }) => {
      const program = Effect.gen(function* () {
        const service = yield* CatalogueLinkService;
        return yield* service.getLinksBySlug(params.slug);
      });

      try {
        return await LiveRuntime.runPromise(program);
      } catch (err) {
        if (err instanceof CatalogueLinkError) {
          if (err.type === "NotFound") {
            set.status = 404;
            return { error: err.message };
          }
          if (err.type === "Unavailable") {
            set.status = 503;
            return { error: "Catalogue database unavailable", warning: err.message };
          }
        }
        set.status = 500;
        return { error: err instanceof Error ? err.message : "Internal error" };
      }
    })
    .get("/prices/:deviceId", async ({ params, set }) => {
      const program = Effect.gen(function* () {
        const registry = yield* DeviceRegistryService;
        const priceService = yield* PriceService;

        const device = yield* registry.getDeviceById(params.deviceId);
        if (!device) {
          return null;
        }

        const prices = yield* priceService.getCurrentPrices(device.id);
        const quotes = yield* priceService.getAllQuotes({ deviceId: device.id, limit: 100 });

        // Get linked sources
        const sql = yield* SqlClient.SqlClient;
        const sources = yield* sql<{ source: string; external_id: string; url: string | null }>`
          SELECT source, external_id, url FROM device_sources
          WHERE device_id = ${device.id} AND source IN ('price_ru', 'yandex_market') AND status = 'active'
        `;

        return {
          deviceId: device.id,
          deviceName: device.name,
          summary: prices,
          quotes,
          linkedSources: sources.map((s) => ({
            source: s.source,
            externalId: s.external_id,
            url: s.url,
          })),
        };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result) {
        set.status = 404;
        return { error: "Device not found" };
      }
      return result;
    })
    .get(
      "/posts/by-ids",
      async ({ query, set }) => {
        const idsParam = query.ids;
        if (!idsParam) {
          set.status = 400;
          return { error: "ids parameter required" };
        }
        
        const ids = idsParam.split(",").map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n > 0);
        if (ids.length === 0) {
          return { posts: [] };
        }
        if (ids.length > 100) {
          set.status = 400;
          return { error: "Maximum 100 ids allowed" };
        }

        const program = Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const placeholders = ids.map(() => "?").join(",");
          const rows = yield* sql.unsafe<{ post_id: number; title: string; slug: string }>(
            `SELECT post_id, title, slug FROM wp_posts_cache WHERE post_id IN (${placeholders})`,
            ids
          );
          return rows.map((r) => ({
            postId: r.post_id,
            title: r.title,
            url: `https://click-or-die.ru/${r.slug}/`,
          }));
        });

        const posts = await LiveRuntime.runPromise(program);
        return { posts };
      },
      {
        query: t.Object({
          ids: t.Optional(t.String()),
        }),
      }
    );
