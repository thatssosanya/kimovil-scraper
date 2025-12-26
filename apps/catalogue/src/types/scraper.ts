export type SlugConflictInfo = {
  slug: string;
  existingDeviceId: string;
  existingDeviceName: string | null;
};

export type JobStep =
  | "searching"
  | "selecting"
  | "scraping"
  | "done"
  | "error"
  | "slug_conflict"
  | "interrupted";

export type ScrapeJob = {
  id?: string;
  step: JobStep;
  deviceId?: string;
  userId?: string;
  deviceName?: string | null;
  slug?: string | null;
  autocompleteOptions?: { name: string; slug: string }[] | null;
  error?: string | null;
  attempts?: number;
  createdAt?: Date;
  updatedAt?: Date;
  finishedAt?: Date | null;
  progressStage?: string | null;
  progressPercent?: number | null;
  lastLog?: string | null;
  slugConflict?: SlugConflictInfo | null;
};
