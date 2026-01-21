import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  ScraperWSService,
  type ScraperEvent,
} from "@/src/server/services/scraper-ws";
import { jobManager } from "@/src/server/services/job-manager";
import { logger } from "@/src/server/services/logger";
import {
  saveDeviceSpecs,
  phoneDataToDeviceSpecs,
} from "@/src/server/services/device-data/save-device-specs";
import { SlugConflictError } from "@/src/server/services/device-data/errors";
import { db } from "@/src/server/db";
import { device } from "@/src/server/db/schema";
import { eq } from "drizzle-orm";

const COD_SCRAPER_WS_URL =
  process.env.COD_SCRAPER_WS_URL ?? "ws://localhost:1488/ws";

const COD_SCRAPER_API_URL =
  process.env.COD_SCRAPER_API_URL ?? "http://localhost:1488";

const SCRAPER_SERVICE_TOKEN = process.env.SCRAPER_SERVICE_TOKEN;

const scraperAuthHeaders = (): HeadersInit =>
  SCRAPER_SERVICE_TOKEN ? { Authorization: `Bearer ${SCRAPER_SERVICE_TOKEN}` } : {};

let scraperService: ScraperWSService | null = null;

function getScraperService(): ScraperWSService {
  if (!scraperService) {
    scraperService = ScraperWSService.getInstance(COD_SCRAPER_WS_URL);
  }
  return scraperService;
}

async function handleSlugConflictWithDbUpdate(
  deviceId: string,
  conflictError: SlugConflictError
): Promise<void> {
  await jobManager.handleSlugConflict(deviceId, {
    slug: conflictError.payload.slug,
    existingDeviceId: conflictError.payload.existingDeviceId,
    existingDeviceName: conflictError.payload.existingDeviceName,
  });

  try {
    await db
      .update(device)
      .set({
        duplicateStatus: "duplicate",
        duplicateOfId: conflictError.payload.existingDeviceId,
      })
      .where(eq(device.id, deviceId));

    logger.info(
      `Marked device ${deviceId} as duplicate of ${conflictError.payload.existingDeviceId}`
    );
  } catch (dbError) {
    logger.error(
      `Failed to update duplicate status for device ${deviceId}`,
      dbError
    );
  }
}

interface ExistingMatch {
  slug: string;
  name: string;
  brand?: string | null;
}

async function searchExistingMatches(
  searchString: string
): Promise<ExistingMatch[]> {
  try {
    const url = new URL(`${COD_SCRAPER_API_URL}/api/v2/devices`);
    url.searchParams.set("search", searchString);
    url.searchParams.set("filter", "has_ai");
    url.searchParams.set("limit", "10");

    const response = await fetch(url.toString(), { headers: scraperAuthHeaders() });
    if (!response.ok) {
      logger.warn(`Failed to fetch existing matches: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      devices: Array<{ slug: string; name: string; brand: string | null }>;
    };

    return data.devices.map((d) => ({
      slug: d.slug,
      name: d.name,
      brand: d.brand,
    }));
  } catch (error) {
    logger.warn("Error fetching existing matches", error);
    return [];
  }
}

async function fetchExistingSpecs(slug: string) {
  const url = `${COD_SCRAPER_API_URL}/api/v2/devices/${slug}/data/specs`;
  const response = await fetch(url, { headers: scraperAuthHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch specs for ${slug}: ${response.status}`);
  }

  const result = (await response.json()) as {
    slug: string;
    dataKind: string;
    data: unknown;
  };

  return result.data;
}

// Track if first event has been received for acknowledgement tracking
const acknowledgedJobs = new Set<string>();

function createEventHandler(deviceId: string): (event: ScraperEvent) => void {
  return (event: ScraperEvent) => {
    // On first event, mark job as acknowledged
    if (!acknowledgedJobs.has(deviceId)) {
      acknowledgedJobs.add(deviceId);
      void jobManager.updateJob(deviceId, { acknowledgedAt: new Date() });
    }

    if (event.type === "progress") {
      void jobManager.handleProgress(deviceId, {
        stage: event.stage,
        percent: event.percent,
      });
    } else if (event.type === "log") {
      void jobManager.handleProgress(deviceId, {
        message: event.message,
      });
    } else if (event.type === "retry") {
      void jobManager.handleProgress(deviceId, {
        message: `Retry ${event.attempt}/${event.maxAttempts}: ${event.reason}`,
      });
    }
  };
}

function cleanupAcknowledgementTracking(deviceId: string): void {
  acknowledgedJobs.delete(deviceId);
}

export const scrapingRouter = createTRPCRouter({
  getJobs: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.auth?.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return jobManager.getJobsForUser(ctx.auth.userId);
  }),

  startScrape: publicProcedure
    .input(
      z.object({
        deviceId: z.string(),
        deviceName: z.string().nullable(),
        searchString: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, deviceName, searchString } = input;
      const userId = ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to perform this action",
        });
      }

      try {
        const job = await jobManager.startScrapeJob({
          userId,
          deviceId,
          deviceName: deviceName || undefined,
          searchString,
        });

        const service = getScraperService();
        if (!service.isReady()) {
          await jobManager.updateJob(deviceId, {
            step: "error",
            error:
              "Scraper service is currently unavailable. Please try again later.",
          });
          return job;
        }

        // Fast path: search existing matches in scraper DB (parallel)
        void searchExistingMatches(searchString)
          .then(async (existingMatches) => {
            if (existingMatches.length > 0) {
              await jobManager.updateJob(deviceId, { existingMatches });
              logger.info(`Found ${existingMatches.length} existing matches for device ${deviceId}`);
            }
          })
          .catch((error) => {
            logger.warn(`Fast path search failed for device ${deviceId}`, error);
          });

        // Mark dispatch time before sending
        await jobManager.updateJob(deviceId, { dispatchedAt: new Date() });

        // Slow path: Kimovil search via WebSocket (with tracking)
        void service
          .getClient()
          .searchWithTracking(searchString, {
            onEvent: createEventHandler(deviceId),
          })
          .then(async ({ requestId, result }) => {
            // Store request ID for resilience tracking
            await jobManager.updateJob(deviceId, { scraperRequestId: requestId });

            const options = result.options.map((opt) => ({
              name: opt.name,
              slug: opt.slug,
            }));
            await jobManager.handleSearchComplete(deviceId, options);
            cleanupAcknowledgementTracking(deviceId);
            logger.info(`Search completed for device ${deviceId}`, {
              optionCount: options.length,
              requestId,
            });
          })
          .catch(async (error) => {
            cleanupAcknowledgementTracking(deviceId);
            logger.error(`Search failed for device ${deviceId}`, error);
            await jobManager.handleScrapeError(
              deviceId,
              error instanceof Error ? error : new Error(String(error))
            );
          });

        logger.info(`Scraping started for device ${deviceId}`, {
          userId,
          searchString,
        });
        return job;
      } catch (error) {
        logger.error("Error in startScrape", error);

        const job = await jobManager.updateJob(deviceId, {
          step: "error",
          userId,
          deviceName: deviceName || undefined,
          error: "Failed to start scraping. Please try again later.",
        });

        return job;
      }
    }),

  confirmSlug: publicProcedure
    .input(
      z.object({
        deviceId: z.string(),
        slug: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, slug } = input;
      const userId = ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to perform this action",
        });
      }

      try {
        const job = await jobManager.confirmSlug({
          userId,
          deviceId,
          selectedSlug: slug,
        });

        const service = getScraperService();
        if (!service.isReady()) {
          await jobManager.updateJob(deviceId, {
            step: "error",
            error:
              "Scraper service is currently unavailable. Please try again later.",
          });
          return job;
        }

        // Mark dispatch time before sending
        await jobManager.updateJob(deviceId, { dispatchedAt: new Date() });

        void service
          .getClient()
          .scrapeWithTracking(slug, {
            onEvent: createEventHandler(deviceId),
          })
          .then(async ({ requestId, result }) => {
            // Store request ID for resilience tracking
            await jobManager.updateJob(deviceId, { scraperRequestId: requestId });

            try {
              const deviceSpecs = phoneDataToDeviceSpecs(result.data, {
                deviceId,
              });
              await saveDeviceSpecs(deviceSpecs);
              await jobManager.handleScrapeComplete(deviceId);
              cleanupAcknowledgementTracking(deviceId);
              logger.info(`Scrape completed and saved for device ${deviceId}`, {
                slug,
                requestId,
              });
            } catch (saveError) {
              cleanupAcknowledgementTracking(deviceId);
              if (saveError instanceof SlugConflictError) {
                logger.warn(`Slug conflict for device ${deviceId}`, {
                  slug: saveError.payload.slug,
                  existingDeviceId: saveError.payload.existingDeviceId,
                });
                await handleSlugConflictWithDbUpdate(deviceId, saveError);
                return;
              }
              logger.error(
                `Failed to save data for device ${deviceId}`,
                saveError
              );
              await jobManager.handleScrapeError(
                deviceId,
                saveError instanceof Error
                  ? saveError
                  : new Error(String(saveError))
              );
            }
          })
          .catch(async (error) => {
            cleanupAcknowledgementTracking(deviceId);
            logger.error(`Scrape failed for device ${deviceId}`, error);
            await jobManager.handleScrapeError(
              deviceId,
              error instanceof Error ? error : new Error(String(error))
            );
          });

        logger.info(`Slug confirmed for device ${deviceId}`, { userId, slug });
        return job;
      } catch (error) {
        logger.error("Error in confirmSlug", error);

        const job = await jobManager.updateJob(deviceId, {
          step: "error",
          error: "Failed to confirm slug. Please try again later.",
        });

        return job;
      }
    }),

  retryJob: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { deviceId } = input;
      const userId = ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to perform this action",
        });
      }

      const service = getScraperService();
      if (!service.isReady()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Scraper service is currently unavailable. Please try again later.",
        });
      }

      try {
        const job = await jobManager.retryJob(deviceId, userId);

        switch (job.step) {
          case "searching":
            if (job.deviceName) {
              // Mark dispatch time
              await jobManager.updateJob(deviceId, { dispatchedAt: new Date() });
              void service
                .getClient()
                .searchWithTracking(job.deviceName, {
                  onEvent: createEventHandler(deviceId),
                })
                .then(async ({ requestId, result }) => {
                  await jobManager.updateJob(deviceId, { scraperRequestId: requestId });
                  const options = result.options.map((opt) => ({
                    name: opt.name,
                    slug: opt.slug,
                  }));
                  await jobManager.handleSearchComplete(deviceId, options);
                  cleanupAcknowledgementTracking(deviceId);
                })
                .catch(async (error) => {
                  cleanupAcknowledgementTracking(deviceId);
                  await jobManager.handleScrapeError(
                    deviceId,
                    error instanceof Error ? error : new Error(String(error))
                  );
                });
            }
            break;
          case "scraping":
            if (job.slug) {
              // Mark dispatch time
              await jobManager.updateJob(deviceId, { dispatchedAt: new Date() });
              void service
                .getClient()
                .scrapeWithTracking(job.slug, {
                  onEvent: createEventHandler(deviceId),
                })
                .then(async ({ requestId, result }) => {
                  await jobManager.updateJob(deviceId, { scraperRequestId: requestId });
                  try {
                    const deviceSpecs = phoneDataToDeviceSpecs(result.data, {
                      deviceId,
                    });
                    await saveDeviceSpecs(deviceSpecs);
                    await jobManager.handleScrapeComplete(deviceId);
                    cleanupAcknowledgementTracking(deviceId);
                  } catch (saveError) {
                    cleanupAcknowledgementTracking(deviceId);
                    if (saveError instanceof SlugConflictError) {
                      await handleSlugConflictWithDbUpdate(deviceId, saveError);
                      return;
                    }
                    await jobManager.handleScrapeError(
                      deviceId,
                      saveError instanceof Error
                        ? saveError
                        : new Error(String(saveError))
                    );
                  }
                })
                .catch(async (error) => {
                  cleanupAcknowledgementTracking(deviceId);
                  await jobManager.handleScrapeError(
                    deviceId,
                    error instanceof Error ? error : new Error(String(error))
                  );
                });
            }
            break;
        }

        logger.info(`Job retried for device ${deviceId}`, {
          userId,
          step: job.step,
        });
        return { success: true };
      } catch (error) {
        logger.error("Error in retryJob", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  cancelJob: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { deviceId } = input;
      const userId = ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to perform this action",
        });
      }

      try {
        const success = await jobManager.cancelJob(deviceId, userId);

        if (!success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found or you don't have permission to cancel it",
          });
        }

        logger.info(`Job cancelled for device ${deviceId}`, { userId });
        return { success: true };
      } catch (error) {
        logger.error("Error in cancelJob", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  importExisting: publicProcedure
    .input(
      z.object({
        deviceId: z.string(),
        slug: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, slug } = input;
      const userId = ctx.auth?.userId;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to perform this action",
        });
      }

      try {
        // Update job to scraping state
        await jobManager.updateJob(deviceId, {
          step: "scraping",
          slug,
          progressStage: "importing",
          progressPercent: 10,
        });

        // Fetch existing specs from scraper
        const specsData = await fetchExistingSpecs(slug);
        if (!specsData) {
          throw new Error("No specs data found");
        }

        await jobManager.updateJob(deviceId, {
          progressStage: "saving",
          progressPercent: 80,
        });

        // Transform and save
        const deviceSpecs = phoneDataToDeviceSpecs(
          specsData as Parameters<typeof phoneDataToDeviceSpecs>[0],
          { deviceId }
        );
        await saveDeviceSpecs(deviceSpecs);
        await jobManager.handleScrapeComplete(deviceId);

        logger.info(`Imported existing specs for device ${deviceId}`, { slug });
        return { success: true };
      } catch (error) {
        if (error instanceof SlugConflictError) {
          logger.warn(`Slug conflict for device ${deviceId}`, {
            slug: error.payload.slug,
            existingDeviceId: error.payload.existingDeviceId,
          });
          await handleSlugConflictWithDbUpdate(deviceId, error);
          return { success: false, conflict: true };
        }

        logger.error(`Failed to import existing specs for device ${deviceId}`, error);
        await jobManager.handleScrapeError(
          deviceId,
          error instanceof Error ? error : new Error(String(error))
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Import failed",
        });
      }
    }),
});

export const initScrapingWS = async (): Promise<void> => {
  const service = getScraperService();
  await service.initialize();
};
