import { Effect, Layer, Context, Scope, Ref, Option, Fiber, Schedule } from "effect";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLAYWRIGHT_TIMEOUT = 120_000;
const DEFAULT_POOL_SIZE = 50;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_USES = 500;
const CLEANUP_INTERVAL_MS = 30_000; // Check for idle browsers every 30s

const pagesWithRouteHandler = new WeakSet<Page>();

export class BrowserError extends Error {
  readonly _tag = "BrowserError";
}

export interface StealthSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
}

export interface BrowserSlot {
  id: number;
  browser: Browser;
  useCount: number;
  lastUsedAt: number;
  inUse: boolean;
}

export interface BrowserPoolState {
  slots: Map<number, BrowserSlot>;
  maxSize: number;
  idleTimeoutMs: number;
  maxUses: number;
  nextSlotId: number;
}

const isBrowserCrashError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes("Target closed") ||
    msg.includes("Browser closed") ||
    msg.includes("Context closed") ||
    msg.includes("Page closed") ||
    msg.includes("browser has been closed") ||
    msg.includes("Protocol error")
  );
};

export interface BrowserService {
  readonly createBrowserScoped: () => Effect.Effect<
    Browser,
    BrowserError,
    Scope.Scope
  >;
  readonly createLocalBrowserScoped: () => Effect.Effect<
    Browser,
    BrowserError,
    Scope.Scope
  >;
  readonly abortExtraResources: (
    page: Page,
  ) => Effect.Effect<void, BrowserError>;
  readonly withPersistentStealthPage: <A, E, R>(
    use: (page: Page) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | BrowserError, R>;
  readonly withPooledBrowserPage: <A, E, R>(
    use: (page: Page) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | BrowserError, R>;
  readonly resizePool: (size: number) => Effect.Effect<void, never>;
  readonly getPoolStats: () => Effect.Effect<{
    totalSlots: number;
    inUse: number;
    idle: number;
    maxSize: number;
  }, never>;
}

export const BrowserService =
  Context.GenericTag<BrowserService>("BrowserService");

const logBrowser = (message: string) =>
  Effect.logInfo(message).pipe(Effect.annotateLogs({ service: "Browser" }));

const logBrowserDebug = (message: string) =>
  Effect.logDebug(message).pipe(Effect.annotateLogs({ service: "Browser" }));

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

const makeBrowser = (): Effect.Effect<Browser, BrowserError> =>
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
      yield* logBrowserDebug("Launched local headful Chromium for pool");
      return browser;
    }

    const wsEndpoint = process.env.BRD_WSENDPOINT;
    if (!wsEndpoint) {
      return yield* Effect.fail(
        new BrowserError("BRD_WSENDPOINT is not available in env"),
      );
    }

    yield* logBrowserDebug(`Attempting CDP connection to: ${wsEndpoint}`);
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
    yield* logBrowserDebug("Connected to Bright Data for pool");
    return browser;
  });

const closeBrowserSafe = (browser: Browser): Effect.Effect<void, never> =>
  Effect.promise(() => browser.close()).pipe(
    Effect.catchAll((e) => logBrowserError("Error closing browser", e)),
  );

export const BrowserServiceLive = Layer.scoped(
  BrowserService,
  Effect.gen(function* () {
    const sessionRef = yield* Ref.make<Option.Option<StealthSession>>(
      Option.none(),
    );
    const stealthLock = yield* Effect.makeSemaphore(1);

    const poolStateRef = yield* Ref.make<BrowserPoolState>({
      slots: new Map(),
      maxSize: DEFAULT_POOL_SIZE,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      maxUses: DEFAULT_MAX_USES,
      nextSlotId: 0,
    });
    const poolLock = yield* Effect.makeSemaphore(1);

    const closeSlot = (slot: BrowserSlot): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* logBrowserDebug(`Closing pool slot ${slot.id}`);
        yield* closeBrowserSafe(slot.browser);
      });

    const cleanupIdleBrowsers = (): Effect.Effect<void, never> =>
      poolLock.withPermits(1)(
        Effect.gen(function* () {
          const state = yield* Ref.get(poolStateRef);
          const now = Date.now();
          const toClose: BrowserSlot[] = [];

          for (const [id, slot] of state.slots) {
            if (!slot.inUse && now - slot.lastUsedAt > state.idleTimeoutMs) {
              toClose.push(slot);
              state.slots.delete(id);
            }
          }

          if (toClose.length > 0) {
            yield* logBrowser(`Cleaning up ${toClose.length} idle browser(s)`);
            yield* Effect.all(toClose.map(closeSlot), { concurrency: 5 });
          }
        }),
      );

    const cleanupFiber = yield* Effect.fork(
      cleanupIdleBrowsers().pipe(
        Effect.repeat(Schedule.fixed(CLEANUP_INTERVAL_MS)),
      ),
    );

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Fiber.interrupt(cleanupFiber);

        const poolState = yield* Ref.get(poolStateRef);
        const allSlots = Array.from(poolState.slots.values());
        if (allSlots.length > 0) {
          yield* logBrowser(`Closing ${allSlots.length} pooled browser(s)`);
          yield* Effect.all(allSlots.map(closeSlot), { concurrency: 5 });
        }

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

    const acquirePooledBrowser = (): Effect.Effect<BrowserSlot, BrowserError> =>
      poolLock.withPermits(1)(
        Effect.gen(function* () {
          const state = yield* Ref.get(poolStateRef);

          for (const [, slot] of state.slots) {
            if (!slot.inUse) {
              if (slot.useCount >= state.maxUses) {
                yield* logBrowserDebug(`Slot ${slot.id} reached max uses, recycling`);
                state.slots.delete(slot.id);
                yield* closeBrowserSafe(slot.browser);
                continue;
              }

              const isAlive = yield* Effect.sync(() => {
                try {
                  slot.browser.contexts();
                  return true;
                } catch {
                  return false;
                }
              });

              if (!isAlive) {
                yield* logBrowserDebug(`Slot ${slot.id} is dead, removing`);
                state.slots.delete(slot.id);
                continue;
              }

              slot.inUse = true;
              slot.useCount++;
              slot.lastUsedAt = Date.now();
              return slot;
            }
          }

          if (state.slots.size >= state.maxSize) {
            return yield* Effect.fail(
              new BrowserError("Browser pool exhausted"),
            );
          }

          const browser = yield* makeBrowser();
          const slotId = state.nextSlotId++;
          const newSlot: BrowserSlot = {
            id: slotId,
            browser,
            useCount: 1,
            lastUsedAt: Date.now(),
            inUse: true,
          };
          state.slots.set(slotId, newSlot);
          yield* logBrowserDebug(`Created new pool slot ${slotId} (${state.slots.size}/${state.maxSize})`);
          return newSlot;
        }),
      );

    const releasePooledBrowser = (
      slot: BrowserSlot,
      crashed: boolean,
    ): Effect.Effect<void, never> =>
      poolLock.withPermits(1)(
        Effect.gen(function* () {
          const state = yield* Ref.get(poolStateRef);
          const existing = state.slots.get(slot.id);
          if (!existing) return;

          if (crashed) {
            yield* logBrowserDebug(`Slot ${slot.id} crashed, removing from pool`);
            state.slots.delete(slot.id);
            yield* closeBrowserSafe(slot.browser);
          } else {
            existing.inUse = false;
            existing.lastUsedAt = Date.now();
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
        stealthLock.withPermits(1)(
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
                const isPlaywrightError = isBrowserCrashError(error);

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

      withPooledBrowserPage: <A, E, R>(
        use: (page: Page) => Effect.Effect<A, E, R>,
      ): Effect.Effect<A, E | BrowserError, R> =>
        Effect.gen(function* () {
          const slot = yield* acquirePooledBrowser();
          let crashed = false;

          const result = yield* Effect.scoped(
            Effect.gen(function* () {
              const page = yield* Effect.acquireRelease(
                Effect.tryPromise({
                  try: () => slot.browser.newPage(),
                  catch: (e) =>
                    new BrowserError(
                      `Failed to create page: ${e instanceof Error ? e.message : String(e)}`,
                    ),
                }),
                (p) =>
                  Effect.promise(() => p.close()).pipe(
                    Effect.catchAll((e) =>
                      logBrowserError("Error closing pooled page", e),
                    ),
                  ),
              );

              return yield* use(page);
            }),
          ).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                if (isBrowserCrashError(error)) {
                  yield* logBrowserDebug(`Browser crash detected in slot ${slot.id}`);
                  crashed = true;
                }
                return yield* Effect.fail(error as E | BrowserError);
              }),
            ),
          );

          yield* releasePooledBrowser(slot, crashed);
          return result;
        }),

      resizePool: (size: number): Effect.Effect<void, never> =>
        poolLock.withPermits(1)(
          Effect.gen(function* () {
            const state = yield* Ref.get(poolStateRef);
            const oldSize = state.maxSize;
            state.maxSize = Math.max(1, size);
            yield* logBrowser(`Pool resized: ${oldSize} -> ${state.maxSize}`);

            if (state.slots.size > state.maxSize) {
              const toClose: BrowserSlot[] = [];
              for (const [id, slot] of state.slots) {
                if (!slot.inUse && state.slots.size - toClose.length > state.maxSize) {
                  toClose.push(slot);
                  state.slots.delete(id);
                }
              }
              if (toClose.length > 0) {
                yield* Effect.all(toClose.map(closeSlot), { concurrency: 5 });
              }
            }
          }),
        ),

      getPoolStats: (): Effect.Effect<{
        totalSlots: number;
        inUse: number;
        idle: number;
        maxSize: number;
      }, never> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(poolStateRef);
          let inUse = 0;
          let idle = 0;
          for (const slot of state.slots.values()) {
            if (slot.inUse) inUse++;
            else idle++;
          }
          return {
            totalSlots: state.slots.size,
            inUse,
            idle,
            maxSize: state.maxSize,
          };
        }),
    });
  }),
);
