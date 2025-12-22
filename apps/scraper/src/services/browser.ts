import { Effect, Layer, Context, Scope, Ref, Option } from "effect";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLAYWRIGHT_TIMEOUT = 120_000;

const pagesWithRouteHandler = new WeakSet<Page>();

export class BrowserError extends Error {
  readonly _tag = "BrowserError";
}

export interface StealthSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
}

export interface BrowserService {
  /** Scoped browser with automatic cleanup on scope close */
  readonly createBrowserScoped: () => Effect.Effect<
    Browser,
    BrowserError,
    Scope.Scope
  >;
  /** Scoped local browser with automatic cleanup on scope close */
  readonly createLocalBrowserScoped: () => Effect.Effect<
    Browser,
    BrowserError,
    Scope.Scope
  >;
  readonly abortExtraResources: (
    page: Page,
  ) => Effect.Effect<void, BrowserError>;
  /** Use a persistent stealth browser page with exclusive access */
  readonly withPersistentStealthPage: <A, E, R>(
    use: (page: Page) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | BrowserError, R>;
}

export const BrowserService =
  Context.GenericTag<BrowserService>("BrowserService");

const logBrowser = (message: string) =>
  Effect.logInfo(message).pipe(Effect.annotateLogs({ service: "Browser" }));

const logBrowserError = (message: string, error: unknown) =>
  Effect.logError(`${message}: ${error}`).pipe(
    Effect.annotateLogs({ service: "Browser" }),
  );

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const YANDEX_COOKIES_PATH =
  process.env.YANDEX_COOKIES_PATH ||
  join(__dirname, "../../yandex-cookies.json");

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

const loadYandexCookies = (): Effect.Effect<PlaywrightCookie[], never, never> =>
  Effect.gen(function* () {
    if (!existsSync(YANDEX_COOKIES_PATH)) {
      yield* Effect.logDebug("Yandex cookies file not found, continuing without").pipe(
        Effect.annotateLogs({ path: YANDEX_COOKIES_PATH }),
      );
      return [];
    }

    try {
      const content = readFileSync(YANDEX_COOKIES_PATH, "utf-8");
      const cookies: PlaywrightCookie[] = JSON.parse(content);
      // Filter to only yandex.ru and market.yandex.ru domains
      const filtered = cookies.filter(
        (c) =>
          c.domain.endsWith("yandex.ru") &&
          (c.domain.includes("market") || c.domain === ".yandex.ru" || c.domain === "yandex.ru"),
      );
      return filtered;
    } catch (e) {
      yield* Effect.logWarning("Failed to parse Yandex cookies file").pipe(
        Effect.annotateLogs({ path: YANDEX_COOKIES_PATH, error: e }),
      );
      return [];
    }
  });

const initStealthSession: Effect.Effect<StealthSession, BrowserError> =
  Effect.gen(function* () {
    yield* logBrowser("Launching stealth browser...");

    const browser = yield* Effect.tryPromise({
      try: () =>
        chromium.launch({
          headless: true,
          args: ["--disable-blink-features=AutomationControlled"],
        }),
      catch: (error) =>
        new BrowserError(
          `Failed to launch stealth browser: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });

    return yield* Effect.gen(function* () {
      const context = yield* Effect.tryPromise({
        try: () => browser.newContext({ userAgent: CHROME_USER_AGENT }),
        catch: (error) =>
          new BrowserError(
            `Failed to create stealth context: ${error instanceof Error ? error.message : String(error)}`,
          ),
      });

      // Load Yandex cookies if available
      const yandexCookies = yield* loadYandexCookies();
      if (yandexCookies.length > 0) {
        yield* Effect.tryPromise({
          try: () => context.addCookies(yandexCookies),
          catch: (error) =>
            new BrowserError(
              `Failed to add Yandex cookies: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });
        yield* logBrowser(`Loaded ${yandexCookies.length} Yandex cookies`);
      }

      const page = yield* Effect.tryPromise({
        try: () => context.newPage(),
        catch: (error) =>
          new BrowserError(
            `Failed to create stealth page: ${error instanceof Error ? error.message : String(error)}`,
          ),
      });

      yield* Effect.tryPromise({
        try: () =>
          page.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", {
              get: () => undefined,
            });
          }),
        catch: (error) =>
          new BrowserError(
            `Failed to add init script: ${error instanceof Error ? error.message : String(error)}`,
          ),
      });

      yield* Effect.tryPromise({
        try: () =>
          page.goto("https://www.kimovil.com/en/", {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          }),
        catch: (error) =>
          new BrowserError(
            `Failed to navigate to kimovil: ${error instanceof Error ? error.message : String(error)}`,
          ),
      });

      yield* logBrowser("Stealth browser initialized and navigated to kimovil");

      return { browser, context, page } satisfies StealthSession;
    }).pipe(
      Effect.catchAll((error) =>
        Effect.tryPromise(() => browser.close()).pipe(
          Effect.ignore,
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );
  });

export const BrowserServiceLive = Layer.scoped(
  BrowserService,
  Effect.gen(function* () {
    const sessionRef = yield* Ref.make<Option.Option<StealthSession>>(
      Option.none(),
    );
    const lock = yield* Effect.makeSemaphore(1);

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        const maybeSession = yield* Ref.get(sessionRef);
        if (Option.isSome(maybeSession)) {
          const session = maybeSession.value;
          yield* Effect.promise(() => session.context.close()).pipe(
            Effect.catchAll((e) =>
              logBrowserError("Error closing stealth context", e),
            ),
          );
          yield* Effect.promise(() => session.browser.close()).pipe(
            Effect.catchAll((e) =>
              logBrowserError("Error closing stealth browser", e),
            ),
          );
          yield* logBrowser("Closed persistent stealth browser");
        }
      }),
    );

    return BrowserService.of({
      createBrowserScoped: () =>
        Effect.acquireRelease(
          Effect.gen(function* () {
            const useLocal =
              (process.env.LOCAL_PLAYWRIGHT ?? "").toLowerCase() === "true";
            if (useLocal) {
              const browser = yield* Effect.tryPromise({
                try: () => chromium.launch({ headless: false }),
                catch: (error) =>
                  new BrowserError(
                    `Failed to create browser: ${error instanceof Error ? error.message : String(error)}`,
                  ),
              });
              yield* logBrowser("Launched local headful Chromium (scoped)");
              return browser;
            }

            const wsEndpoint = process.env.BRD_WSENDPOINT;
            if (!wsEndpoint) {
              return yield* Effect.fail(
                new BrowserError("BRD_WSENDPOINT is not available in env"),
              );
            }

            yield* logBrowser(`Attempting CDP connection to: ${wsEndpoint}`);
            const browser = yield* Effect.tryPromise({
              try: () =>
                chromium.connectOverCDP(wsEndpoint, {
                  timeout: PLAYWRIGHT_TIMEOUT,
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                  },
                }),
              catch: (error) =>
                new BrowserError(
                  `Failed to create browser: ${error instanceof Error ? error.message : String(error)}`,
                ),
            });
            yield* logBrowser("Connected to Bright Data (scoped)");
            return browser;
          }),
          (browser) =>
            Effect.promise(() => browser.close()).pipe(
              Effect.catchAll((e) =>
                logBrowserError("Error closing browser", e),
              ),
            ),
        ),

      createLocalBrowserScoped: () =>
        Effect.acquireRelease(
          Effect.gen(function* () {
            const browser = yield* Effect.tryPromise({
              try: () => chromium.launch({ headless: true }),
              catch: (error) =>
                new BrowserError(
                  `Failed to create local browser: ${error instanceof Error ? error.message : String(error)}`,
                ),
            });
            yield* logBrowser("Launched local headless Chromium (scoped)");
            return browser;
          }),
          (browser) =>
            Effect.promise(() => browser.close()).pipe(
              Effect.catchAll((e) =>
                logBrowserError("Error closing local browser", e),
              ),
            ),
        ),

      abortExtraResources: (page: Page) => {
        if (pagesWithRouteHandler.has(page)) {
          return Effect.void;
        }
        return Effect.tryPromise({
          try: async () => {
            await page.route("**/*", (route) => {
              const resourceType = route.request().resourceType();
              return resourceType !== "document"
                ? route.abort()
                : route.continue();
            });
            pagesWithRouteHandler.add(page);
          },
          catch: (error) =>
            new BrowserError(
              `Failed to set up resource abort: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });
      },

      withPersistentStealthPage: <A, E, R>(
        use: (page: Page) => Effect.Effect<A, E, R>,
      ): Effect.Effect<A, E | BrowserError, R> =>
        lock.withPermits(1)(
          Effect.gen(function* () {
            const maybeSession = yield* Ref.get(sessionRef);

            const session: StealthSession = Option.isSome(maybeSession)
              ? maybeSession.value
              : yield* Effect.gen(function* () {
                  const newSession = yield* initStealthSession;
                  yield* Ref.set(sessionRef, Option.some(newSession));
                  return newSession;
                });

            const result = yield* Effect.catchAll(use(session.page), (error) =>
              Effect.gen(function* () {
                const isBrowserError = error instanceof BrowserError;
                const isPlaywrightError =
                  error instanceof Error &&
                  (error.message.includes("Target closed") ||
                    error.message.includes("Browser closed") ||
                    error.message.includes("Context closed") ||
                    error.message.includes("Page closed"));

                if (isBrowserError || isPlaywrightError) {
                  yield* logBrowserError(
                    "Browser error detected, resetting session",
                    error,
                  );
                  yield* Effect.promise(() =>
                    session.browser.close(),
                  ).pipe(
                    Effect.catchAll((error) =>
                      Effect.logWarning("Browser close failed during reset").pipe(
                        Effect.annotateLogs({ error }),
                      ),
                    ),
                  );
                  yield* Ref.set(sessionRef, Option.none());
                }

                return yield* Effect.fail(error as E);
              }),
            );

            return result;
          }),
        ),
    });
  }),
);
