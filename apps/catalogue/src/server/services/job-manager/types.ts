export type JobStep =
  | "searching"
  | "selecting"
  | "scraping"
  | "done"
  | "error"
  | "slug_conflict"
  | "interrupted";

export interface SlugConflictInfo {
  slug: string;
  existingDeviceId: string;
  existingDeviceName: string | null;
}

export interface ScrapeJob {
  id?: string;
  deviceId: string;
  userId: string;
  step: JobStep;
  deviceName?: string | null;
  slug?: string | null;
  autocompleteOptions?: { name: string; slug: string }[] | null;
  error?: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  finishedAt?: Date | null;
  progressStage?: string | null;
  progressPercent?: number | null;
  lastLog?: string | null;
  slugConflict?: SlugConflictInfo | null;
}

export interface CreateJobRequest {
  userId: string;
  deviceId: string;
  deviceName?: string;
  searchString: string;
}

export interface ConfirmSlugRequest {
  userId: string;
  deviceId: string;
  selectedSlug: string;
}

export interface JobUpdate {
  step?: JobStep;
  userId?: string;
  deviceName?: string;
  slug?: string;
  autocompleteOptions?: { name: string; slug: string }[];
  error?: string;
  progressStage?: string;
  progressPercent?: number;
  lastLog?: string;
  slugConflict?: SlugConflictInfo;
  finishedAt?: Date;
}

export const JOB_TIMEOUTS = {
  searching: 3 * 60 * 1000,
  selecting: 30 * 60 * 1000,
  scraping: 5 * 60 * 1000,
} as const;

export const STALE_JOB_CHECK_INTERVAL = 60 * 1000;
export const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;
