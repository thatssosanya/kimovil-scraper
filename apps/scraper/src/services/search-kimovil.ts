import { Layer, Effect, Stream, Schedule, Ref } from "effect";
import { HttpClient } from "@effect/platform";
import { SearchService, SearchError, SearchEvent } from "@repo/scraper-domain";
import { SearchResult, SearchOption } from "@repo/scraper-protocol";

const MAX_RETRIES = 3;

// Kimovil API response type
interface KimovilResponse {
  results: Array<{
    full_name: string;
    url: string;
  }>;
}

export const SearchServiceKimovil = Layer.effect(
  SearchService,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    return {
      search: (query: string) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const attemptRef = yield* Ref.make(0);
            const eventsRef = yield* Ref.make<SearchEvent[]>([]);

            const searchEffect = Effect.gen(function* () {
              const attempt = yield* Ref.updateAndGet(attemptRef, (n) => n + 1);

              // Build kimovil API URL
              const url = `https://www.kimovil.com/_json/autocomplete_devicemodels_joined.json?device_type=0&name=${encodeURIComponent(query)}`;

              // Make HTTP request
              const response = yield* httpClient.get(url).pipe(
                Effect.flatMap((res) => res.json),
                Effect.timeout("10 seconds"),
                Effect.catchAll((error) =>
                  Effect.fail(
                    new SearchError(
                      `Kimovil API request failed (attempt ${attempt}): ${error}`
                    )
                  )
                )
              );

              // Parse and validate response
              const data = response as KimovilResponse;
              
              if (!data.results || !Array.isArray(data.results)) {
                return yield* Effect.fail(
                  new SearchError("Invalid response from Kimovil API")
                );
              }

              // Map to our SearchResult format
              return new SearchResult({
                options: data.results.map((item) =>
                  new SearchOption({
                    name: item.full_name,
                    slug: item.url,
                    url: `https://www.kimovil.com/en/${item.url}`,
                  })
                ),
              });
            });

            // Retry logic with exponential backoff
            const searchWithRetry = searchEffect.pipe(
              Effect.retry({
                schedule: Schedule.exponential("1 second").pipe(
                  Schedule.compose(Schedule.recurs(MAX_RETRIES))
                ),
                while: (error) => error instanceof SearchError,
              }),
              Effect.tapErrorCause((cause) =>
                Effect.gen(function* () {
                  const attempt = yield* Ref.get(attemptRef);
                  if (attempt <= MAX_RETRIES) {
                    // Add retry event
                    const retryEvent: SearchEvent = {
                      type: "retry",
                      attempt,
                      maxAttempts: MAX_RETRIES,
                      delay: Math.pow(2, attempt - 1) * 1000,
                      reason: `Search failed, retrying...`,
                    };
                    yield* Ref.update(eventsRef, (events) => [
                      ...events,
                      retryEvent,
                    ]);
                  }
                })
              )
            );

            // Execute search and get result
            const result = yield* searchWithRetry.pipe(
              Effect.catchAll((error) =>
                Effect.fail(
                  new SearchError(
                    `Search failed after ${MAX_RETRIES} retries: ${error.message}`
                  )
                )
              )
            );

            // Get all events that were collected during retries
            const events = yield* Ref.get(eventsRef);

            // Return stream with log event, retry events, then result
            const headLog: SearchEvent = {
              type: "log",
              level: "info",
              message: `Searching kimovil for "${query}"...`,
            };

            return Stream.fromIterable<SearchEvent | SearchResult>([
              headLog,
              ...events,
              result,
            ]);
          })
        ),
    };
  })
);
