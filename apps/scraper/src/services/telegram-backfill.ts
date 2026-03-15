import { Data, Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { LogLevel } from "telegram/extensions/Logger";
import {
  upsertTelegramPost,
  type TelegramEntity,
  type TelegramInlineButton,
  type TelegramMessage,
} from "./telegram-monitor";

type TelegramBackfillJobStatus = "pending" | "running" | "done" | "error";

type TelegramBackfillJobRow = {
  id: number;
  status: TelegramBackfillJobStatus;
  channels_json: string;
  since_ts: number | null;
  until_ts: number | null;
  max_posts_per_channel: number;
  processed_messages: number;
  inserted_messages: number;
  updated_messages: number;
  skipped_messages: number;
  metadata_json: string | null;
  error_message: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  updated_at: number;
};

type TelegramBackfillChannelStats = {
  channel: string;
  resolvedChannelId?: string;
  resolvedTitle?: string;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
};

export type TelegramBackfillJob = {
  id: number;
  status: TelegramBackfillJobStatus;
  channels: string[];
  sinceTs: number | null;
  untilTs: number | null;
  maxPostsPerChannel: number;
  processedMessages: number;
  insertedMessages: number;
  updatedMessages: number;
  skippedMessages: number;
  metadata: {
    channelStats?: TelegramBackfillChannelStats[];
  } | null;
  errorMessage: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

export type StartTelegramBackfillInput = {
  channels: string[];
  maxPostsPerChannel: number;
  sinceTs: number | null;
  untilTs: number | null;
};

export class TelegramBackfillError extends Data.TaggedError(
  "TelegramBackfillError",
)<{
  message: string;
  cause?: unknown;
}> {}

const MT_CONNECTION_RETRIES = 5;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const normalizeChannelInput = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("@") || /^-?\d+$/.test(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const looksLikeTgLink =
    lower.startsWith("https://t.me/") ||
    lower.startsWith("http://t.me/") ||
    lower.startsWith("https://telegram.me/") ||
    lower.startsWith("http://telegram.me/") ||
    lower.startsWith("t.me/") ||
    lower.startsWith("telegram.me/");

  if (looksLikeTgLink) {
    const withProtocol = trimmed.includes("://")
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      const host = parsed.hostname.toLowerCase();
      if (host.endsWith("t.me") || host.endsWith("telegram.me")) {
        const segments = parsed.pathname.split("/").filter(Boolean);

        if (segments.length >= 1) {
          if (segments[0] === "s" && segments[1]) {
            return `@${segments[1]}`;
          }

          if (segments[0].startsWith("+") || segments[0] === "joinchat") {
            return withProtocol;
          }

          return `@${segments[0]}`;
        }
      }
    } catch {
      return trimmed;
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9_]{2,}$/.test(trimmed)) {
    return `@${trimmed}`;
  }

  return trimmed;
};

const sanitizeChannels = (channels: string[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const channel of channels) {
    const normalized = normalizeChannelInput(channel);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const parseJsonSafely = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const mapJobRow = (row: TelegramBackfillJobRow): TelegramBackfillJob => ({
  id: row.id,
  status: row.status,
  channels: parseJsonSafely<string[]>(row.channels_json, []),
  sinceTs: row.since_ts,
  untilTs: row.until_ts,
  maxPostsPerChannel: row.max_posts_per_channel,
  processedMessages: row.processed_messages,
  insertedMessages: row.inserted_messages,
  updatedMessages: row.updated_messages,
  skippedMessages: row.skipped_messages,
  metadata: parseJsonSafely<{
    channelStats?: TelegramBackfillChannelStats[];
  } | null>(row.metadata_json, null),
  errorMessage: row.error_message,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
});

const formatUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === "object" && error !== null) {
    const withMessage = error as { message?: unknown; _tag?: unknown };
    const tag =
      typeof withMessage._tag === "string" ? withMessage._tag : "Error";
    const message =
      typeof withMessage.message === "string" ? withMessage.message : "unknown";
    return `${tag}: ${message}`;
  }
  return String(error);
};

const toChatIdString = (value: unknown): string => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;

    const nestedValue = record.value;
    if (nestedValue !== undefined && nestedValue !== value) {
      const nested = toChatIdString(nestedValue);
      if (nested.length > 0) {
        return nested;
      }
    }

    const toStringFn = record.toString;
    if (typeof toStringFn === "function") {
      const rendered = String(toStringFn.call(value)).trim();
      if (rendered.length > 0 && rendered !== "[object Object]") {
        return rendered;
      }
    }
  }

  return "";
};

const getChannelIdFromEntityRecord = (
  entityRecord: Record<string, unknown>,
): string => {
  const directCandidates = [
    entityRecord.id,
    entityRecord.channelId,
    entityRecord.channel_id,
    entityRecord.chatId,
    entityRecord.chat_id,
  ];

  for (const candidate of directCandidates) {
    const value = toChatIdString(candidate);
    if (value.length > 0) {
      return value;
    }
  }

  const peerId =
    typeof entityRecord.peerId === "object" && entityRecord.peerId !== null
      ? (entityRecord.peerId as Record<string, unknown>)
      : null;

  if (peerId) {
    const peerCandidates = [
      peerId.channelId,
      peerId.channel_id,
      peerId.chatId,
      peerId.chat_id,
      peerId.userId,
      peerId.user_id,
      peerId.id,
    ];

    for (const candidate of peerCandidates) {
      const value = toChatIdString(candidate);
      if (value.length > 0) {
        return value;
      }
    }
  }

  return "";
};

const toEpochSeconds = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  return null;
};

const mapEntities = (
  entities: Api.TypeMessageEntity[] | undefined,
): TelegramEntity[] => {
  if (!entities || entities.length === 0) {
    return [];
  }

  const result: TelegramEntity[] = [];
  for (const entity of entities) {
    if (entity instanceof Api.MessageEntityTextUrl) {
      result.push({
        type: "text_link",
        offset: entity.offset,
        length: entity.length,
        url: entity.url,
      });
      continue;
    }

    if (entity instanceof Api.MessageEntityUrl) {
      result.push({
        type: "url",
        offset: entity.offset,
        length: entity.length,
      });
    }
  }

  return result;
};

const mapInlineKeyboard = (
  replyMarkup: Api.TypeReplyMarkup | undefined,
): TelegramInlineButton[][] | undefined => {
  if (!(replyMarkup instanceof Api.ReplyInlineMarkup)) {
    return undefined;
  }

  const rows: TelegramInlineButton[][] = [];
  for (const row of replyMarkup.rows) {
    const mappedRow: TelegramInlineButton[] = [];
    for (const button of row.buttons) {
      if (button instanceof Api.KeyboardButtonUrl) {
        mappedRow.push({ url: button.url });
        continue;
      }

      if ("url" in button && typeof button.url === "string") {
        mappedRow.push({ url: button.url });
      }
    }

    if (mappedRow.length > 0) {
      rows.push(mappedRow);
    }
  }

  return rows.length > 0 ? rows : undefined;
};

const toBackfillTelegramMessage = (
  rawMessage: Api.Message,
  channelEntity: Api.TypeEntityLike,
): TelegramMessage | null => {
  const entityRecord =
    typeof channelEntity === "object" && channelEntity !== null
      ? (channelEntity as unknown as Record<string, unknown>)
      : null;

  if (!entityRecord) {
    return null;
  }

  const channelId = getChannelIdFromEntityRecord(entityRecord);
  if (!channelId || typeof rawMessage.id !== "number") {
    return null;
  }

  const messageDate = toEpochSeconds(rawMessage.date);
  if (messageDate === null) {
    return null;
  }

  const bodyText = rawMessage.message ?? undefined;
  const entities = mapEntities(rawMessage.entities);
  const hasMedia = rawMessage.media !== undefined && rawMessage.media !== null;
  const username =
    typeof entityRecord.username === "string"
      ? entityRecord.username
      : undefined;
  const title =
    typeof entityRecord.title === "string" ? entityRecord.title : undefined;

  return {
    message_id: rawMessage.id,
    date: messageDate,
    edit_date: toEpochSeconds(rawMessage.editDate) ?? undefined,
    text: hasMedia ? undefined : bodyText,
    caption: hasMedia ? bodyText : undefined,
    entities: hasMedia ? undefined : entities,
    caption_entities: hasMedia ? entities : undefined,
    author_signature: rawMessage.postAuthor,
    reply_markup: (() => {
      const keyboard = mapInlineKeyboard(rawMessage.replyMarkup);
      return keyboard ? { inline_keyboard: keyboard } : undefined;
    })(),
    chat: {
      id: channelId,
      type: "channel",
      username,
      title,
    },
  };
};

const ensureMtprotoConfig = (): {
  apiId: number;
  apiHash: string;
  session: string;
} => {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_MT_SESSION;

  const apiId = apiIdRaw ? Number.parseInt(apiIdRaw, 10) : NaN;
  if (!Number.isFinite(apiId) || apiId <= 0 || !apiHash || !session) {
    throw new TelegramBackfillError({
      message:
        "Missing Telegram MTProto config: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_MT_SESSION",
    });
  }

  return { apiId, apiHash, session };
};

const createMtprotoClient = (): Effect.Effect<
  TelegramClient,
  TelegramBackfillError
> =>
  Effect.gen(function* () {
    const { apiId, apiHash, session } = yield* Effect.try({
      try: () => ensureMtprotoConfig(),
      catch: (cause) =>
        cause instanceof TelegramBackfillError
          ? cause
          : new TelegramBackfillError({
              message: "Invalid Telegram MTProto config",
              cause,
            }),
    });
    const client = new TelegramClient(
      new StringSession(session),
      apiId,
      apiHash,
      {
        connectionRetries: MT_CONNECTION_RETRIES,
      },
    );
    client.setLogLevel(LogLevel.NONE);

    yield* Effect.tryPromise({
      try: () => client.connect(),
      catch: (cause) =>
        new TelegramBackfillError({
          message: "Failed to connect MTProto client",
          cause,
        }),
    });

    const isAuthorized = yield* Effect.tryPromise({
      try: () => client.isUserAuthorized(),
      catch: (cause) =>
        new TelegramBackfillError({
          message: "Failed to check MTProto authorization",
          cause,
        }),
    });

    if (!isAuthorized) {
      yield* Effect.promise(() => client.disconnect()).pipe(
        Effect.catchAll(() => Effect.void),
      );
      return yield* Effect.fail(
        new TelegramBackfillError({
          message:
            "MTProto session is not authorized. Recreate TELEGRAM_MT_SESSION with a logged-in user account.",
        }),
      );
    }

    return client;
  });

const updateJobCounters = (
  sql: SqlClient.SqlClient,
  jobId: number,
  counters: {
    processed: number;
    inserted: number;
    updated: number;
    skipped: number;
  },
): Effect.Effect<void, unknown, never> =>
  sql`
    UPDATE telegram_backfill_jobs
    SET
      processed_messages = ${counters.processed},
      inserted_messages = ${counters.inserted},
      updated_messages = ${counters.updated},
      skipped_messages = ${counters.skipped},
      updated_at = ${nowSeconds()}
    WHERE id = ${jobId}
  `.pipe(Effect.asVoid);

const setJobStatus = (
  sql: SqlClient.SqlClient,
  jobId: number,
  status: TelegramBackfillJobStatus,
  options?: {
    errorMessage?: string | null;
    metadataJson?: string | null;
    startedAt?: number | null;
    completedAt?: number | null;
  },
): Effect.Effect<void, unknown, never> => {
  const updatedAt = nowSeconds();
  return sql`
    UPDATE telegram_backfill_jobs
    SET
      status = ${status},
      error_message = ${options?.errorMessage ?? null},
      metadata_json = COALESCE(${options?.metadataJson ?? null}, metadata_json),
      started_at = COALESCE(${options?.startedAt ?? null}, started_at),
      completed_at = ${options?.completedAt ?? null},
      updated_at = ${updatedAt}
    WHERE id = ${jobId}
  `.pipe(Effect.asVoid);
};

const getBackfillJobRow = (
  sql: SqlClient.SqlClient,
  jobId: number,
): Effect.Effect<TelegramBackfillJobRow | null, unknown, never> =>
  sql<TelegramBackfillJobRow>`
    SELECT *
    FROM telegram_backfill_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `.pipe(Effect.map((rows) => rows[0] ?? null));

export const getTelegramBackfillReadiness = (): {
  ready: boolean;
  missing: string[];
} => {
  const missing: string[] = [];
  if (!process.env.TELEGRAM_API_ID) {
    missing.push("TELEGRAM_API_ID");
  }
  if (!process.env.TELEGRAM_API_HASH) {
    missing.push("TELEGRAM_API_HASH");
  }
  if (!process.env.TELEGRAM_MT_SESSION) {
    missing.push("TELEGRAM_MT_SESSION");
  }
  return {
    ready: missing.length === 0,
    missing,
  };
};

export const listTelegramBackfillJobs = (
  limit: number,
): Effect.Effect<TelegramBackfillJob[], unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const clampedLimit = Math.max(1, Math.min(100, limit));

    const rows = yield* sql<TelegramBackfillJobRow>`
      SELECT *
      FROM telegram_backfill_jobs
      ORDER BY id DESC
      LIMIT ${clampedLimit}
    `;

    return rows.map(mapJobRow);
  });

export const getTelegramBackfillJob = (
  jobId: number,
): Effect.Effect<TelegramBackfillJob | null, unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const row = yield* getBackfillJobRow(sql, jobId);
    return row ? mapJobRow(row) : null;
  });

export const createTelegramBackfillJob = (
  input: StartTelegramBackfillInput,
): Effect.Effect<number, unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const channels = sanitizeChannels(input.channels);
    if (channels.length === 0) {
      return yield* Effect.fail(
        new TelegramBackfillError({
          message: "At least one Telegram channel is required",
        }),
      );
    }

    if (input.maxPostsPerChannel < 1) {
      return yield* Effect.fail(
        new TelegramBackfillError({
          message: "maxPostsPerChannel must be greater than zero",
        }),
      );
    }

    yield* Effect.try({
      try: () => ensureMtprotoConfig(),
      catch: (cause) =>
        cause instanceof TelegramBackfillError
          ? cause
          : new TelegramBackfillError({
              message: "Invalid Telegram MTProto config",
              cause,
            }),
    });

    const runningRows = yield* sql<{ id: number }>`
      SELECT id
      FROM telegram_backfill_jobs
      WHERE status = 'running'
      ORDER BY id DESC
      LIMIT 1
    `;

    if (runningRows.length > 0) {
      return yield* Effect.fail(
        new TelegramBackfillError({
          message: `Backfill job ${runningRows[0].id} is already running`,
        }),
      );
    }

    const now = nowSeconds();
    yield* sql`
      INSERT INTO telegram_backfill_jobs (
        status,
        channels_json,
        since_ts,
        until_ts,
        max_posts_per_channel,
        created_at,
        updated_at
      ) VALUES (
        'pending',
        ${JSON.stringify(channels)},
        ${input.sinceTs},
        ${input.untilTs},
        ${input.maxPostsPerChannel},
        ${now},
        ${now}
      )
    `;

    const rows = yield* sql<{ id: number }>`
      SELECT id
      FROM telegram_backfill_jobs
      WHERE rowid = last_insert_rowid()
    `;

    const insertedId = rows[0]?.id;
    if (!insertedId) {
      return yield* Effect.fail(
        new TelegramBackfillError({ message: "Failed to create backfill job" }),
      );
    }

    return insertedId;
  });

export const runTelegramBackfillJob = (
  jobId: number,
): Effect.Effect<void, unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const row = yield* getBackfillJobRow(sql, jobId);
    if (!row) {
      yield* Effect.logWarning("telegram backfill job not found").pipe(
        Effect.annotateLogs({ jobId }),
      );
      return;
    }

    const channels = sanitizeChannels(
      parseJsonSafely<string[]>(row.channels_json, []),
    );
    if (channels.length === 0) {
      yield* setJobStatus(sql, jobId, "error", {
        errorMessage: "Job has no channels configured",
        completedAt: nowSeconds(),
      });
      return;
    }

    yield* setJobStatus(sql, jobId, "running", {
      startedAt: nowSeconds(),
      errorMessage: null,
      completedAt: null,
    });

    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const channelStats: TelegramBackfillChannelStats[] = [];

    const client = yield* createMtprotoClient();
    try {
      for (const channel of channels) {
        const stats: TelegramBackfillChannelStats = {
          channel,
          processed: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
        };

        const entityEither = yield* Effect.tryPromise({
          try: () => client.getEntity(channel),
          catch: (cause) =>
            new TelegramBackfillError({
              message: `Failed to resolve channel: ${channel}`,
              cause,
            }),
        }).pipe(Effect.either);

        if (entityEither._tag === "Left") {
          stats.error = formatUnknownError(entityEither.left);
          skipped += 1;
          stats.skipped += 1;
          channelStats.push(stats);
          yield* Effect.logWarning(
            "telegram backfill failed to resolve channel",
          ).pipe(Effect.annotateLogs({ channel, error: stats.error }));
          continue;
        }

        const channelEntity = entityEither.right;
        const channelEntityRecord =
          typeof channelEntity === "object" && channelEntity !== null
            ? (channelEntity as unknown as Record<string, unknown>)
            : null;
        if (channelEntityRecord) {
          stats.resolvedChannelId =
            getChannelIdFromEntityRecord(channelEntityRecord);
        }
        stats.resolvedTitle =
          channelEntityRecord && typeof channelEntityRecord.title === "string"
            ? channelEntityRecord.title
            : undefined;

        const messagesEither = yield* Effect.tryPromise({
          try: async () => {
            const buffer: Api.Message[] = [];
            for await (const raw of client.iterMessages(channelEntity, {
              limit: row.max_posts_per_channel,
            })) {
              if (raw instanceof Api.Message) {
                buffer.push(raw);
              }
            }
            return buffer;
          },
          catch: (cause) =>
            new TelegramBackfillError({
              message: `Failed to fetch messages for channel: ${channel}`,
              cause,
            }),
        }).pipe(Effect.either);

        if (messagesEither._tag === "Left") {
          stats.error = formatUnknownError(messagesEither.left);
          skipped += 1;
          stats.skipped += 1;
          channelStats.push(stats);
          yield* Effect.logWarning(
            "telegram backfill failed to fetch messages",
          ).pipe(Effect.annotateLogs({ channel, error: stats.error }));
          continue;
        }

        const messages = messagesEither.right;
        let mapFailures = 0;
        yield* Effect.logInfo(
          "telegram backfill fetched channel messages",
        ).pipe(
          Effect.annotateLogs({
            channel,
            resolvedChannelId: stats.resolvedChannelId,
            resolvedTitle: stats.resolvedTitle,
            messageCount: messages.length,
          }),
        );

        for (const rawMessage of messages) {
          const messageTs = toEpochSeconds(rawMessage.date);
          if (messageTs === null) {
            skipped += 1;
            stats.skipped += 1;
            continue;
          }

          if (row.until_ts !== null && messageTs > row.until_ts) {
            continue;
          }

          if (row.since_ts !== null && messageTs < row.since_ts) {
            break;
          }

          const mapped = toBackfillTelegramMessage(rawMessage, channelEntity);
          if (!mapped) {
            mapFailures += 1;
            skipped += 1;
            stats.skipped += 1;
            continue;
          }

          const result = yield* upsertTelegramPost(sql, mapped, {
            transport: "mtproto",
            accessKind: "external",
            enableSuccessLogs: false,
          });

          if (!result) {
            skipped += 1;
            stats.skipped += 1;
            continue;
          }

          processed += 1;
          stats.processed += 1;

          if (result.isNewPost) {
            inserted += 1;
            stats.inserted += 1;
          } else {
            updated += 1;
            stats.updated += 1;
          }

          if (processed % 20 === 0) {
            yield* updateJobCounters(sql, jobId, {
              processed,
              inserted,
              updated,
              skipped,
            });
          }
        }

        if (mapFailures > 0 && stats.processed === 0) {
          stats.error =
            stats.error ??
            `Failed to map ${mapFailures} messages (channel id or payload format unsupported)`;
        }

        channelStats.push(stats);
      }

      yield* updateJobCounters(sql, jobId, {
        processed,
        inserted,
        updated,
        skipped,
      });

      const failedChannels = channelStats.filter((item) => Boolean(item.error));
      const channelFailureSummary =
        failedChannels.length > 0
          ? `${failedChannels.length}/${channels.length} channels failed: ${failedChannels
              .slice(0, 3)
              .map((item) => `${item.channel} => ${item.error}`)
              .join(" | ")}${failedChannels.length > 3 ? " | ..." : ""}`
          : null;

      const allChannelsFailed =
        channels.length > 0 && failedChannels.length === channels.length;

      if (allChannelsFailed) {
        yield* setJobStatus(sql, jobId, "error", {
          errorMessage:
            channelFailureSummary ?? "All channels failed during backfill",
          metadataJson: JSON.stringify({ channelStats }),
          completedAt: nowSeconds(),
        });

        yield* Effect.logWarning(
          "telegram backfill finished with channel failures",
        ).pipe(
          Effect.annotateLogs({
            jobId,
            channels: channels.length,
            failedChannels: failedChannels.length,
            error: channelFailureSummary,
          }),
        );

        return;
      }

      yield* setJobStatus(sql, jobId, "done", {
        errorMessage: channelFailureSummary,
        metadataJson: JSON.stringify({ channelStats }),
        completedAt: nowSeconds(),
      });

      yield* Effect.logInfo("telegram backfill completed").pipe(
        Effect.annotateLogs({
          jobId,
          channels: channels.length,
          processed,
          inserted,
          updated,
          skipped,
        }),
      );
    } finally {
      yield* Effect.tryPromise({
        try: () => client.disconnect(),
        catch: () => Promise.resolve(),
      });
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const message = formatUnknownError(error);
        yield* setJobStatus(sql, jobId, "error", {
          errorMessage: message,
          completedAt: nowSeconds(),
        });
        yield* Effect.logError("telegram backfill failed").pipe(
          Effect.annotateLogs({ jobId, error: message }),
        );
      }),
    ),
  );
