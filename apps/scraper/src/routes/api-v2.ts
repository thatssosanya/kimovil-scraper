import { Elysia } from "elysia";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { HtmlCacheService } from "../services/html-cache";
import { JobQueueService, type JobType, type ScrapeMode } from "../services/job-queue";
import { EntityDataService } from "../services/entity-data";
import { DeviceRegistryService } from "../services/device-registry";
import { BulkJobManager } from "../services/bulk-job";
import { LiveRuntime } from "../layers/live";

export interface DeviceWithStats {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  createdAt: number;
  updatedAt: number;
  releaseDate: string | null;
}

export const createApiV2Routes = (bulkJobManager: BulkJobManager) =>
  new Elysia({ prefix: "/api/v2" })
    .get("/devices", async ({ query }) => {
      const search = (query.search as string)?.toLowerCase() || "";
      const filter = query.filter as string | undefined;
      const limit = Math.min(Math.max(1, parseInt(query.limit as string) || 500), 10000);
      const source = (query.source as string) ?? "kimovil";

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const htmlCache = yield* HtmlCacheService;
        const entityData = yield* EntityDataService;

        const devices = yield* deviceRegistry.getAllDevices();
        const corruptedSlugs = yield* htmlCache.getCorruptedSlugs(source);
        const validSlugs = yield* htmlCache.getValidSlugs(source);

        const scrapedSet = new Set([...corruptedSlugs, ...validSlugs]);
        const corruptedSet = new Set(corruptedSlugs);
        const validSet = new Set(validSlugs);

        const rawDeviceIdsList = yield* entityData.getRawDataDeviceIds(source, "specs");
        const rawDataDeviceIds = new Set(rawDeviceIdsList);

        const aiDeviceIdsList = yield* entityData.getFinalDataDeviceIds("specs");
        const aiDataDeviceIds = new Set(aiDeviceIdsList);

        let filtered: DeviceWithStats[] = devices;

        if (search) {
          filtered = filtered.filter(
            (d) =>
              d.name.toLowerCase().includes(search) ||
              d.slug.toLowerCase().includes(search) ||
              d.brand?.toLowerCase().includes(search),
          );
        }

        if (filter === "corrupted") {
          filtered = filtered.filter((d) => corruptedSet.has(d.slug));
        } else if (filter === "valid") {
          filtered = filtered.filter((d) => validSet.has(d.slug));
        } else if (filter === "scraped") {
          filtered = filtered.filter((d) => scrapedSet.has(d.slug));
        } else if (filter === "unscraped") {
          filtered = filtered.filter((d) => !scrapedSet.has(d.slug));
        } else if (filter === "has_raw") {
          filtered = filtered.filter((d) => rawDataDeviceIds.has(d.id));
        } else if (filter === "has_ai") {
          filtered = filtered.filter((d) => aiDataDeviceIds.has(d.id));
        } else if (filter === "needs_raw") {
          filtered = filtered.filter((d) => scrapedSet.has(d.slug) && !rawDataDeviceIds.has(d.id));
        } else if (filter === "needs_ai") {
          filtered = filtered.filter((d) => rawDataDeviceIds.has(d.id) && !aiDataDeviceIds.has(d.id));
        }

        return {
          total: devices.length,
          filtered: filtered.length,
          devices: filtered.slice(0, limit),
          stats: {
            corrupted: corruptedSlugs.length,
            valid: validSlugs.length,
            scraped: scrapedSet.size,
            rawData: rawDataDeviceIds.size,
            aiData: aiDataDeviceIds.size,
          },
        };
      });

      return LiveRuntime.runPromise(program);
    })
    .get("/devices/stats", async () => {
      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const deviceCount = yield* deviceRegistry.getDeviceCount();
        return { devices: deviceCount };
      });
      return LiveRuntime.runPromise(program);
    })
    .get("/devices/:slug/sources/:source/html", async ({ params, set }) => {
      const { slug, source } = params;

      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const html = yield* htmlCache.getHtmlBySlug(slug, source, "specs").pipe(
          Effect.catchAll(() => Effect.succeed(null))
        );
        return { slug, source, html };
      });

      const result = await LiveRuntime.runPromise(program);
      if (result.html === null) {
        set.status = 404;
        return { error: "HTML not found", slug, source };
      }
      return result;
    })
    .delete("/devices/:slug/sources/:source/html", async ({ params }) => {
      const { slug, source } = params;

      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        yield* jobQueue.clearScrapeData(source, slug);
        return { success: true, slug, source };
      });

      return LiveRuntime.runPromise(program);
    })
    .get("/devices/:slug/sources/:source/raw-data/:dataKind", async ({ params, set }) => {
      const { slug, source, dataKind } = params;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const entityData = yield* EntityDataService;

        const device = yield* deviceRegistry.getDeviceBySlug(slug);
        if (!device) {
          return null;
        }

        return yield* entityData.getRawData(device.id, source, dataKind);
      });

      const result = await LiveRuntime.runPromise(program);
      if (result === null) {
        set.status = 404;
        return { error: "Raw data not found", slug, source, dataKind };
      }
      return { slug, source, dataKind, data: result };
    })
    .delete("/devices/:slug/sources/:source/raw-data/:dataKind", async ({ params, set }) => {
      const { slug, source, dataKind } = params;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const entityData = yield* EntityDataService;

        const device = yield* deviceRegistry.getDeviceBySlug(slug);
        if (!device) {
          return { found: false as const, slug };
        }

        const deleted = yield* entityData.deleteRawData(device.id, source, dataKind);
        return { found: true as const, slug, source, dataKind, deleted };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result.found) {
        set.status = 404;
        return { error: "Device not found", slug };
      }
      return { success: true, slug: result.slug, source: result.source, dataKind: result.dataKind, deleted: result.deleted };
    })
    .get("/devices/:slug/data/:dataKind", async ({ params, set }) => {
      const { slug, dataKind } = params;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const entityData = yield* EntityDataService;

        const device = yield* deviceRegistry.getDeviceBySlug(slug);
        if (!device) {
          return null;
        }

        return yield* entityData.getFinalData(device.id, dataKind);
      });

      const result = await LiveRuntime.runPromise(program);
      if (result === null) {
        set.status = 404;
        return { error: "Data not found", slug, dataKind };
      }
      return { slug, dataKind, data: result };
    })
    .delete("/devices/:slug/data/:dataKind", async ({ params, set }) => {
      const { slug, dataKind } = params;

      const program = Effect.gen(function* () {
        const deviceRegistry = yield* DeviceRegistryService;
        const entityData = yield* EntityDataService;

        const device = yield* deviceRegistry.getDeviceBySlug(slug);
        if (!device) {
          return { found: false as const, slug };
        }

        const deleted = yield* entityData.deleteFinalData(device.id, dataKind);
        return { found: true as const, slug, dataKind, deleted };
      });

      const result = await LiveRuntime.runPromise(program);
      if (!result.found) {
        set.status = 404;
        return { error: "Device not found", slug };
      }
      return { success: true, slug: result.slug, dataKind: result.dataKind, deleted: result.deleted };
    })
    .get("/devices/bulk-status", async ({ query, set }) => {
      const slugsParam = query.slugs as string;
      const source = (query.source as string) ?? "kimovil";

      if (!slugsParam) {
        set.status = 400;
        return { error: "slugs parameter required" };
      }

      const slugs = slugsParam.split(",").filter(Boolean);

      const program = Effect.gen(function* () {
        const htmlCache = yield* HtmlCacheService;
        const deviceRegistry = yield* DeviceRegistryService;
        const entityData = yield* EntityDataService;

        const results: Record<
          string,
          {
            hasHtml: boolean;
            hasRawData: boolean;
            hasAiData: boolean;
            isCorrupted: boolean | null;
            corruptionReason: string | null;
            priceSourceCount: number;
            hasPrices: boolean;
            hasPriceRuLink: boolean;
          }
        > = {};

        const sql = yield* SqlClient.SqlClient;

        for (const slug of slugs) {
          const hasHtml = yield* htmlCache.hasHtmlForSlug(slug, source, "specs").pipe(
            Effect.catchAll(() => Effect.succeed(false)),
          );
          const verification = yield* htmlCache.getVerificationStatus(slug, source).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );

          const device = yield* deviceRegistry.getDeviceBySlug(slug).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );

          let hasRawData = false;
          let hasAiData = false;
          let priceSourceCount = 0;
          let hasPrices = false;
          let hasPriceRuLink = false;

          if (device) {
            const entityRaw = yield* entityData.getRawData(device.id, source, "specs").pipe(
              Effect.catchAll(() => Effect.succeed(null)),
            );
            const entityFinal = yield* entityData.getFinalData(device.id, "specs").pipe(
              Effect.catchAll(() => Effect.succeed(null)),
            );
            hasRawData = entityRaw !== null;
            hasAiData = entityFinal !== null;

            const priceSourceRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM device_sources
              WHERE device_id = ${device.id} AND source IN ('yandex_market', 'price_ru') AND status = 'active'
            `.pipe(Effect.catchAll(() => Effect.succeed([])));
            priceSourceCount = priceSourceRows[0]?.count ?? 0;

            const priceRuLinkRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM device_sources
              WHERE device_id = ${device.id} AND source = 'price_ru' AND status = 'active'
            `.pipe(Effect.catchAll(() => Effect.succeed([])));
            hasPriceRuLink = (priceRuLinkRows[0]?.count ?? 0) > 0;

            const priceRows = yield* sql<{ count: number }>`
              SELECT COUNT(*) as count FROM price_quotes WHERE device_id = ${device.id} LIMIT 1
            `.pipe(Effect.catchAll(() => Effect.succeed([])));
            hasPrices = (priceRows[0]?.count ?? 0) > 0;
          }

          results[slug] = {
            hasHtml,
            hasRawData,
            hasAiData,
            isCorrupted: verification?.isCorrupted ?? null,
            corruptionReason: verification?.reason ?? null,
            priceSourceCount,
            hasPrices,
            hasPriceRuLink,
          };
        }

        return results;
      });

      return LiveRuntime.runPromise(program);
    })
    .post("/jobs", async ({ body, set }) => {
      const input = body as {
        jobType: string;
        mode?: string;
        slugs?: string[];
        filter?: string;
        source?: string;
        dataKind?: string;
      };

      const validJobTypes: JobType[] = [
        "scrape",
        "process_raw",
        "process_ai",
        "clear_html",
        "clear_raw",
        "clear_processed",
      ];

      if (!input.jobType || !validJobTypes.includes(input.jobType as JobType)) {
        set.status = 400;
        return { error: `Invalid jobType. Must be one of: ${validJobTypes.join(", ")}` };
      }

      const jobType = input.jobType as JobType;
      const mode = (input.mode as ScrapeMode) ?? "fast";
      const source = input.source ?? "kimovil";
      const dataKind = input.dataKind ?? "specs";

      if (!input.slugs || !Array.isArray(input.slugs) || input.slugs.length === 0) {
        set.status = 400;
        return { error: "slugs array required" };
      }

      const program = Effect.gen(function* () {
        const jobQueue = yield* JobQueueService;
        const deviceRegistry = yield* DeviceRegistryService;

        const jobId = `${jobType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const job = yield* jobQueue.createJob({
          id: jobId,
          jobType,
          mode,
          filter: input.filter ?? null,
          totalCount: input.slugs!.length,
          source,
          dataKind,
        });

        const targets: Array<{ deviceId: string; externalId: string }> = [];
        for (const slug of input.slugs!) {
          let device = yield* deviceRegistry.getDeviceBySlug(slug);
          if (!device) {
            device = yield* deviceRegistry.createDevice({
              slug,
              name: slug,
              brand: null,
            });
            yield* deviceRegistry.linkDeviceToSource({
              deviceId: device.id,
              source,
              externalId: slug,
            });
          }
          targets.push({ deviceId: device.id, externalId: slug });
        }

        const { queued } = yield* jobQueue.enqueueJobTargets(
          jobId,
          jobType,
          mode,
          targets,
          { source, dataKind },
        );

        yield* jobQueue.updateJobCounts(jobId, input.slugs!.length, queued);

        return { job, queued };
      });

      const result = await LiveRuntime.runPromise(program);

      void bulkJobManager.runJob(result.job.id, `api-v2-${result.job.id}`);

      set.status = 201;
      return result;
    });
