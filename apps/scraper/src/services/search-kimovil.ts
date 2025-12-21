import { Layer, Effect, Stream, Schedule, Ref } from "effect";
import {
  SearchService,
  SearchEvent,
  SearchLeafError,
  SearchRetryExhaustedError,
  KimovilHttpError,
  KimovilInvalidResponseError,
  SearchBrowserError,
} from "@repo/scraper-domain";
import { SearchResult, SearchOption } from "@repo/scraper-protocol";
import { BrowserService, BrowserError } from "./browser";

const MAX_RETRIES = 3;

interface KimovilResponse {
  results: Array<{
    full_name: string;
    url: string;
  }>;
}

interface HttpFailure {
  _tag: "HttpFailure";
  status: number;
  statusText: string;
  url: string;
}

export const SearchServiceKimovil = Layer.effect(
  SearchService,
  Effect.gen(function* () {
    const browserService = yield* BrowserService;

    return {
      search: (query: string) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const attemptRef = yield* Ref.make(0);
            const eventsRef = yield* Ref.make<SearchEvent[]>([]);

            const url = `https://www.kimovil.com/_json/autocomplete_devicemodels_joined.json?device_type=0&name=${encodeURIComponent(query)}`;

            const searchEffect = Effect.gen(function* () {
              const attempt = yield* Ref.updateAndGet(attemptRef, (n) => n + 1);

              const data = yield* browserService
                .withPersistentStealthPage((page) =>
                  Effect.tryPromise({
                    try: async () => {
                      const result = await page.evaluate(async (u: string) => {
                        const res = await fetch(u, { credentials: "include" });
                        if (!res.ok) {
                          throw {
                            _tag: "HttpFailure",
                            status: res.status,
                            statusText: res.statusText,
                            url: u,
                          };
                        }
                        return await res.json();
                      }, url);
                      return result as KimovilResponse;
                    },
                    catch: (error) => error,
                  }),
                )
                .pipe(
                  Effect.flatMap((result) =>
                    Effect.succeed(result as KimovilResponse),
                  ),
                  Effect.mapError((error): SearchLeafError => {
                    if (
                      error &&
                      typeof error === "object" &&
                      (error as HttpFailure)._tag === "HttpFailure"
                    ) {
                      const e = error as HttpFailure;
                      return new KimovilHttpError({
                        url: e.url,
                        status: e.status,
                        statusText: e.statusText,
                        attempt,
                      });
                    }
                    if (error instanceof BrowserError) {
                      return new SearchBrowserError({
                        message: error.message,
                        attempt,
                      });
                    }
                    return new KimovilHttpError({
                      url,
                      status: -1,
                      statusText: String(error),
                      attempt,
                    });
                  }),
                );

              if (!data.results || !Array.isArray(data.results)) {
                return yield* Effect.fail(
                  new KimovilInvalidResponseError({
                    url,
                    attempt,
                    raw: data,
                  }),
                );
              }

              return new SearchResult({
                options: data.results.map(
                  (item) =>
                    new SearchOption({
                      name: item.full_name,
                      slug: item.url,
                      url: `https://www.kimovil.com/en/${item.url}`,
                    }),
                ),
              });
            });

            const searchWithRetry = searchEffect.pipe(
              Effect.retry({
                schedule: Schedule.exponential("1 second").pipe(
                  Schedule.compose(Schedule.recurs(MAX_RETRIES)),
                ),
                while: (error) =>
                  error._tag === "KimovilHttpError" ||
                  error._tag === "SearchBrowserError",
              }),
              Effect.tapErrorCause(() =>
                Effect.gen(function* () {
                  const attempt = yield* Ref.get(attemptRef);
                  if (attempt <= MAX_RETRIES) {
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
                }),
              ),
            );

            const result = yield* searchWithRetry.pipe(
              Effect.mapError(
                (lastError) =>
                  new SearchRetryExhaustedError({
                    query,
                    attempts: MAX_RETRIES,
                    lastError,
                  }),
              ),
            );

            const events = yield* Ref.get(eventsRef);

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
          }),
        ),
    };
  }),
);
