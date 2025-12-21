import { Layer, Effect, Stream, Ref } from "effect";
import { SearchService, SearchEvent, KimovilHttpError } from "@repo/scraper-domain";
import { SearchResult, SearchOption } from "@repo/scraper-protocol";

const MAX_RETRIES = 3;

export const SearchServiceFake = Layer.succeed(SearchService, {
  search: (query: string) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const attemptRef = yield* Ref.make(0);

        const searchEffect = Effect.gen(function* () {
          const attempt = yield* Ref.updateAndGet(attemptRef, (n) => n + 1);

          // 2 second delay
          yield* Effect.sleep("2 seconds");

          // 60% chance of failure on each attempt
          const shouldFail = Math.random() < 0.6;
          if (shouldFail && attempt <= MAX_RETRIES) {
            return yield* Effect.fail(
              new KimovilHttpError({
                url: "fake://kimovil",
                status: 500,
                statusText: `Search attempt ${attempt} failed`,
                attempt,
              })
            );
          }

          // Success case
          return new SearchResult({
            options: [
              new SearchOption({
                name: `${query} Pro`,
                slug: `${query.toLowerCase().replace(/\s+/g, "-")}-pro`,
                url: `https://kimovil.com/fake/${query}-pro`,
              }),
              new SearchOption({
                name: `${query} Plus`,
                slug: `${query.toLowerCase().replace(/\s+/g, "-")}-plus`,
                url: `https://kimovil.com/fake/${query}-plus`,
              }),
              new SearchOption({
                name: query,
                slug: query.toLowerCase().replace(/\s+/g, "-"),
                url: `https://kimovil.com/fake/${query}`,
              }),
            ],
          });
        });

        // Create stream that emits retry events AND result
        return Stream.fromIterable([1, 2, 3, 4]).pipe(
          Stream.mapEffect((retryNum) =>
            searchEffect.pipe(
              Effect.catchAll((error) => {
                if (retryNum >= MAX_RETRIES + 1) {
                  // Final failure
                  return Effect.fail(error);
                }
                // Return retry event
                return Effect.succeed<SearchEvent>({
                  type: "retry",
                  attempt: retryNum,
                  maxAttempts: MAX_RETRIES,
                  delay: 1000,
                  reason: error.message,
                });
              })
            )
          ),
          Stream.takeUntil((item) => "options" in item) // Stop when we get result
        );
      })
    ),
});
