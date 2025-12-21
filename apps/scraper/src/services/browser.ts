import { Effect, Layer, Context, Scope, Ref, Option } from "effect";
import { chromium, Browser, BrowserContext, Page } from "playwright";

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
                  ).pipe(Effect.catchAll(() => Effect.void));
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

// Utility functions ported from old project
export const getCpuCores = (input: string | null): string[] | null => {
  if (!input) return null;

  // Split on ", " followed by digit (to avoid breaking decimal "2,9 Ghz")
  // or on " + " which is also used as separator
  const parts = input.split(/,\s+(?=\d)|\s+\+\s+/);
  const result: string[] = [];

  for (const part of parts) {
    const trimmedPart = part.replace(/\s/g, "").toLowerCase();
    if (!trimmedPart) continue;

    // Match patterns like "1x2,9ghz" or "4x2600mhz"
    const match = trimmedPart.match(/(\d)\s*x\s*[\d,\.]+\s*(?:ghz|mhz)/i);

    if (!match) continue;

    const count = parseInt(match[1], 10);
    // Extract frequency value
    const freqMatch = trimmedPart.match(/([\d,\.]+)\s*(ghz|mhz)/i);
    if (!freqMatch) continue;

    const frequency = parseFloat(freqMatch[1].replace(",", "."));
    const unit = freqMatch[2].toLowerCase();
    const frequencyInMhz = unit === "ghz" ? frequency * 1000 : frequency;

    result.push(`${count}x${frequencyInMhz}`);
  }

  return result.length > 0 ? result : null;
};

const monthMap: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const parseReleaseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const cleanDateString = dateString.trim().toLowerCase();
  const match = cleanDateString.match(/([a-z]+)\s+(\d{4})/i);
  if (!match) return null;

  const monthName = match[1];
  const year = parseInt(match[2], 10);

  const monthIndex = monthMap[monthName];
  if (monthIndex === undefined) return null;

  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
};
