import { createHash } from "node:crypto";
import { Data, Effect } from "effect";
import { SqlClient } from "@effect/sql";
import type { Page } from "playwright";
import { config } from "../config";
import { BrowserService } from "./browser";
import { LinkResolverService } from "./link-resolver";
import {
  extractProductTitle,
  parseYandexImages,
  parseYandexPrices,
  parseYandexProduct,
} from "../sources/yandex_market/extractor";
import { YandexBrowserError } from "../sources/yandex_market/errors";
import { validateYandexMarketUrl } from "../sources/yandex_market/url-utils.js";

const TELEGRAM_STATE_KEY_OFFSET = "telegram:bot_api:offset";
const TELEGRAM_STATE_LOCK_SECONDS = 90;
const TELEGRAM_YANDEX_SCRAPE_SOURCE = "telegram_yandex_market";
const TELEGRAM_YANDEX_RESOLVE_SOURCE = "telegram_yandex_resolve";
const HTTP_URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;

type LinkSourceField = "text" | "caption" | "button";

export const TELEGRAM_LINK_PROCESSING_STATES = [
  "pending",
  "processing",
  "done",
  "error",
  "ignored",
] as const;

export type TelegramLinkProcessingState =
  (typeof TELEGRAM_LINK_PROCESSING_STATES)[number];

type ParsedBonus = {
  bonusRubles: number;
  matchedText: string;
};

type ExtractedLink = {
  sourceField: LinkSourceField;
  originalUrl: string;
  normalizedUrl: string;
  normalizedUrlHash: string;
  occurrenceIndex: number;
};

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
};

export type TelegramEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
};

export type TelegramInlineButton = {
  url?: string;
  login_url?: {
    url?: string;
  };
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
  author_signature?: string;
  reply_markup?: {
    inline_keyboard?: TelegramInlineButton[][];
  };
  chat: {
    id: number | string;
    type: string;
    username?: string;
    title?: string;
  };
};

type UpsertTelegramPostOptions = {
  transport: "bot_api" | "mtproto";
  accessKind: "controlled" | "external";
  enableSuccessLogs?: boolean;
};

export type UpsertTelegramPostResult = {
  feedItemId: number;
  linksExtracted: number;
  isNewPost: boolean;
  linksReplaced: boolean;
};

type TelegramUpdate = {
  update_id: number;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

type IngestionStateRow = {
  state_json: string;
};

type ExistingFeedItemRow = {
  id: number;
  content_hash: string;
};

type ChannelIdRow = {
  id: number;
};

type FeedItemIdRow = {
  id: number;
};

type PendingLinkRow = {
  id: number;
  original_url: string;
  attempt_count: number;
};

type TelegramFeedItemOverviewRow = {
  id: number;
  transport: "bot_api" | "mtproto";
  chat_id: string;
  username: string | null;
  title: string | null;
  message_id: number;
  posted_at: number;
  edited_at: number | null;
  has_candidate_links: number;
  first_seen_at: number;
  last_seen_at: number;
  links_total: number;
  pending_links: number;
  processing_links: number;
  done_links: number;
  error_links: number;
  ignored_links: number;
};

type TelegramFeedLinkRow = {
  id: number;
  feed_item_id: number;
  processing_state: TelegramLinkProcessingState;
  source_field: LinkSourceField;
  original_url: string;
  normalized_url: string;
  resolved_url: string | null;
  resolved_host: string | null;
  is_yandex_market: number;
  yandex_external_id: string | null;
  attempt_count: number;
  next_attempt_at: number | null;
  locked_until: number | null;
  last_error: string | null;
  title: string | null;
  price_minor_units: number | null;
  bonus_minor_units: number | null;
  currency: string | null;
  image_url: string | null;
  scraped_at: number | null;
  updated_at: number;
  transport: "bot_api" | "mtproto";
  chat_id: string;
  message_id: number;
  posted_at: number;
};

type YandexCardSnapshot = {
  title?: string;
  priceMinorUnits?: number;
  currency?: string;
  bonusMinorUnits?: number;
  matchedText?: string;
  imageUrl?: string;
  payloadJson: string;
};

export class TelegramMonitorError extends Data.TaggedError(
  "TelegramMonitorError",
)<{
  message: string;
  retryAfterSeconds?: number;
  cause?: unknown;
}> {}

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
  sourceField: LinkSourceField;
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

export type ReprocessTelegramLinksInput = {
  linkIds?: number[];
  states?: TelegramLinkProcessingState[];
  resetAttempts?: boolean;
};

export type ReprocessTelegramLinksResult = {
  updated: number;
  linkIds: number[];
  states: TelegramLinkProcessingState[];
  resetAttempts: boolean;
};

const formatErrorForLogs = (error: unknown): string => {
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

const clampLimit = (value: number, fallback: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(value)));
};

const isTelegramLinkProcessingState = (
  value: string,
): value is TelegramLinkProcessingState =>
  TELEGRAM_LINK_PROCESSING_STATES.includes(
    value as TelegramLinkProcessingState,
  );

const getChanges = (
  sql: SqlClient.SqlClient,
): Effect.Effect<number, unknown, never> =>
  sql<{ changes: number }>`SELECT changes() as changes`.pipe(
    Effect.map((rows) => rows[0]?.changes ?? 0),
  );

const shouldRunTelegramMonitor = (): boolean =>
  config.telegram.monitorEnabled && Boolean(config.telegram.botToken);

const parseRubles = (raw: string): number | null => {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const extractPurpleBonusFromText = (pageText: string): ParsedBonus | null => {
  const lines = pageText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/(балл|бонус|кешб|кэшб|cashback|plus|плюс)/i.test(line)) {
      continue;
    }

    const patterns = [
      /(?:верн[её]т[сяь]|кешб[эе]к|кэшб[эе]к|бонус(?:а|ов)?|балл(?:а|ов)?|plus|плюс)[^\d]{0,24}([\d\s\u00a0\u202f]{2,})/i,
      /([\d\s\u00a0\u202f]{2,})\s*(?:балл(?:а|ов)?|бонус(?:а|ов)?|кешб[эе]к|кэшб[эе]к)/i,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }

      const parsed = parseRubles(match[1]);
      if (!parsed) {
        continue;
      }

      if (parsed > 200_000) {
        continue;
      }

      return {
        bonusRubles: parsed,
        matchedText: line,
      };
    }
  }

  return null;
};

const extractPurpleBonusFromHtml = (html: string): ParsedBonus | null => {
  const match = html.match(
    /data-zone-name="referralReward"[\s\S]{0,3000}?<span[^>]*>([\d\s\u00a0\u202f]+)<\/span>/i,
  );
  if (!match) {
    return null;
  }
  const parsed = parseRubles(match[1]);
  if (!parsed) {
    return null;
  }
  return {
    bonusRubles: parsed,
    matchedText: `referralReward:${match[1].trim()}`,
  };
};

const normalizeHttpUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[),.;!?]+$/g, "");
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const hashNormalizedUrl = (url: string): string =>
  createHash("sha256").update(url).digest("hex");

const extractEntityLinks = (
  text: string,
  entities: TelegramEntity[] | undefined,
  sourceField: LinkSourceField,
): string[] => {
  const links: string[] = [];

  if (entities && entities.length > 0) {
    for (const entity of entities) {
      if (entity.type === "text_link" && typeof entity.url === "string") {
        links.push(entity.url);
        continue;
      }

      if (entity.type !== "url") {
        continue;
      }

      const start = entity.offset;
      const end = entity.offset + entity.length;
      if (start < 0 || end > text.length || start >= end) {
        continue;
      }

      const sliced = text.slice(start, end).trim();
      if (sliced.length > 0) {
        links.push(sliced);
      }
    }
  }

  if (sourceField === "text" || sourceField === "caption") {
    for (const match of text.matchAll(HTTP_URL_REGEX)) {
      if (match[0]) {
        links.push(match[0]);
      }
    }
  }

  return links;
};

const extractButtonLinks = (message: TelegramMessage): string[] => {
  const keyboard = message.reply_markup?.inline_keyboard;
  if (!keyboard || keyboard.length === 0) {
    return [];
  }

  const links: string[] = [];
  for (const row of keyboard) {
    for (const button of row) {
      if (typeof button.url === "string") {
        links.push(button.url);
      }
      if (typeof button.login_url?.url === "string") {
        links.push(button.login_url.url);
      }
    }
  }

  return links;
};

const extractLinksFromMessage = (message: TelegramMessage): ExtractedLink[] => {
  const deduped = new Map<string, ExtractedLink>();
  let occurrenceIndex = 0;

  const pushMany = (links: string[], sourceField: LinkSourceField) => {
    for (const rawUrl of links) {
      const normalized = normalizeHttpUrl(rawUrl);
      if (!normalized) {
        continue;
      }

      if (deduped.has(normalized)) {
        continue;
      }

      deduped.set(normalized, {
        sourceField,
        originalUrl: rawUrl.trim(),
        normalizedUrl: normalized,
        normalizedUrlHash: hashNormalizedUrl(normalized),
        occurrenceIndex,
      });

      occurrenceIndex += 1;
    }
  };

  const text = message.text ?? "";
  const caption = message.caption ?? "";

  pushMany(extractEntityLinks(text, message.entities, "text"), "text");
  pushMany(
    extractEntityLinks(caption, message.caption_entities, "caption"),
    "caption",
  );
  pushMany(extractButtonLinks(message), "button");

  return [...deduped.values()];
};

const calculateContentHash = (
  text: string,
  caption: string,
  buttonUrls: string[],
): string =>
  createHash("sha256")
    .update(
      JSON.stringify({ text, caption, buttonUrls: [...buttonUrls].sort() }),
    )
    .digest("hex");

const fetchBotApi = <T>(
  method: string,
  params: Record<string, string>,
): Effect.Effect<T, TelegramMonitorError> =>
  Effect.gen(function* () {
    const token = config.telegram.botToken;
    if (!token) {
      return yield* Effect.fail(
        new TelegramMonitorError({
          message: "TELEGRAM_BOT_TOKEN is missing",
        }),
      );
    }

    const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const payload = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; ClickOrDieTelegramMonitor/1.0; +https://click-or-die.ru)",
          },
        });

        return (await response.json()) as TelegramApiResult<T>;
      },
      catch: (cause) =>
        new TelegramMonitorError({
          message: "Failed to call Telegram Bot API",
          cause,
        }),
    });

    if (!payload.ok || payload.result === undefined) {
      return yield* Effect.fail(
        new TelegramMonitorError({
          message: payload.description ?? "Telegram Bot API returned an error",
          retryAfterSeconds: payload.parameters?.retry_after,
        }),
      );
    }

    return payload.result;
  });

const getOffset = (
  sql: SqlClient.SqlClient,
): Effect.Effect<number, never, never> =>
  sql<IngestionStateRow>`
    SELECT state_json
    FROM telegram_ingestion_state
    WHERE state_key = ${TELEGRAM_STATE_KEY_OFFSET}
    LIMIT 1
  `.pipe(
    Effect.map((rows) => rows[0]),
    Effect.map((row) => {
      if (!row) {
        return 0;
      }

      try {
        const parsed = JSON.parse(row.state_json) as {
          offset?: unknown;
        };
        return typeof parsed.offset === "number" ? parsed.offset : 0;
      } catch {
        return 0;
      }
    }),
    Effect.catchAll(() => Effect.succeed(0)),
  );

const saveOffset = (
  sql: SqlClient.SqlClient,
  offset: number,
): Effect.Effect<void, unknown, never> =>
  Effect.gen(function* () {
    const now = Math.floor(Date.now() / 1000);
    yield* sql`
      INSERT INTO telegram_ingestion_state (state_key, state_json, updated_at)
      VALUES (${TELEGRAM_STATE_KEY_OFFSET}, ${JSON.stringify({ offset })}, ${now})
      ON CONFLICT(state_key) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `;
  });

export const upsertTelegramPost = (
  sql: SqlClient.SqlClient,
  message: TelegramMessage,
  options: UpsertTelegramPostOptions,
): Effect.Effect<UpsertTelegramPostResult | null, unknown, never> =>
  sql.withTransaction(
    Effect.gen(function* () {
      const now = Math.floor(Date.now() / 1000);
      const chatId = String(message.chat.id);
      const links = extractLinksFromMessage(message);
      const text = message.text ?? "";
      const caption = message.caption ?? "";
      const contentHash = calculateContentHash(
        text,
        caption,
        links
          .filter((link) => link.sourceField === "button")
          .map((link) => link.normalizedUrl),
      );
      const rawMessageJson = JSON.stringify(message);

      yield* sql`
        INSERT INTO telegram_channels (
          transport,
          chat_id,
          access_kind,
          username,
          title,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${options.transport},
          ${chatId},
          ${options.accessKind},
          ${message.chat.username ?? null},
          ${message.chat.title ?? null},
          1,
          ${now},
          ${now}
        )
        ON CONFLICT(transport, chat_id) DO UPDATE SET
          username = excluded.username,
          title = excluded.title,
          is_active = 1,
          updated_at = excluded.updated_at
      `;

      const channelRows = yield* sql<ChannelIdRow>`
        SELECT id
        FROM telegram_channels
        WHERE transport = ${options.transport} AND chat_id = ${chatId}
        LIMIT 1
      `;

      const channelId = channelRows[0]?.id;
      if (!channelId) {
        yield* Effect.logWarning(
          "telegram monitor failed to resolve channel row",
        ).pipe(
          Effect.annotateLogs({
            transport: options.transport,
            chatId,
            username: message.chat.username,
            title: message.chat.title,
          }),
        );
        return null;
      }

      const existingRows = yield* sql<ExistingFeedItemRow>`
        SELECT id, content_hash
        FROM telegram_feed_items
        WHERE channel_id = ${channelId} AND message_id = ${message.message_id}
        LIMIT 1
      `;

      const existing = existingRows[0];
      const isNewPost = !existing;

      let feedItemId: number;
      let shouldReplaceLinks = false;

      if (!existing) {
        shouldReplaceLinks = true;
        yield* sql`
          INSERT INTO telegram_feed_items (
            channel_id,
            message_id,
            posted_at,
            edited_at,
            text,
            caption,
            author_signature,
            content_hash,
            has_candidate_links,
            raw_message_json,
            first_seen_at,
            last_seen_at,
            created_at,
            updated_at
          ) VALUES (
            ${channelId},
            ${message.message_id},
            ${message.date},
            ${message.edit_date ?? null},
            ${text || null},
            ${caption || null},
            ${message.author_signature ?? null},
            ${contentHash},
            ${links.length > 0 ? 1 : 0},
            ${rawMessageJson},
            ${now},
            ${now},
            ${now},
            ${now}
          )
        `;

        const insertedRows = yield* sql<FeedItemIdRow>`
          SELECT id
          FROM telegram_feed_items
          WHERE channel_id = ${channelId} AND message_id = ${message.message_id}
          LIMIT 1
        `;
        const inserted = insertedRows[0];
        if (!inserted) {
          yield* Effect.logWarning(
            "telegram monitor failed to read inserted feed item",
          ).pipe(
            Effect.annotateLogs({
              transport: options.transport,
              chatId,
              channelId,
              messageId: message.message_id,
            }),
          );
          return null;
        }

        feedItemId = inserted.id;
      } else {
        feedItemId = existing.id;
        shouldReplaceLinks = existing.content_hash !== contentHash;

        yield* sql`
          UPDATE telegram_feed_items
          SET
            edited_at = COALESCE(${message.edit_date ?? null}, edited_at),
            text = ${text || null},
            caption = ${caption || null},
            author_signature = ${message.author_signature ?? null},
            content_hash = ${contentHash},
            has_candidate_links = ${links.length > 0 ? 1 : 0},
            raw_message_json = ${rawMessageJson},
            last_seen_at = ${now},
            updated_at = ${now}
          WHERE id = ${feedItemId}
        `;
      }

      if (!shouldReplaceLinks) {
        if (options.enableSuccessLogs) {
          yield* Effect.logInfo(
            "telegram monitor post ingested (no link changes)",
          ).pipe(
            Effect.annotateLogs({
              transport: options.transport,
              chatId,
              channelId,
              messageId: message.message_id,
              feedItemId,
              isEdited: Boolean(message.edit_date),
              isNewPost,
              linksExtracted: links.length,
            }),
          );
        }
        return {
          feedItemId,
          linksExtracted: links.length,
          isNewPost,
          linksReplaced: false,
        };
      }

      yield* sql`
        DELETE FROM telegram_feed_item_links
        WHERE feed_item_id = ${feedItemId}
      `;

      for (const link of links) {
        yield* sql`
          INSERT INTO telegram_feed_item_links (
            feed_item_id,
            occurrence_index,
            source_field,
            original_url,
            normalized_url,
            normalized_url_hash,
            processing_state,
            attempt_count,
            created_at,
            updated_at
          ) VALUES (
            ${feedItemId},
            ${link.occurrenceIndex},
            ${link.sourceField},
            ${link.originalUrl},
            ${link.normalizedUrl},
            ${link.normalizedUrlHash},
            'pending',
            0,
            ${now},
            ${now}
          )
        `;
      }

      if (options.enableSuccessLogs) {
        yield* Effect.logInfo(
          "telegram monitor post ingested and links upserted",
        ).pipe(
          Effect.annotateLogs({
            transport: options.transport,
            chatId,
            channelId,
            messageId: message.message_id,
            feedItemId,
            isEdited: Boolean(message.edit_date),
            isNewPost,
            linksExtracted: links.length,
          }),
        );
      }

      return {
        feedItemId,
        linksExtracted: links.length,
        isNewPost,
        linksReplaced: true,
      };
    }),
  );

export const listRecentTelegramFeedItems = (
  limit: number,
): Effect.Effect<TelegramFeedItemOverview[], unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const clampedLimit = clampLimit(limit, 20, 100);

    const rows = yield* sql<TelegramFeedItemOverviewRow>`
      SELECT
        fi.id,
        tc.transport,
        tc.chat_id,
        tc.username,
        tc.title,
        fi.message_id,
        fi.posted_at,
        fi.edited_at,
        fi.has_candidate_links,
        fi.first_seen_at,
        fi.last_seen_at,
        COUNT(l.id) as links_total,
        COALESCE(SUM(CASE WHEN l.processing_state = 'pending' THEN 1 ELSE 0 END), 0) as pending_links,
        COALESCE(SUM(CASE WHEN l.processing_state = 'processing' THEN 1 ELSE 0 END), 0) as processing_links,
        COALESCE(SUM(CASE WHEN l.processing_state = 'done' THEN 1 ELSE 0 END), 0) as done_links,
        COALESCE(SUM(CASE WHEN l.processing_state = 'error' THEN 1 ELSE 0 END), 0) as error_links,
        COALESCE(SUM(CASE WHEN l.processing_state = 'ignored' THEN 1 ELSE 0 END), 0) as ignored_links
      FROM telegram_feed_items fi
      INNER JOIN telegram_channels tc ON tc.id = fi.channel_id
      LEFT JOIN telegram_feed_item_links l ON l.feed_item_id = fi.id
      GROUP BY fi.id
      ORDER BY fi.posted_at DESC, fi.id DESC
      LIMIT ${clampedLimit}
    `;

    return rows.map((row) => ({
      id: row.id,
      transport: row.transport,
      chatId: row.chat_id,
      username: row.username,
      title: row.title,
      messageId: row.message_id,
      postedAt: row.posted_at,
      editedAt: row.edited_at,
      hasCandidateLinks: row.has_candidate_links === 1,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      linksTotal: row.links_total,
      pendingLinks: row.pending_links,
      processingLinks: row.processing_links,
      doneLinks: row.done_links,
      errorLinks: row.error_links,
      ignoredLinks: row.ignored_links,
    }));
  });

export const listRecentTelegramFeedLinks = (options?: {
  limit?: number;
  state?: TelegramLinkProcessingState | null;
}): Effect.Effect<TelegramFeedLink[], unknown, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const clampedLimit = clampLimit(options?.limit ?? 40, 40, 200);
    const state = options?.state ?? null;

    const rows =
      state === null
        ? yield* sql<TelegramFeedLinkRow>`
            SELECT
              l.id,
              l.feed_item_id,
              l.processing_state,
              l.source_field,
              l.original_url,
              l.normalized_url,
              l.resolved_url,
              l.resolved_host,
              l.is_yandex_market,
              l.yandex_external_id,
              l.attempt_count,
              l.next_attempt_at,
              l.locked_until,
              l.last_error,
              l.title,
              l.price_minor_units,
              l.bonus_minor_units,
              l.currency,
              l.image_url,
              l.scraped_at,
              l.updated_at,
              tc.transport,
              tc.chat_id,
              fi.message_id,
              fi.posted_at
            FROM telegram_feed_item_links l
            INNER JOIN telegram_feed_items fi ON fi.id = l.feed_item_id
            INNER JOIN telegram_channels tc ON tc.id = fi.channel_id
            ORDER BY l.updated_at DESC, l.id DESC
            LIMIT ${clampedLimit}
          `
        : yield* sql<TelegramFeedLinkRow>`
            SELECT
              l.id,
              l.feed_item_id,
              l.processing_state,
              l.source_field,
              l.original_url,
              l.normalized_url,
              l.resolved_url,
              l.resolved_host,
              l.is_yandex_market,
              l.yandex_external_id,
              l.attempt_count,
              l.next_attempt_at,
              l.locked_until,
              l.last_error,
              l.title,
              l.price_minor_units,
              l.bonus_minor_units,
              l.currency,
              l.image_url,
              l.scraped_at,
              l.updated_at,
              tc.transport,
              tc.chat_id,
              fi.message_id,
              fi.posted_at
            FROM telegram_feed_item_links l
            INNER JOIN telegram_feed_items fi ON fi.id = l.feed_item_id
            INNER JOIN telegram_channels tc ON tc.id = fi.channel_id
            WHERE l.processing_state = ${state}
            ORDER BY l.updated_at DESC, l.id DESC
            LIMIT ${clampedLimit}
          `;

    return rows.map((row) => ({
      id: row.id,
      feedItemId: row.feed_item_id,
      processingState: row.processing_state,
      sourceField: row.source_field,
      originalUrl: row.original_url,
      normalizedUrl: row.normalized_url,
      resolvedUrl: row.resolved_url,
      resolvedHost: row.resolved_host,
      isYandexMarket: row.is_yandex_market === 1,
      yandexExternalId: row.yandex_external_id,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      lockedUntil: row.locked_until,
      lastError: row.last_error,
      title: row.title,
      priceMinorUnits: row.price_minor_units,
      bonusMinorUnits: row.bonus_minor_units,
      currency: row.currency,
      imageUrl: row.image_url,
      scrapedAt: row.scraped_at,
      updatedAt: row.updated_at,
      transport: row.transport,
      chatId: row.chat_id,
      messageId: row.message_id,
      postedAt: row.posted_at,
    }));
  });

export const reprocessTelegramLinks = (
  input: ReprocessTelegramLinksInput,
): Effect.Effect<
  ReprocessTelegramLinksResult,
  TelegramMonitorError,
  SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const linkIds = [
      ...new Set(
        (input.linkIds ?? [])
          .filter((id) => Number.isInteger(id))
          .map((id) => Number(id))
          .filter((id) => id > 0),
      ),
    ];
    const states = [
      ...new Set(
        (input.states ?? [])
          .map((state) => String(state).trim())
          .filter(isTelegramLinkProcessingState),
      ),
    ];
    const resetAttempts = input.resetAttempts === true;

    if (linkIds.length === 0 && states.length === 0) {
      return yield* Effect.fail(
        new TelegramMonitorError({
          message:
            "Reprocess request must include at least one link ID or processing state",
        }),
      );
    }

    const updated = yield* sql.withTransaction(
      Effect.gen(function* () {
        const now = Math.floor(Date.now() / 1000);
        let changes = 0;

        for (const linkId of linkIds) {
          if (resetAttempts) {
            yield* sql`
              UPDATE telegram_feed_item_links
              SET
                processing_state = 'pending',
                attempt_count = 0,
                next_attempt_at = ${now},
                locked_until = NULL,
                last_error = NULL,
                resolved_url = NULL,
                resolved_host = NULL,
                is_yandex_market = 0,
                yandex_external_id = NULL,
                title = NULL,
                price_minor_units = NULL,
                bonus_minor_units = NULL,
                currency = NULL,
                image_url = NULL,
                product_payload_json = NULL,
                scraped_at = NULL,
                updated_at = ${now}
              WHERE id = ${linkId}
            `;
          } else {
            yield* sql`
              UPDATE telegram_feed_item_links
              SET
                processing_state = 'pending',
                next_attempt_at = ${now},
                locked_until = NULL,
                last_error = NULL,
                resolved_url = NULL,
                resolved_host = NULL,
                is_yandex_market = 0,
                yandex_external_id = NULL,
                title = NULL,
                price_minor_units = NULL,
                bonus_minor_units = NULL,
                currency = NULL,
                image_url = NULL,
                product_payload_json = NULL,
                scraped_at = NULL,
                updated_at = ${now}
              WHERE id = ${linkId}
            `;
          }
          changes += yield* getChanges(sql);
        }

        for (const state of states) {
          if (resetAttempts) {
            yield* sql`
              UPDATE telegram_feed_item_links
              SET
                processing_state = 'pending',
                attempt_count = 0,
                next_attempt_at = ${now},
                locked_until = NULL,
                last_error = NULL,
                resolved_url = NULL,
                resolved_host = NULL,
                is_yandex_market = 0,
                yandex_external_id = NULL,
                title = NULL,
                price_minor_units = NULL,
                bonus_minor_units = NULL,
                currency = NULL,
                image_url = NULL,
                product_payload_json = NULL,
                scraped_at = NULL,
                updated_at = ${now}
              WHERE processing_state = ${state}
            `;
          } else {
            yield* sql`
              UPDATE telegram_feed_item_links
              SET
                processing_state = 'pending',
                next_attempt_at = ${now},
                locked_until = NULL,
                last_error = NULL,
                resolved_url = NULL,
                resolved_host = NULL,
                is_yandex_market = 0,
                yandex_external_id = NULL,
                title = NULL,
                price_minor_units = NULL,
                bonus_minor_units = NULL,
                currency = NULL,
                image_url = NULL,
                product_payload_json = NULL,
                scraped_at = NULL,
                updated_at = ${now}
              WHERE processing_state = ${state}
            `;
          }
          changes += yield* getChanges(sql);
        }

        return changes;
      }),
    );

    return {
      updated,
      linkIds,
      states,
      resetAttempts,
    };
  }).pipe(
    Effect.mapError((error) =>
      error instanceof TelegramMonitorError
        ? error
        : new TelegramMonitorError({
            message: "Failed to reprocess Telegram links",
            cause: error,
          }),
    ),
  );

const scrapeYandexCard = (
  browserService: BrowserService,
  url: string,
): Effect.Effect<YandexCardSnapshot, unknown, never> => {
  const scrapeWithPage = (
    page: Page,
  ): Effect.Effect<YandexCardSnapshot, unknown, never> =>
    Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () =>
          page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 }),
        catch: (cause) =>
          new YandexBrowserError({
            message: "Failed to open Yandex card",
            url,
            cause,
          }),
      });

      yield* Effect.tryPromise({
        try: () =>
          page.waitForSelector(
            '[data-zone-name="referralReward"], [data-auto="snippet-price-current"], h1',
            { timeout: 2000 },
          ),
        catch: () => null,
      });

      const html = yield* Effect.tryPromise({
        try: () => page.content(),
        catch: (cause) =>
          new YandexBrowserError({
            message: "Failed to extract card HTML",
            url,
            cause,
          }),
      });

      const offers = parseYandexPrices(html);
      const primaryOffer = offers.find((offer) => offer.isPrimary) ?? offers[0];
      const product = parseYandexProduct(html);
      const images = parseYandexImages(html);
      const title = extractProductTitle(html) ?? product.name;

      let bonus = extractPurpleBonusFromHtml(html);
      if (!bonus) {
        const pageText = yield* Effect.tryPromise({
          try: () => page.evaluate(() => document.body.innerText || ""),
          catch: (cause) =>
            new YandexBrowserError({
              message: "Failed to extract card text",
              url,
              cause,
            }),
        });

        bonus = extractPurpleBonusFromText(pageText);
      }

      if (!primaryOffer && !title && !bonus && !images.primaryImageUrl) {
        return yield* Effect.fail(
          new YandexBrowserError({
            message: "Card page did not contain usable product data",
            url,
          }),
        );
      }

      return {
        title: title ?? undefined,
        priceMinorUnits: primaryOffer?.priceMinorUnits,
        currency: primaryOffer?.currency,
        bonusMinorUnits:
          typeof bonus?.bonusRubles === "number"
            ? bonus.bonusRubles * 100
            : undefined,
        matchedText: bonus?.matchedText,
        imageUrl: images.primaryImageUrl,
        payloadJson: JSON.stringify({
          title,
          product,
          primaryOffer,
          bonus,
          imageUrl: images.primaryImageUrl,
        }),
      } satisfies YandexCardSnapshot;
    });

  return browserService
    .withPooledBrowserPageForSource(
      TELEGRAM_YANDEX_SCRAPE_SOURCE,
      scrapeWithPage,
    )
    .pipe(
      Effect.catchAll((pooledError) =>
        Effect.logWarning(
          "telegram monitor pooled yandex scrape failed, falling back to persistent session",
        ).pipe(
          Effect.annotateLogs({
            url,
            pooledError: formatErrorForLogs(pooledError),
          }),
          Effect.zipRight(
            browserService.withPersistentStealthPage(
              TELEGRAM_YANDEX_SCRAPE_SOURCE,
              scrapeWithPage,
            ),
          ),
        ),
      ),
    );
};

const getRetryDelaySeconds = (attempt: number): number => {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(3600, Math.round(30 * Math.pow(2, exponent)));
};

const isYandexCaptchaUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("market.yandex.ru") &&
      parsed.pathname.toLowerCase().includes("showcaptcha")
    );
  } catch {
    return false;
  }
};

const resolveYandexCardViaBrowser = (
  browserService: BrowserService,
  url: string,
): Effect.Effect<
  { resolvedUrl: string; externalId: string } | null,
  unknown,
  never
> =>
  browserService.withPooledBrowserPageForSource(
    TELEGRAM_YANDEX_RESOLVE_SOURCE,
    (page) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 }),
          catch: (cause) =>
            new YandexBrowserError({
              message: "Failed to resolve link via browser",
              url,
              cause,
            }),
        });

        // Some short links finish redirect chain shortly after first DOM load.
        yield* Effect.tryPromise({
          try: () => page.waitForTimeout(1200),
          catch: () => Promise.resolve(),
        });

        const finalUrl = page.url();
        const validation = validateYandexMarketUrl(finalUrl);
        if (!validation.valid || !validation.externalId) {
          return null;
        }

        return {
          resolvedUrl: validation.cleanUrl,
          externalId: validation.externalId,
        };
      }),
  );

const processPendingLinksBatch = (
  sql: SqlClient.SqlClient,
): Effect.Effect<number, unknown, BrowserService | LinkResolverService> =>
  Effect.gen(function* () {
    const now = Math.floor(Date.now() / 1000);
    const rows = yield* sql<PendingLinkRow>`
      SELECT id, original_url, attempt_count
      FROM telegram_feed_item_links
      WHERE processing_state IN ('pending', 'error')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
        AND (locked_until IS NULL OR locked_until < ${now})
      ORDER BY created_at ASC, id ASC
      LIMIT ${config.telegram.processBatchSize}
    `;

    if (rows.length === 0) {
      return 0;
    }

    yield* Effect.logInfo("telegram monitor processing pending links").pipe(
      Effect.annotateLogs({
        count: rows.length,
      }),
    );

    const linkResolver = yield* LinkResolverService;
    const browserService = yield* BrowserService;
    const claimedRows: Array<{
      id: number;
      originalUrl: string;
      attempt: number;
    }> = [];

    for (const row of rows) {
      const lockUntil = now + TELEGRAM_STATE_LOCK_SECONDS;
      yield* sql`
        UPDATE telegram_feed_item_links
        SET
          processing_state = 'processing',
          attempt_count = attempt_count + 1,
          locked_until = ${lockUntil},
          updated_at = ${now}
        WHERE id = ${row.id}
          AND processing_state IN ('pending', 'error')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
          AND (locked_until IS NULL OR locked_until < ${now})
      `;

      const changes = yield* getChanges(sql);
      if (changes === 0) {
        continue;
      }

      claimedRows.push({
        id: row.id,
        originalUrl: row.original_url,
        attempt: row.attempt_count + 1,
      });
    }

    if (claimedRows.length === 0) {
      return 0;
    }

    const processingConcurrency = Math.max(
      1,
      Math.min(config.telegram.processConcurrency, claimedRows.length),
    );

    const processedRows = yield* Effect.all(
      claimedRows.map((row) =>
        Effect.gen(function* () {
          const processResult = yield* Effect.gen(function* () {
            const resolved = yield* linkResolver.resolve(row.originalUrl);

            let yandexResolved: { resolvedUrl: string; externalId: string } | null =
              null;

            if (
              resolved.isYandexMarket &&
              resolved.externalId &&
              resolved.resolvedUrl
            ) {
              yandexResolved = {
                resolvedUrl: resolved.resolvedUrl,
                externalId: resolved.externalId,
              };
            }

            if (!yandexResolved) {
              // HTTP redirect chasing runs outside Bright Data and may land on
              // anti-bot pages. Always confirm unresolved links via browser.
              const browserResolved = yield* resolveYandexCardViaBrowser(
                browserService,
                row.originalUrl,
              ).pipe(Effect.either);

              if (browserResolved._tag === "Right" && browserResolved.right) {
                yandexResolved = browserResolved.right;
              } else if (browserResolved._tag === "Left") {
                return {
                  status: "retry" as const,
                  message: `Browser-based URL resolution failed: ${formatErrorForLogs(browserResolved.left)}`,
                };
              }
            }

            if (!yandexResolved) {
              if (!resolved.resolvedUrl) {
                return {
                  status: "retry" as const,
                  message:
                    resolved.error ??
                    "Link resolver returned no final URL and browser fallback found no Yandex card",
                };
              }

              if (
                resolved.resolvedUrl &&
                isYandexCaptchaUrl(resolved.resolvedUrl)
              ) {
                return {
                  status: "retry" as const,
                  message:
                    "Yandex returned showcaptcha page while resolving link. Will retry with backoff.",
                };
              }

              return {
                status: "ignored" as const,
                resolvedUrl: resolved.resolvedUrl,
                message: "Resolved URL is not a valid Yandex Market card",
              };
            }

            const snapshot = yield* scrapeYandexCard(
              browserService,
              yandexResolved.resolvedUrl,
            );
            return {
              status: "done" as const,
              resolvedUrl: yandexResolved.resolvedUrl,
              externalId: yandexResolved.externalId,
              snapshot,
            };
          }).pipe(Effect.either);

          return {
            row,
            processResult,
          };
        }),
      ),
      {
        concurrency: processingConcurrency,
      },
    );

    for (const processedRow of processedRows) {
      const row = processedRow.row;
      const attempt = row.attempt;
      const processResult = processedRow.processResult;
      const updatedAt = Math.floor(Date.now() / 1000);

      if (processResult._tag === "Right") {
        const result = processResult.right;
        if (result.status === "done") {
          const resolvedHost = (() => {
            try {
              return new URL(result.resolvedUrl).hostname;
            } catch {
              return null;
            }
          })();

          yield* sql`
            UPDATE telegram_feed_item_links
            SET
              processing_state = 'done',
              resolved_url = ${result.resolvedUrl},
              resolved_host = ${resolvedHost},
              is_yandex_market = 1,
              yandex_external_id = ${result.externalId},
              title = ${result.snapshot.title ?? null},
              price_minor_units = ${result.snapshot.priceMinorUnits ?? null},
              bonus_minor_units = ${result.snapshot.bonusMinorUnits ?? null},
              currency = ${result.snapshot.currency ?? "RUB"},
              image_url = ${result.snapshot.imageUrl ?? null},
              product_payload_json = ${result.snapshot.payloadJson},
              scraped_at = ${updatedAt},
              next_attempt_at = NULL,
              locked_until = NULL,
              last_error = NULL,
              updated_at = ${updatedAt}
            WHERE id = ${row.id}
          `;

          yield* Effect.logInfo("telegram monitor yandex snapshot saved").pipe(
            Effect.annotateLogs({
              linkId: row.id,
              externalId: result.externalId,
              resolvedHost,
              priceMinorUnits: result.snapshot.priceMinorUnits,
              bonusMinorUnits: result.snapshot.bonusMinorUnits,
              title: result.snapshot.title,
            }),
          );
          continue;
        }

        if (result.status === "ignored") {
          const resolvedHost = (() => {
            if (!result.resolvedUrl) {
              return null;
            }
            try {
              return new URL(result.resolvedUrl).hostname;
            } catch {
              return null;
            }
          })();

          yield* sql`
            UPDATE telegram_feed_item_links
            SET
              processing_state = 'ignored',
              resolved_url = ${result.resolvedUrl ?? null},
              resolved_host = ${resolvedHost},
              is_yandex_market = 0,
              next_attempt_at = NULL,
              locked_until = NULL,
              last_error = ${result.message},
              updated_at = ${updatedAt}
            WHERE id = ${row.id}
          `;

          yield* Effect.logInfo(
            "telegram monitor link ignored (non-yandex)",
          ).pipe(
            Effect.annotateLogs({
              linkId: row.id,
              resolvedHost,
              reason: result.message,
            }),
          );
          continue;
        }

        const exhausted = attempt >= config.telegram.maxAttempts;
        const nextAttemptAt = exhausted
          ? null
          : updatedAt + getRetryDelaySeconds(attempt);

        yield* sql`
          UPDATE telegram_feed_item_links
          SET
            processing_state = ${exhausted ? "ignored" : "error"},
            next_attempt_at = ${nextAttemptAt},
            locked_until = NULL,
            last_error = ${result.message},
            updated_at = ${updatedAt}
          WHERE id = ${row.id}
        `;

        if (exhausted) {
          yield* Effect.logWarning(
            "telegram monitor link retries exhausted",
          ).pipe(
            Effect.annotateLogs({
              linkId: row.id,
              attempt,
              reason: result.message,
            }),
          );
        } else {
          yield* Effect.logInfo(
            "telegram monitor link scheduled for retry",
          ).pipe(
            Effect.annotateLogs({
              linkId: row.id,
              attempt,
              nextAttemptAt,
              reason: result.message,
            }),
          );
        }
        continue;
      }

      const error = processResult.left;
      const exhausted = attempt >= config.telegram.maxAttempts;
      const nextAttemptAt = exhausted
        ? null
        : updatedAt + getRetryDelaySeconds(attempt);
      const message = formatErrorForLogs(error);

      yield* sql`
        UPDATE telegram_feed_item_links
        SET
          processing_state = ${exhausted ? "ignored" : "error"},
          next_attempt_at = ${nextAttemptAt},
          locked_until = NULL,
          last_error = ${message},
          updated_at = ${updatedAt}
        WHERE id = ${row.id}
      `;

      yield* Effect.logWarning("telegram monitor link processing failed").pipe(
        Effect.annotateLogs({
          linkId: row.id,
          attempt,
          exhausted,
          error: message,
        }),
      );
    }

    return claimedRows.length;
  });

const createTelegramMonitorLoopIteration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const processedBeforePoll = yield* processPendingLinksBatch(sql);
  const shouldShortPoll = processedBeforePoll > 0;
  const offset = yield* getOffset(sql);
  const updates = yield* fetchBotApi<TelegramUpdate[]>("getUpdates", {
    offset: String(offset),
    timeout: String(shouldShortPoll ? 0 : config.telegram.pollTimeoutSeconds),
    allowed_updates: JSON.stringify(["channel_post", "edited_channel_post"]),
  });

  if (updates.length > 0) {
    yield* Effect.logInfo("telegram monitor received update batch").pipe(
      Effect.annotateLogs({
        updateCount: updates.length,
        fromOffset: offset,
      }),
    );
  }

  for (const update of updates) {
    const message = update.channel_post ?? update.edited_channel_post;
    if (!message || message.chat.type !== "channel") {
      yield* saveOffset(sql, update.update_id + 1);
      continue;
    }

    const chatId = String(message.chat.id);
    const allowlist = config.telegram.allowedChatIds;
    if (allowlist.length > 0 && !allowlist.includes(chatId)) {
      yield* Effect.logInfo(
        "telegram monitor skipped update from non-allowed channel",
      ).pipe(
        Effect.annotateLogs({
          chatId,
          username: message.chat.username,
          title: message.chat.title,
        }),
      );
      yield* saveOffset(sql, update.update_id + 1);
      continue;
    }

    yield* upsertTelegramPost(sql, message, {
      transport: "bot_api",
      accessKind: "controlled",
      enableSuccessLogs: true,
    });
    yield* saveOffset(sql, update.update_id + 1);
  }

  const processedAfterPoll = yield* processPendingLinksBatch(sql);

  return {
    processedBeforePoll,
    processedAfterPoll,
    updateCount: updates.length,
  };
});

export const runTelegramMonitorLoop = Effect.gen(function* () {
  if (!shouldRunTelegramMonitor()) {
    yield* Effect.logInfo(
      "Telegram monitor disabled (set TELEGRAM_BOT_TOKEN and TELEGRAM_MONITOR_ENABLED=true to enable)",
    );
    return;
  }

  while (true) {
    const iteration = yield* createTelegramMonitorLoopIteration.pipe(
      Effect.either,
    );
    if (iteration._tag === "Left") {
      const error = iteration.left;
      const retryAfterMs =
        error instanceof TelegramMonitorError && error.retryAfterSeconds
          ? Math.max(1, error.retryAfterSeconds) * 1000
          : Math.max(1000, config.telegram.loopDelayMs);

      yield* Effect.logError("telegram monitor iteration failed").pipe(
        Effect.annotateLogs({
          error: formatErrorForLogs(error),
          retryAfterMs,
        }),
      );
      yield* Effect.sleep(retryAfterMs);
      continue;
    }

    yield* Effect.sleep(config.telegram.loopDelayMs);
  }
});
