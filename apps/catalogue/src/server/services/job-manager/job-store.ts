import { db } from "@/src/server/db";
import { scrapeJob } from "@/src/server/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { logger } from "../logger";
import type { ScrapeJob, JobUpdate, JobStep, SlugConflictInfo } from "./types";
import { JOB_RETENTION_MS } from "./types";

type AutocompleteOption = { name: string; slug: string };

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function dbRowToJob(row: typeof scrapeJob.$inferSelect): ScrapeJob {
  return {
    id: row.id,
    deviceId: row.deviceId,
    userId: row.userId,
    step: row.step as JobStep,
    deviceName: row.deviceName,
    slug: row.slug,
    autocompleteOptions: parseJson<AutocompleteOption[]>(
      row.autocompleteOptions
    ),
    error: row.error,
    attempts: row.attempts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
    progressStage: row.progressStage,
    progressPercent: row.progressPercent,
    lastLog: row.lastLog,
    slugConflict: parseJson<SlugConflictInfo>(row.slugConflict),
  };
}

export class JobStore {
  async get(deviceId: string): Promise<ScrapeJob | undefined> {
    const row = await db.query.scrapeJob.findFirst({
      where: eq(scrapeJob.deviceId, deviceId),
    });
    return row ? dbRowToJob(row) : undefined;
  }

  async getAll(): Promise<ScrapeJob[]> {
    const rows = await db.query.scrapeJob.findMany();
    return rows.map(dbRowToJob);
  }

  async getUserJobs(userId: string): Promise<ScrapeJob[]> {
    const rows = await db.query.scrapeJob.findMany({
      where: eq(scrapeJob.userId, userId),
      orderBy: (jobs, { desc }) => [desc(jobs.updatedAt)],
    });
    return rows.map(dbRowToJob);
  }

  async getActiveJobs(): Promise<ScrapeJob[]> {
    const activeSteps: JobStep[] = ["searching", "selecting", "scraping"];
    const rows = await db.query.scrapeJob.findMany({
      where: inArray(scrapeJob.step, activeSteps),
    });
    return rows.map(dbRowToJob);
  }

  async upsert(
    deviceId: string,
    update: JobUpdate & { userId?: string; deviceName?: string }
  ): Promise<ScrapeJob> {
    const now = new Date();
    const existing = await this.get(deviceId);

    const isTerminal =
      update.step === "done" ||
      update.step === "error" ||
      update.step === "interrupted" ||
      update.step === "slug_conflict";
    const stepChanged =
      existing && update.step && update.step !== existing.step;

    const newAttempts = existing
      ? update.step === existing.step || update.step === "error"
        ? existing.attempts + 1
        : existing.attempts
      : 0;

    const values = {
      deviceId,
      userId: update.userId ?? existing?.userId ?? "",
      step: update.step ?? existing?.step ?? "searching",
      deviceName: update.deviceName ?? existing?.deviceName,
      slug: update.slug ?? existing?.slug,
      autocompleteOptions: update.autocompleteOptions
        ? JSON.stringify(update.autocompleteOptions)
        : existing?.autocompleteOptions
        ? JSON.stringify(existing.autocompleteOptions)
        : null,
      error: update.error ?? existing?.error ?? null,
      attempts: newAttempts,
      progressStage:
        update.progressStage ??
        (stepChanged ? null : existing?.progressStage) ??
        null,
      progressPercent:
        update.progressPercent ??
        (stepChanged ? null : existing?.progressPercent) ??
        null,
      lastLog: update.lastLog ?? existing?.lastLog ?? null,
      slugConflict: update.slugConflict
        ? JSON.stringify(update.slugConflict)
        : existing?.slugConflict
        ? JSON.stringify(existing.slugConflict)
        : null,
      updatedAt: now,
      finishedAt: isTerminal ? update.finishedAt ?? now : null,
      createdAt: existing?.createdAt ?? now,
    };

    if (existing) {
      await db
        .update(scrapeJob)
        .set(values)
        .where(eq(scrapeJob.deviceId, deviceId));
    } else {
      await db.insert(scrapeJob).values({ id: crypto.randomUUID(), ...values });
    }

    const result = await this.get(deviceId);
    if (!result) {
      throw new Error(`Failed to upsert job for device ${deviceId}`);
    }
    return result;
  }

  async delete(deviceId: string): Promise<boolean> {
    const result = await db
      .delete(scrapeJob)
      .where(eq(scrapeJob.deviceId, deviceId));
    return (result.rowsAffected ?? 0) > 0;
  }

  async cleanupOldJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - JOB_RETENTION_MS);
    const terminalSteps: JobStep[] = [
      "done",
      "error",
      "interrupted",
      "slug_conflict",
    ];

    const result = await db
      .delete(scrapeJob)
      .where(
        and(
          inArray(scrapeJob.step, terminalSteps),
          lt(scrapeJob.updatedAt, cutoff)
        )
      );

    const deleted = result.rowsAffected ?? 0;
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old jobs`);
    }
    return deleted;
  }

  async markStaleAsInterrupted(timeoutMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMs);
    const activeSteps: JobStep[] = ["searching", "selecting", "scraping"];

    const result = await db
      .update(scrapeJob)
      .set({
        step: "interrupted",
        error: "Job interrupted - server restarted or connection lost",
        updatedAt: new Date(),
        finishedAt: new Date(),
      })
      .where(
        and(
          inArray(scrapeJob.step, activeSteps),
          lt(scrapeJob.updatedAt, cutoff)
        )
      );

    const affected = result.rowsAffected ?? 0;
    if (affected > 0) {
      logger.warn(`Marked ${affected} stale jobs as interrupted`);
    }
    return affected;
  }
}
