import { Effect, Layer, Context, Scope } from "effect";
import { chromium, Browser, Page } from "playwright";

const PLAYWRIGHT_TIMEOUT = 120_000;

export class BrowserError extends Error {
  readonly _tag = "BrowserError";
}

export interface BrowserService {
  /** @deprecated Prefer createBrowserScoped for automatic cleanup */
  readonly createBrowser: () => Effect.Effect<Browser, BrowserError>;
  /** @deprecated Prefer createLocalBrowserScoped for automatic cleanup */
  readonly createLocalBrowser: () => Effect.Effect<Browser, BrowserError>;
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
}

export const BrowserService =
  Context.GenericTag<BrowserService>("BrowserService");

const logBrowser = (message: string) =>
  Effect.logInfo(message).pipe(Effect.annotateLogs({ service: "Browser" }));

const logBrowserError = (message: string, error: unknown) =>
  Effect.logError(`${message}: ${error}`).pipe(
    Effect.annotateLogs({ service: "Browser" }),
  );

export const BrowserServiceLive = Layer.succeed(
  BrowserService,
  BrowserService.of({
    createBrowser: () =>
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
          yield* logBrowser("Launched local headful Chromium");
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
        yield* logBrowser("Connected to Bright Data scraping browser");
        return browser;
      }),

    createLocalBrowser: () =>
      Effect.gen(function* () {
        const browser = yield* Effect.tryPromise({
          try: () => chromium.launch({ headless: true }),
          catch: (error) =>
            new BrowserError(
              `Failed to create local browser: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });
        yield* logBrowser("Launched local headless Chromium (for cache parsing)");
        return browser;
      }),

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
            Effect.catchAll((e) => logBrowserError("Error closing browser", e)),
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

    abortExtraResources: (page: Page) =>
      Effect.tryPromise({
        try: async () => {
          await page.route("**/*", (route) => {
            const resourceType = route.request().resourceType();
            // Only allow document type (HTML), abort everything else
            return resourceType !== "document"
              ? route.abort()
              : route.continue();
          });
        },
        catch: (error) =>
          new BrowserError(
            `Failed to set up resource abort: ${error instanceof Error ? error.message : String(error)}`,
          ),
      }),
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
