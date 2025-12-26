import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "@/src/server/services/logger";
import { db } from "@/src/server/db";
import { deviceCharacteristics } from "@/src/server/db/schema";

const SCRAPER_API_URL =
  process.env.COD_SCRAPER_API_URL ?? "http://localhost:1488";

// Types matching scraper's API response
export type ScraperDevice = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  createdAt: number;
  updatedAt: number;
  releaseDate: string | null;
  inCatalogue?: boolean;
  [key: string]: unknown;
};

export interface ScraperDevicesResponse {
  total: number;
  filtered: number;
  devices: ScraperDevice[];
  stats: {
    corrupted: number;
    valid: number;
    scraped: number;
    rawData: number;
    aiData: number;
  };
}

export interface ScraperDeviceStatus {
  hasHtml: boolean;
  hasRawData: boolean;
  hasAiData: boolean;
  isCorrupted: boolean | null;
  corruptionReason: string | null;
  priceSourceCount: number;
  hasPrices: boolean;
  hasPriceRuLink: boolean;
}

async function fetchFromScraper<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${SCRAPER_API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Scraper API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error(`Failed to fetch from scraper: ${endpoint}`, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to connect to scraper",
    });
  }
}

export const scraperServiceRouter = createTRPCRouter({
  getDevices: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        filter: z
          .enum([
            "all",
            "scraped",
            "unscraped",
            "corrupted",
            "valid",
            "has_raw",
            "has_ai",
            "needs_raw",
            "needs_ai",
          ])
          .optional(),
        limit: z.number().min(1).max(10000).default(100),
        offset: z.number().min(0).default(0),
        source: z.string().default("kimovil"),
      })
    )
    .query(async ({ input }) => {
      const params = new URLSearchParams();

      if (input.search) params.set("search", input.search);
      if (input.filter && input.filter !== "all") params.set("filter", input.filter);
      params.set("limit", input.limit.toString());
      params.set("offset", input.offset.toString());
      params.set("source", input.source);

      const queryString = params.toString();
      const endpoint = `/api/v2/devices${queryString ? `?${queryString}` : ""}`;

      const [scraperData, catalogueRows] = await Promise.all([
        fetchFromScraper<ScraperDevicesResponse>(endpoint),
        db.select({ slug: deviceCharacteristics.slug }).from(deviceCharacteristics),
      ]);

      const catalogueSlugs = new Set(catalogueRows.map((r) => r.slug));

      const devicesWithMatch = scraperData.devices.map((device) => ({
        ...device,
        inCatalogue: catalogueSlugs.has(device.slug),
      }));

      return {
        ...scraperData,
        devices: devicesWithMatch,
        catalogueTotal: catalogueSlugs.size,
      };
    }),

  getDeviceStats: publicProcedure.query(async () => {
    return fetchFromScraper<{ devices: number }>("/api/v2/devices/stats");
  }),

  getDeviceStatus: publicProcedure
    .input(
      z.object({
        slugs: z.array(z.string()).min(1).max(100),
        source: z.string().default("kimovil"),
      })
    )
    .query(async ({ input }) => {
      const params = new URLSearchParams();
      params.set("slugs", input.slugs.join(","));
      params.set("source", input.source);

      return fetchFromScraper<Record<string, ScraperDeviceStatus>>(
        `/api/v2/devices/bulk-status?${params.toString()}`
      );
    }),

  getDeviceData: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        dataKind: z.string().default("specs"),
      })
    )
    .query(async ({ input }) => {
      return fetchFromScraper<{ slug: string; dataKind: string; data: unknown }>(
        `/api/v2/devices/${input.slug}/data/${input.dataKind}`
      );
    }),

  getDeviceRawData: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        source: z.string().default("kimovil"),
        dataKind: z.string().default("specs"),
      })
    )
    .query(async ({ input }) => {
      return fetchFromScraper<{
        slug: string;
        source: string;
        dataKind: string;
        data: unknown;
      }>(
        `/api/v2/devices/${input.slug}/sources/${input.source}/raw-data/${input.dataKind}`
      );
    }),

  healthCheck: publicProcedure.query(async () => {
    try {
      const result = await fetchFromScraper<{ devices: number }>(
        "/api/v2/devices/stats"
      );
      return { ok: true, deviceCount: result.devices };
    } catch {
      return { ok: false, deviceCount: 0 };
    }
  }),

  getMatchedCount: publicProcedure
    .input(
      z.object({
        source: z.string().default("kimovil"),
      })
    )
    .query(async ({ input }) => {
      const [allScraperData, catalogueRows] = await Promise.all([
        fetchFromScraper<ScraperDevicesResponse>(
          `/api/v2/devices?limit=10000&source=${input.source}`
        ),
        db.select({ slug: deviceCharacteristics.slug }).from(deviceCharacteristics),
      ]);

      const catalogueSlugs = new Set(catalogueRows.map((r) => r.slug));
      const scraperSlugs = new Set(allScraperData.devices.map((d) => d.slug));

      const matched = [...catalogueSlugs].filter((slug) => scraperSlugs.has(slug)).length;

      return {
        matched,
        catalogueTotal: catalogueSlugs.size,
        scraperTotal: allScraperData.total,
      };
    }),
});
