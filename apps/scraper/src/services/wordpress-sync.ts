import { Effect, Layer, Context, Data, Schedule } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { createHash } from "crypto";

export class WordPressSyncError extends Data.TaggedError("WordPressSyncError")<{
  message: string;
  cause?: unknown;
}> {}

export interface SyncStatus {
  lastSyncedModifiedGmt: string | null;
  lastRunAt: string | null;
  totalPosts: number;
  totalWidgets: number;
}

export interface ExtractedWidget {
  searchText: string;
  occurrenceIndex: number;
}

export interface SyncResult {
  postsProcessed: number;
  postsInserted: number;
  postsUpdated: number;
  postsSkipped: number;
  widgetsInserted: number;
  maxModifiedGmt: string | null;
}

export interface WordPressSyncService {
  readonly syncPosts: (options?: {
    fullSync?: boolean;
  }) => Effect.Effect<SyncResult, WordPressSyncError>;

  readonly getSyncStatus: () => Effect.Effect<SyncStatus, WordPressSyncError>;

  readonly extractWidgets: (content: string) => ExtractedWidget[];
}

export const WordPressSyncService = Context.GenericTag<WordPressSyncService>(
  "WordPressSyncService",
);

const WORDPRESS_API_BASE = "https://click-or-die.ru/wp-json/wp/v2";
const RATE_LIMIT_MS = 300;
const VALID_POST_STATUSES = ["publish", "future", "draft", "pending", "private"];

interface WPPostResponse {
  id: number;
  title: { rendered: string };
  slug: string;
  status: string;
  date_gmt: string;
  modified_gmt: string;
  content: { rendered: string };
}

type SyncStateRow = {
  source: string;
  last_synced_modified_gmt: string;
  last_run_at: string;
};

type PostCacheRow = {
  post_id: number;
  title: string;
  slug: string;
  status: string;
  post_date_gmt: string;
  post_modified_gmt: string;
  content_hash: string;
  content_rendered: string | null;
  synced_at: string;
};

type CountRow = { count: number };

const wrapSqlError = (error: SqlError.SqlError): WordPressSyncError =>
  new WordPressSyncError({ message: error.message, cause: error });

const computeContentHash = (content: string): string => {
  return createHash("sha256").update(content).digest("hex");
};

const getThreeMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date.toISOString().replace("Z", "");
};

const delay = (ms: number) =>
  Effect.sleep(ms).pipe(Effect.map(() => undefined));

export const WordPressSyncServiceLive = Layer.effect(
  WordPressSyncService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const extractWidgets = (content: string): ExtractedWidget[] => {
      const regex = /searchText:\s*"([^"]+)"/g;
      const widgets: ExtractedWidget[] = [];
      let match;
      let index = 0;

      while ((match = regex.exec(content)) !== null) {
        widgets.push({
          searchText: match[1],
          occurrenceIndex: index++,
        });
      }

      return widgets;
    };

    const fetchPostsPage = (
      page: number,
      modifiedAfter: string,
    ): Effect.Effect<WPPostResponse[], WordPressSyncError> =>
      Effect.tryPromise({
        try: async () => {
          const params = new URLSearchParams({
            per_page: "100",
            page: String(page),
            modified_after: modifiedAfter,
            orderby: "modified",
            order: "asc",
          });

          const response = await fetch(
            `${WORDPRESS_API_BASE}/posts?${params.toString()}`,
          );

          if (!response.ok) {
            if (response.status === 400) {
              const text = await response.text();
              if (text.includes("rest_post_invalid_page_number")) {
                return [];
              }
            }
            throw new Error(`WordPress API error: ${response.status}`);
          }

          return (await response.json()) as WPPostResponse[];
        },
        catch: (error) =>
          new WordPressSyncError({
            message: `Failed to fetch posts page ${page}`,
            cause: error,
          }),
      });

    const processPost = (
      post: WPPostResponse,
      syncedAt: string,
    ): Effect.Effect<
      { inserted: boolean; updated: boolean; widgetsCount: number },
      WordPressSyncError
    > =>
      Effect.gen(function* () {
        const contentHash = computeContentHash(post.content.rendered);

        const existingRows = yield* sql<PostCacheRow>`
          SELECT * FROM wp_posts_cache WHERE post_id = ${post.id}
        `.pipe(Effect.mapError(wrapSqlError));

        const existing = existingRows[0];
        const contentChanged = !existing || existing.content_hash !== contentHash;
        const metadataChanged = existing && existing.post_modified_gmt !== post.modified_gmt;

        // Skip only if content unchanged AND metadata unchanged
        if (existing && !contentChanged && !metadataChanged) {
          return { inserted: false, updated: false, widgetsCount: 0 };
        }

        // If only metadata changed (not content), update post but skip widget re-extraction
        const shouldReExtractWidgets = contentChanged;

        const widgetsCount = yield* sql.withTransaction(
          Effect.gen(function* () {
            // Only delete widgets if content changed (need re-extraction)
            if (shouldReExtractWidgets) {
              yield* sql`
                DELETE FROM wordpress_widget_cache WHERE post_id = ${post.id}
              `;
            }

            yield* sql`
              INSERT INTO wp_posts_cache 
                (post_id, title, slug, status, post_date_gmt, post_modified_gmt, content_hash, content_rendered, synced_at)
              VALUES 
                (${post.id}, ${post.title.rendered}, ${post.slug}, ${post.status}, 
                 ${post.date_gmt}, ${post.modified_gmt}, ${contentHash}, ${post.content.rendered}, ${syncedAt})
              ON CONFLICT(post_id) DO UPDATE SET
                title = excluded.title,
                slug = excluded.slug,
                status = excluded.status,
                post_date_gmt = excluded.post_date_gmt,
                post_modified_gmt = excluded.post_modified_gmt,
                content_hash = excluded.content_hash,
                content_rendered = excluded.content_rendered,
                synced_at = excluded.synced_at
            `;

            // Only re-extract widgets if content changed
            if (shouldReExtractWidgets) {
              const widgets = extractWidgets(post.content.rendered);
              for (const widget of widgets) {
                yield* sql`
                  INSERT INTO wordpress_widget_cache 
                    (post_id, search_text, occurrence_index, post_date_gmt, post_modified_gmt, synced_at)
                  VALUES 
                    (${post.id}, ${widget.searchText}, ${widget.occurrenceIndex}, 
                     ${post.date_gmt}, ${post.modified_gmt}, ${syncedAt})
                `;
              }
              return widgets.length;
            }
            return 0;
          }),
        ).pipe(Effect.mapError(wrapSqlError));

        return {
          inserted: !existing,
          updated: !!existing,
          widgetsCount,
        };
      });

    return WordPressSyncService.of({
      extractWidgets,

      getSyncStatus: () =>
        Effect.gen(function* () {
          const stateRows = yield* sql<SyncStateRow>`
            SELECT * FROM sync_state WHERE source = 'wordpress'
          `.pipe(Effect.mapError(wrapSqlError));

          const state = stateRows[0];

          const postCountRows = yield* sql<CountRow>`
            SELECT COUNT(*) as count FROM wp_posts_cache
          `.pipe(Effect.mapError(wrapSqlError));

          const widgetCountRows = yield* sql<CountRow>`
            SELECT COUNT(*) as count FROM wordpress_widget_cache
          `.pipe(Effect.mapError(wrapSqlError));

          return {
            lastSyncedModifiedGmt: state?.last_synced_modified_gmt ?? null,
            lastRunAt: state?.last_run_at ?? null,
            totalPosts: postCountRows[0]?.count ?? 0,
            totalWidgets: widgetCountRows[0]?.count ?? 0,
          };
        }),

      syncPosts: (options) =>
        Effect.gen(function* () {
          const fullSync = options?.fullSync ?? false;

          let modifiedAfter: string;
          if (fullSync) {
            modifiedAfter = getThreeMonthsAgo();
          } else {
            const stateRows = yield* sql<SyncStateRow>`
              SELECT * FROM sync_state WHERE source = 'wordpress'
            `.pipe(Effect.mapError(wrapSqlError));

            modifiedAfter =
              stateRows[0]?.last_synced_modified_gmt ?? getThreeMonthsAgo();
          }

          yield* Effect.logInfo("WordPress sync started").pipe(
            Effect.annotateLogs({ fullSync, modifiedAfter }),
          );

          const result: SyncResult = {
            postsProcessed: 0,
            postsInserted: 0,
            postsUpdated: 0,
            postsSkipped: 0,
            widgetsInserted: 0,
            maxModifiedGmt: null,
          };

          let page = 1;
          let hasMore = true;
          const syncedAt = new Date().toISOString();

          while (hasMore) {
            const posts = yield* fetchPostsPage(page, modifiedAfter);

            if (posts.length === 0) {
              hasMore = false;
              break;
            }

            yield* Effect.logInfo("Processing posts page").pipe(
              Effect.annotateLogs({ page, count: posts.length }),
            );

            for (const post of posts) {
              const postResult = yield* processPost(post, syncedAt).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning(
                      "Failed to process post, continuing",
                    ).pipe(Effect.annotateLogs({ postId: post.id, error }));
                    return { inserted: false, updated: false, widgetsCount: 0 };
                  }),
                ),
              );

              result.postsProcessed++;
              if (postResult.inserted) {
                result.postsInserted++;
              } else if (postResult.updated) {
                result.postsUpdated++;
              } else {
                result.postsSkipped++;
              }
              result.widgetsInserted += postResult.widgetsCount;

              if (
                !result.maxModifiedGmt ||
                post.modified_gmt > result.maxModifiedGmt
              ) {
                result.maxModifiedGmt = post.modified_gmt;
              }
            }

            if (posts.length < 100) {
              hasMore = false;
            } else {
              page++;
              yield* delay(RATE_LIMIT_MS);
            }
          }

          if (result.maxModifiedGmt) {
            yield* sql`
              INSERT INTO sync_state (source, last_synced_modified_gmt, last_run_at)
              VALUES ('wordpress', ${result.maxModifiedGmt}, ${syncedAt})
              ON CONFLICT(source) DO UPDATE SET
                last_synced_modified_gmt = excluded.last_synced_modified_gmt,
                last_run_at = excluded.last_run_at
            `.pipe(Effect.mapError(wrapSqlError));
          }

          yield* Effect.logInfo("WordPress sync completed").pipe(
            Effect.annotateLogs({
              postsProcessed: result.postsProcessed,
              postsInserted: result.postsInserted,
              postsUpdated: result.postsUpdated,
              postsSkipped: result.postsSkipped,
              widgetsInserted: result.widgetsInserted,
            }),
          );

          return result;
        }),
    });
  }),
);
