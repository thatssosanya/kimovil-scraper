import { Effect, Layer, Context, Data } from "effect";
import { SqlClient } from "@effect/sql";

export class YourlsError extends Data.TaggedError("YourlsError")<{
  message: string;
  cause?: unknown;
}> {}

const YOURLS_API_ENDPOINT = "https://kik.cat/yourls-api.php";
const YOURLS_SIGNATURE = "a85fcd480f";
const REQUEST_TIMEOUT_MS = 10_000;

interface YourlsShortenResponse {
  status: string;
  statusCode?: number;
  shorturl?: string;
  message?: string;
}

export interface YourlsService {
  /**
   * Shorten a URL via YOURLS. Returns the short URL (e.g. https://kik.cat/abc).
   * Deduplicates by checking DB first for existing short_url with same affiliate_url.
   */
  readonly shorten: (longUrl: string) => Effect.Effect<string, YourlsError>;

  /**
   * Shorten a URL for a specific telegram_feed_item_links row.
   * Checks for existing short_url in DB (dedup by affiliate_url), calls YOURLS if needed,
   * and persists the result (short_url or short_url_error) to the row.
   */
  readonly shortenAndPersist: (params: {
    linkId: number;
    affiliateUrl: string;
  }) => Effect.Effect<string | null, never>;
}

export const YourlsService =
  Context.GenericTag<YourlsService>("YourlsService");

export const YourlsServiceLive = Layer.effect(
  YourlsService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const shorten = (longUrl: string): Effect.Effect<string, YourlsError> =>
      Effect.gen(function* () {
        const body = new URLSearchParams({
          action: "shorturl",
          url: longUrl,
          signature: YOURLS_SIGNATURE,
          format: "json",
        });

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(YOURLS_API_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body,
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            }),
          catch: (e) =>
            new YourlsError({
              message:
                e instanceof Error ? e.message : `YOURLS request failed: ${e}`,
              cause: e,
            }),
        });

        if (!response.ok) {
          return yield* Effect.fail(
            new YourlsError({
              message: `YOURLS HTTP ${response.status}: ${response.statusText}`,
            }),
          );
        }

        const json = yield* Effect.tryPromise({
          try: () => response.json() as Promise<YourlsShortenResponse>,
          catch: (e) =>
            new YourlsError({ message: "YOURLS returned invalid JSON", cause: e }),
        });

        // YOURLS returns status "success" for new URLs, or error with statusCode 200
        // when URL already exists (with the existing short URL in the message)
        if (json.shorturl) {
          return json.shorturl;
        }

        // URL already exists — YOURLS returns the existing short URL in the message
        // or in the url.shorturl field depending on version
        if (json.message && json.message.includes("already exists")) {
          // Extract short URL from the response — try keyword field
          const match = json.message.match(/https?:\/\/kik\.cat\/\S+/);
          if (match) return match[0];
        }

        return yield* Effect.fail(
          new YourlsError({
            message: json.message || `YOURLS error: ${JSON.stringify(json)}`,
          }),
        );
      });

    const shortenAndPersist = (params: {
      linkId: number;
      affiliateUrl: string;
    }): Effect.Effect<string | null, never> =>
      Effect.gen(function* () {
        // Dedup: check if another row with the same affiliate_url already has a short_url
        const existing = yield* sql<{ short_url: string }>`
          SELECT short_url FROM telegram_feed_item_links
          WHERE affiliate_url = ${params.affiliateUrl}
            AND short_url IS NOT NULL
          LIMIT 1
        `.pipe(Effect.catchAll(() => Effect.succeed([] as { short_url: string }[])));

        let shortUrl: string | null;

        if (existing.length > 0) {
          shortUrl = existing[0].short_url;
        } else {
          shortUrl = yield* shorten(params.affiliateUrl).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("YOURLS shorten failed").pipe(
                  Effect.annotateLogs({
                    linkId: params.linkId,
                    affiliateUrl: params.affiliateUrl,
                    error,
                  }),
                );
                // Persist the error
                const now = Math.floor(Date.now() / 1000);
                yield* sql`
                  UPDATE telegram_feed_item_links
                  SET short_url_error = ${error.message},
                      short_url_created_at = ${now}
                  WHERE id = ${params.linkId}
                `.pipe(Effect.asVoid, Effect.catchAll(() => Effect.void));
                return null as string | null;
              }),
            ),
          );

          if (shortUrl === null) return null;
        }

        // Persist the short URL
        const now = Math.floor(Date.now() / 1000);
        yield* sql`
          UPDATE telegram_feed_item_links
          SET short_url = ${shortUrl},
              short_url_created_at = ${now},
              short_url_error = NULL
          WHERE id = ${params.linkId}
        `.pipe(Effect.asVoid, Effect.catchAll(() => Effect.void));

        return shortUrl;
      });

    return YourlsService.of({ shorten, shortenAndPersist });
  }),
);
