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

function handleScraperEvent(deviceId: string, event: ScraperEvent): void {
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

        void service
          .getClient()
          .search(searchString, {
            onEvent: (event) => handleScraperEvent(deviceId, event),
          })
          .then(async (result) => {
            const options = result.options.map((opt) => ({
              name: opt.name,
              slug: opt.slug,
            }));
            await jobManager.handleSearchComplete(deviceId, options);
            logger.info(`Search completed for device ${deviceId}`, {
              optionCount: options.length,
            });
          })
          .catch(async (error) => {
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

        void service
          .getClient()
          .scrape(slug, {
            onEvent: (event) => handleScraperEvent(deviceId, event),
          })
          .then(async (result) => {
            try {
              const deviceSpecs = phoneDataToDeviceSpecs(result.data, {
                deviceId,
              });
              await saveDeviceSpecs(deviceSpecs);
              await jobManager.handleScrapeComplete(deviceId);
              logger.info(`Scrape completed and saved for device ${deviceId}`, {
                slug,
              });
            } catch (saveError) {
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
              void service
                .getClient()
                .search(job.deviceName, {
                  onEvent: (event) => handleScraperEvent(deviceId, event),
                })
                .then(async (result) => {
                  const options = result.options.map((opt) => ({
                    name: opt.name,
                    slug: opt.slug,
                  }));
                  await jobManager.handleSearchComplete(deviceId, options);
                })
                .catch(async (error) => {
                  await jobManager.handleScrapeError(
                    deviceId,
                    error instanceof Error ? error : new Error(String(error))
                  );
                });
            }
            break;
          case "scraping":
            if (job.slug) {
              void service
                .getClient()
                .scrape(job.slug, {
                  onEvent: (event) => handleScraperEvent(deviceId, event),
                })
                .then(async (result) => {
                  try {
                    const deviceSpecs = phoneDataToDeviceSpecs(result.data, {
                      deviceId,
                    });
                    await saveDeviceSpecs(deviceSpecs);
                    await jobManager.handleScrapeComplete(deviceId);
                  } catch (saveError) {
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
});

export const initScrapingWS = async (): Promise<void> => {
  const service = getScraperService();
  await service.initialize();
};
