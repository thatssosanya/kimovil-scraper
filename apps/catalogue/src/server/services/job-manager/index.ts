import { logger } from "../logger";
import { JobStore } from "./job-store";
import { JobLifecycleManager } from "./job-lifecycle";
import type {
  ScrapeJob,
  CreateJobRequest,
  ConfirmSlugRequest,
  JobStep,
  JobUpdate,
  SlugConflictInfo,
} from "./types";

class JobManager {
  private jobStore: JobStore;
  private lifecycleManager: JobLifecycleManager;

  constructor() {
    this.jobStore = new JobStore();
    this.lifecycleManager = new JobLifecycleManager(this.jobStore);
    logger.info("JobManager initialized");
  }

  async getJobsForUser(userId?: string): Promise<ScrapeJob[]> {
    if (!userId) return [];
    return this.jobStore.getUserJobs(userId);
  }

  async getJob(deviceId: string): Promise<ScrapeJob | undefined> {
    return this.jobStore.get(deviceId);
  }

  async startScrapeJob(request: CreateJobRequest): Promise<ScrapeJob> {
    logger.info(`Starting scrape job for device ${request.deviceId}`, {
      userId: request.userId,
      deviceName: request.deviceName,
    });

    return this.jobStore.upsert(request.deviceId, {
      step: "searching",
      userId: request.userId,
      deviceName: request.deviceName,
    });
  }

  async confirmSlug(request: ConfirmSlugRequest): Promise<ScrapeJob> {
    logger.info(`Confirming slug for device ${request.deviceId}`, {
      userId: request.userId,
      slug: request.selectedSlug,
    });

    return this.jobStore.upsert(request.deviceId, {
      step: "scraping",
      userId: request.userId,
      slug: request.selectedSlug,
    });
  }

  async cancelJob(deviceId: string, userId: string): Promise<boolean> {
    const job = await this.jobStore.get(deviceId);

    if (!job) {
      logger.warn(`Attempted to cancel non-existent job: ${deviceId}`);
      return false;
    }

    if (job.userId !== userId) {
      logger.warn(
        `User ${userId} attempted to cancel job ${deviceId} belonging to ${job.userId}`
      );
      return false;
    }

    const deleted = await this.jobStore.delete(deviceId);
    if (deleted) {
      logger.info(`Job cancelled for device ${deviceId} by user ${userId}`);
    }

    return deleted;
  }

  async updateJob(deviceId: string, update: JobUpdate): Promise<ScrapeJob> {
    return this.jobStore.upsert(deviceId, update);
  }

  async handleSearchComplete(
    deviceId: string,
    options: { name: string; slug: string }[]
  ): Promise<void> {
    const currentJob = await this.jobStore.get(deviceId);
    if (!currentJob) {
      logger.error(`Search complete for unknown device: ${deviceId}`);
      return;
    }

    await this.jobStore.upsert(deviceId, {
      step: "selecting",
      autocompleteOptions: options,
      progressStage: undefined,
      progressPercent: undefined,
    });
  }

  async handleScrapeComplete(deviceId: string): Promise<void> {
    const currentJob = await this.jobStore.get(deviceId);
    if (!currentJob) {
      logger.error(`Scrape complete for unknown device: ${deviceId}`);
      return;
    }

    await this.jobStore.upsert(deviceId, {
      step: "done",
      progressStage: undefined,
      progressPercent: undefined,
    });
  }

  async handleProgress(
    deviceId: string,
    event: { stage?: string; percent?: number; message?: string }
  ): Promise<void> {
    const currentJob = await this.jobStore.get(deviceId);
    if (!currentJob) return;

    const update: JobUpdate = { step: currentJob.step };
    if (event.stage) update.progressStage = event.stage;
    if (event.percent !== undefined) update.progressPercent = event.percent;
    if (event.message) update.lastLog = event.message;

    await this.jobStore.upsert(deviceId, update);
  }

  async handleScrapeError(
    deviceId: string,
    error: Error | string
  ): Promise<void> {
    const currentJob = await this.jobStore.get(deviceId);
    if (!currentJob) {
      logger.error(`Scrape error for unknown device: ${deviceId}`);
      return;
    }

    await this.jobStore.upsert(deviceId, {
      step: "error",
      error: typeof error === "string" ? error : error.message,
      progressStage: undefined,
      progressPercent: undefined,
    });
  }

  async handleSlugConflict(
    deviceId: string,
    conflictInfo: SlugConflictInfo
  ): Promise<void> {
    logger.info(`Slug conflict for device ${deviceId}`, {
      slug: conflictInfo.slug,
      existingDeviceId: conflictInfo.existingDeviceId,
    });

    const currentJob = await this.jobStore.get(deviceId);
    if (!currentJob) {
      logger.error(`Slug conflict for unknown device: ${deviceId}`);
      return;
    }

    await this.jobStore.upsert(deviceId, {
      step: "slug_conflict",
      slugConflict: conflictInfo,
      progressStage: undefined,
      progressPercent: undefined,
    });
  }

  async retryJob(deviceId: string, userId: string): Promise<ScrapeJob> {
    const job = await this.jobStore.get(deviceId);

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.userId !== userId) {
      throw new Error("You can only retry your own jobs");
    }

    logger.info(`Retrying job for device ${deviceId}`, {
      currentStep: job.step,
      attempts: job.attempts,
    });

    switch (job.step) {
      case "searching":
        if (!job.deviceName) {
          throw new Error("Device name missing for retry");
        }
        return this.jobStore.upsert(deviceId, {
          step: "searching",
          userId,
          deviceName: job.deviceName,
        });

      case "selecting":
        return this.jobStore.upsert(deviceId, {
          step: "selecting",
        });

      case "scraping":
        if (!job.slug) {
          throw new Error("Slug missing for retry");
        }
        return this.jobStore.upsert(deviceId, {
          step: "scraping",
          userId,
        });

      case "error":
      case "interrupted":
        if (job.slug) {
          return this.jobStore.upsert(deviceId, {
            step: "scraping",
            userId,
          });
        } else if (
          job.autocompleteOptions &&
          job.autocompleteOptions.length > 0
        ) {
          return this.jobStore.upsert(deviceId, {
            step: "selecting",
            userId,
          });
        } else if (job.deviceName) {
          return this.jobStore.upsert(deviceId, {
            step: "searching",
            userId,
          });
        } else {
          throw new Error("Cannot retry job - insufficient information");
        }

      default:
        throw new Error(`Cannot retry job in ${job.step} state`);
    }
  }

  destroy(): void {
    this.lifecycleManager.destroy();
    logger.info("JobManager destroyed");
  }
}

export const jobManager = new JobManager();

export type {
  ScrapeJob,
  CreateJobRequest,
  ConfirmSlugRequest,
  JobStep,
  JobUpdate,
};
export { JOB_TIMEOUTS } from "./types";
