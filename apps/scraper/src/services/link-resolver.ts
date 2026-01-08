import { Effect, Layer, Context, Data } from "effect";
import { validateYandexMarketUrl } from "../sources/yandex_market/url-utils.js";

export class LinkResolverError extends Data.TaggedError("LinkResolverError")<{
  message: string;
  cause?: unknown;
}> {}

export interface ResolvedLink {
  originalUrl: string;
  resolvedUrl: string | null;
  isYandexMarket: boolean;
  externalId: string | null;
  error?: string;
  // From catalogue Link table
  price?: number;
  updatedAt?: string;
}

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 5000;

export interface LinkResolverService {
  readonly resolve: (
    url: string,
  ) => Effect.Effect<ResolvedLink, LinkResolverError>;
}

export const LinkResolverService =
  Context.GenericTag<LinkResolverService>("LinkResolverService");

const followRedirects = (
  url: string,
  hops: number,
): Effect.Effect<string, LinkResolverError> =>
  Effect.gen(function* () {
    if (hops >= MAX_REDIRECTS) {
      return url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "HEAD",
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; LinkResolver/1.0; +https://example.com)",
            },
          }),
        catch: (e) =>
          new LinkResolverError({
            message:
              e instanceof Error
                ? e.name === "AbortError"
                  ? `Request timeout after ${REQUEST_TIMEOUT_MS}ms`
                  : e.message
                : String(e),
            cause: e,
          }),
      });

      clearTimeout(timeoutId);

      const status = response.status;
      if (status >= 300 && status < 400) {
        const location = response.headers.get("Location");
        if (location) {
          const nextUrl = location.startsWith("http")
            ? location
            : new URL(location, url).toString();
          return yield* followRedirects(nextUrl, hops + 1);
        }
      }

      return url;
    } finally {
      clearTimeout(timeoutId);
    }
  });

export const LinkResolverServiceLive = Layer.succeed(
  LinkResolverService,
  LinkResolverService.of({
    resolve: (url) =>
      Effect.gen(function* () {
        const resolvedUrl = yield* followRedirects(url, 0).pipe(
          Effect.catchAll((error) =>
            Effect.succeed(null as string | null).pipe(
              Effect.tap(() =>
                Effect.logWarning("LinkResolver.resolve failed").pipe(
                  Effect.annotateLogs({ url, error: error.message }),
                ),
              ),
              Effect.map(() => ({ url: null, error: error.message })),
            ),
          ),
          Effect.map((result) =>
            typeof result === "string"
              ? { url: result, error: undefined }
              : result,
          ),
        );

        if (resolvedUrl.error || resolvedUrl.url === null) {
          return {
            originalUrl: url,
            resolvedUrl: null,
            isYandexMarket: false,
            externalId: null,
            error: resolvedUrl.error,
          };
        }

        const validation = validateYandexMarketUrl(resolvedUrl.url);
        if (validation.valid) {
          return {
            originalUrl: url,
            resolvedUrl: validation.cleanUrl,
            isYandexMarket: true,
            externalId: validation.externalId,
          };
        }

        return {
          originalUrl: url,
          resolvedUrl: resolvedUrl.url,
          isYandexMarket: false,
          externalId: null,
        };
      }),
  }),
);
