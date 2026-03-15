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
const REQUEST_USER_AGENT =
  "Mozilla/5.0 (compatible; LinkResolver/1.0; +https://click-or-die.ru)";
const KIK_CAT_HOSTS = new Set(["kik.cat", "www.kik.cat"]);
const YOURLS_API_ENDPOINT = "https://kik.cat/yourls-api.php";
const YOURLS_SIGNATURE = "a85fcd480f";

export interface LinkResolverService {
  readonly resolve: (
    url: string,
  ) => Effect.Effect<ResolvedLink, LinkResolverError>;
}

export const LinkResolverService = Context.GenericTag<LinkResolverService>(
  "LinkResolverService",
);

const executeRequest = (
  url: string,
  method: "HEAD" | "GET",
): Effect.Effect<Response, LinkResolverError> =>
  Effect.gen(function* () {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method,
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent": REQUEST_USER_AGENT,
            },
          }),
        catch: (e) =>
          new LinkResolverError({
            message:
              e instanceof Error
                ? e.name === "AbortError"
                  ? `${method} request timeout after ${REQUEST_TIMEOUT_MS}ms`
                  : e.message
                : String(e),
            cause: e,
          }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });

const getRedirectUrl = (
  response: Response,
  currentUrl: string,
): string | null => {
  if (response.status < 300 || response.status >= 400) {
    return null;
  }

  const location = response.headers.get("Location");
  if (!location) {
    return null;
  }

  return location.startsWith("http")
    ? location
    : new URL(location, currentUrl).toString();
};

const shouldFallbackToGet = (response: Response): boolean => {
  if (
    response.status === 400 ||
    response.status === 403 ||
    response.status === 405 ||
    response.status === 501
  ) {
    return true;
  }

  return (
    response.status >= 300 &&
    response.status < 400 &&
    !response.headers.get("Location")
  );
};

const isKikCatUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return KIK_CAT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const extractKikCatKeyword = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (!KIK_CAT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    const keyword = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)[0];

    return keyword && keyword.length > 0 ? keyword : null;
  } catch {
    return null;
  }
};

type YourlsExpandResponse = {
  status?: unknown;
  message?: unknown;
  longurl?: unknown;
};

const resolveKikCatViaYourls = (
  url: string,
): Effect.Effect<string | null, LinkResolverError> =>
  Effect.gen(function* () {
    const keyword = extractKikCatKeyword(url);
    if (!keyword) {
      return null;
    }

    const requestUrl = new URL(YOURLS_API_ENDPOINT);
    requestUrl.searchParams.set("signature", YOURLS_SIGNATURE);
    requestUrl.searchParams.set("action", "expand");
    requestUrl.searchParams.set("format", "json");
    requestUrl.searchParams.set("shorturl", keyword);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(requestUrl.toString(), {
            method: "GET",
            signal: controller.signal,
            headers: {
              "User-Agent": REQUEST_USER_AGENT,
            },
          }),
        catch: (cause) =>
          new LinkResolverError({
            message:
              cause instanceof Error
                ? cause.name === "AbortError"
                  ? `YOURLS expand timeout after ${REQUEST_TIMEOUT_MS}ms`
                  : cause.message
                : String(cause),
            cause,
          }),
      });

      const payload = yield* Effect.tryPromise({
        try: () => response.json() as Promise<YourlsExpandResponse>,
        catch: (cause) =>
          new LinkResolverError({
            message: "YOURLS returned invalid JSON",
            cause,
          }),
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new LinkResolverError({
            message: `YOURLS expand failed with HTTP ${response.status}`,
          }),
        );
      }

      if (typeof payload.longurl === "string" && payload.longurl.trim().length > 0) {
        return payload.longurl.trim();
      }

      if (
        typeof payload.status === "string" &&
        payload.status.toLowerCase() === "fail"
      ) {
        return yield* Effect.fail(
          new LinkResolverError({
            message:
              typeof payload.message === "string"
                ? payload.message
                : "YOURLS expand returned status=fail",
          }),
        );
      }

      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  });

const followRedirects = (
  url: string,
  hops: number,
): Effect.Effect<string, LinkResolverError> =>
  Effect.gen(function* () {
    if (hops >= MAX_REDIRECTS) {
      return url;
    }

    const headResponse = yield* executeRequest(url, "HEAD");
    const headRedirect = getRedirectUrl(headResponse, url);
    if (headRedirect) {
      return yield* followRedirects(headRedirect, hops + 1);
    }

    if (!shouldFallbackToGet(headResponse)) {
      return url;
    }

    const getResponse = yield* executeRequest(url, "GET");
    const getRedirect = getRedirectUrl(getResponse, url);
    if (getRedirect) {
      return yield* followRedirects(getRedirect, hops + 1);
    }

    return url;
  });

export const LinkResolverServiceLive = Layer.succeed(
  LinkResolverService,
  LinkResolverService.of({
    resolve: (url) =>
      Effect.gen(function* () {
        const resolvedUrl = yield* Effect.gen(function* () {
          if (isKikCatUrl(url)) {
            const expandedEither = yield* resolveKikCatViaYourls(url).pipe(
              Effect.either,
            );

            if (expandedEither._tag === "Right" && expandedEither.right) {
              return {
                url: expandedEither.right,
                error: undefined,
              };
            }

            if (expandedEither._tag === "Left") {
              yield* Effect.logWarning("LinkResolver.yourls expand failed").pipe(
                Effect.annotateLogs({ url, error: expandedEither.left.message }),
              );
            }
          }

          return yield* followRedirects(url, 0).pipe(
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
        });

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
