import { API_BASE } from "./client";

export type TelegramBackfillJob = {
  id: number;
  status: "pending" | "running" | "done" | "error";
  channels: string[];
  sinceTs: number | null;
  untilTs: number | null;
  maxPostsPerChannel: number;
  processedMessages: number;
  insertedMessages: number;
  updatedMessages: number;
  skippedMessages: number;
  metadata: {
    channelStats?: Array<{
      channel: string;
      resolvedChannelId?: string;
      resolvedTitle?: string;
      processed: number;
      inserted: number;
      updated: number;
      skipped: number;
      error?: string;
    }>;
  } | null;
  errorMessage: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

export type TelegramBackfillReadiness = {
  ready: boolean;
  missing: string[];
};

export type TelegramLinkProcessingState =
  | "pending"
  | "processing"
  | "done"
  | "error"
  | "ignored";

export type TelegramFeedItemOverview = {
  id: number;
  transport: "bot_api" | "mtproto";
  chatId: string;
  username: string | null;
  title: string | null;
  messageId: number;
  postedAt: number;
  editedAt: number | null;
  hasCandidateLinks: boolean;
  firstSeenAt: number;
  lastSeenAt: number;
  linksTotal: number;
  pendingLinks: number;
  processingLinks: number;
  doneLinks: number;
  errorLinks: number;
  ignoredLinks: number;
};

export type TelegramFeedLink = {
  id: number;
  feedItemId: number;
  processingState: TelegramLinkProcessingState;
  sourceField: "text" | "caption" | "button";
  originalUrl: string;
  normalizedUrl: string;
  resolvedUrl: string | null;
  resolvedHost: string | null;
  isYandexMarket: boolean;
  yandexExternalId: string | null;
  attemptCount: number;
  nextAttemptAt: number | null;
  lockedUntil: number | null;
  lastError: string | null;
  title: string | null;
  priceMinorUnits: number | null;
  bonusMinorUnits: number | null;
  currency: string | null;
  imageUrl: string | null;
  scrapedAt: number | null;
  updatedAt: number;
  transport: "bot_api" | "mtproto";
  chatId: string;
  messageId: number;
  postedAt: number;
};

export type TelegramReprocessResult = {
  success: true;
  updated: number;
  linkIds: number[];
  states: TelegramLinkProcessingState[];
  resetAttempts: boolean;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = (await response.json()) as T;
  if (!response.ok) {
    const withError = data as { error?: string };
    throw new Error(withError.error ?? `HTTP ${response.status}`);
  }
  return data;
};

export async function getTelegramBackfillReadiness(): Promise<TelegramBackfillReadiness> {
  const response = await fetch(`${API_BASE}/api/telegram/backfill/readiness`, {
    credentials: "include",
  });
  return parseJson<TelegramBackfillReadiness>(response);
}

export async function listTelegramBackfillJobs(
  limit = 20,
): Promise<TelegramBackfillJob[]> {
  const response = await fetch(
    `${API_BASE}/api/telegram/backfill/jobs?limit=${Math.max(1, Math.min(100, limit))}`,
    {
      credentials: "include",
    },
  );
  return parseJson<TelegramBackfillJob[]>(response);
}

export async function getTelegramBackfillJob(
  jobId: number,
): Promise<TelegramBackfillJob> {
  const response = await fetch(
    `${API_BASE}/api/telegram/backfill/jobs/${jobId}`,
    {
      credentials: "include",
    },
  );
  return parseJson<TelegramBackfillJob>(response);
}

export async function startTelegramBackfill(params: {
  channels: string[];
  maxPostsPerChannel?: number;
  sinceTs?: number | null;
  untilTs?: number | null;
}): Promise<{ success: true; jobId: number }> {
  const response = await fetch(`${API_BASE}/api/telegram/backfill/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(params),
  });
  return parseJson<{ success: true; jobId: number }>(response);
}

export async function listTelegramFeedItems(
  limit = 20,
): Promise<TelegramFeedItemOverview[]> {
  const response = await fetch(
    `${API_BASE}/api/telegram/feed/items?limit=${Math.max(1, Math.min(100, limit))}`,
    {
      credentials: "include",
    },
  );
  return parseJson<TelegramFeedItemOverview[]>(response);
}

export async function listTelegramFeedLinks(params?: {
  limit?: number;
  state?: TelegramLinkProcessingState;
}): Promise<TelegramFeedLink[]> {
  const searchParams = new URLSearchParams();
  searchParams.set(
    "limit",
    String(Math.max(1, Math.min(200, params?.limit ?? 40))),
  );
  if (params?.state) {
    searchParams.set("state", params.state);
  }

  const response = await fetch(
    `${API_BASE}/api/telegram/feed/links?${searchParams.toString()}`,
    {
      credentials: "include",
    },
  );
  return parseJson<TelegramFeedLink[]>(response);
}

export async function reprocessTelegramLinks(params?: {
  linkIds?: number[];
  states?: TelegramLinkProcessingState[];
  resetAttempts?: boolean;
}): Promise<TelegramReprocessResult> {
  const response = await fetch(`${API_BASE}/api/telegram/reprocess`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(params ?? {}),
  });
  return parseJson<TelegramReprocessResult>(response);
}
