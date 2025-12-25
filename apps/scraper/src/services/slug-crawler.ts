import { Effect, Layer, Context } from "effect";
import { chromium, Page, Browser, BrowserContext } from "playwright";
import { generateDeviceId } from "@repo/scraper-domain/server";
import { DeviceDiscoveryService, DeviceDiscoveryError } from "./device-discovery";
import { DeviceRegistryService, DeviceRegistryError } from "./device-registry";
import { inferBrand, isValidChildPrefix, isPrefixWorthExpanding } from "./kimovil/slug-logic";

const MAX_RESULTS_THRESHOLD = 8;
const REQUEST_DELAY_MS = 600;
const REQUEST_JITTER_MS = 400;
const MAX_RETRIES = 5;
const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789 -".split("");

export class SlugCrawlerError extends Error {
  readonly _tag = "SlugCrawlerError";
}

interface AutocompleteItem {
  full_name: string;
  url: string;
  is_rumor: boolean;
  result_type?: string;
}

interface AutocompleteResponse {
  results: AutocompleteItem[];
}

export interface SlugCrawlerService {
  readonly runFullCrawl: () => Effect.Effect<
    void,
    SlugCrawlerError | DeviceDiscoveryError | DeviceRegistryError
  >;
  readonly getCrawlStats: () => Effect.Effect<
    { devices: number; pendingPrefixes: number },
    DeviceDiscoveryError | DeviceRegistryError
  >;
}

export const SlugCrawlerService =
  Context.GenericTag<SlugCrawlerService>("SlugCrawlerService");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomJitter = () => Math.random() * REQUEST_JITTER_MS;

const getSmartChildPrefixes = (
  prefix: string,
  results: AutocompleteItem[],
): string[] => {
  const lowerPrefix = prefix.toLowerCase();

  // Filter to results that actually start with the prefix
  const startingWithPrefix = results
    .map((r) => r.full_name.toLowerCase())
    .filter((name) => name.startsWith(lowerPrefix));

  // If nothing starts with the prefix, no signal - return empty to trigger fallback
  if (startingWithPrefix.length === 0) {
    return [];
  }

  // Collect the actual next characters observed after the prefix
  const nextChars = new Set<string>();

  for (const name of startingWithPrefix) {
    if (name.length > lowerPrefix.length) {
      const nextChar = name[lowerPrefix.length];
      if (nextChar && CHARSET.includes(nextChar)) {
        nextChars.add(nextChar);
      }
    }
  }

  // If no valid next chars found, return empty
  if (nextChars.size === 0) {
    return [];
  }

  const children: string[] = [];
  for (const ch of nextChars) {
    const child = prefix + ch;
    if (isValidChildPrefix(child)) {
      children.push(child);
    }
  }

  return children;
};

export const SlugCrawlerServiceLive = Layer.effect(
  SlugCrawlerService,
  Effect.gen(function* () {
    const discoveryService = yield* DeviceDiscoveryService;
    const deviceRegistry = yield* DeviceRegistryService;

    // In-memory cache of known slugs to detect new devices
    const knownSlugs = new Set<string>();

    const loadKnownSlugs = (): Effect.Effect<void, DeviceRegistryError> =>
      Effect.gen(function* () {
        const kimovilDevices = yield* deviceRegistry.getDevicesBySource("kimovil");
        for (const d of kimovilDevices) {
          knownSlugs.add(d.slug);
        }
        yield* Effect.logInfo(`Loaded ${knownSlugs.size} known slugs into memory`).pipe(
          Effect.annotateLogs({ service: "Crawler" }),
        );
      });

    const fetchAutocompleteWithRetry = async (
      page: Page,
      prefix: string,
    ): Promise<AutocompleteItem[]> => {
      const url = `https://www.kimovil.com/_json/autocomplete_devicemodels_joined.json?device_type=0&name=${encodeURIComponent(prefix)}`;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await page.evaluate(async (apiUrl: string) => {
            const res = await fetch(apiUrl);
            const text = await res.text();
            return { status: res.status, text, ok: res.ok };
          }, url);

          if (response.status === 429 || !response.ok) {
            const backoffMs = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
            console.log(`[Crawler] Rate limited (${response.status}), waiting ${backoffMs / 1000}s...`);
            await sleep(backoffMs);
            continue;
          }

          try {
            const data = JSON.parse(response.text) as AutocompleteResponse;
            return data.results || [];
          } catch {
            console.log(`[Crawler] Invalid JSON for "${prefix}", retrying...`);
            await sleep(2000);
            continue;
          }
        } catch (error) {
          if (attempt === MAX_RETRIES) throw error;
          await sleep(5000 * attempt);
        }
      }

      throw new Error(`Failed after ${MAX_RETRIES} retries`);
    };

    const processPrefix = (
      page: Page,
      prefix: string,
      depth: number,
    ): Effect.Effect<
      { total: number; newDevices: number },
      SlugCrawlerError | DeviceDiscoveryError | DeviceRegistryError
    > =>
      Effect.gen(function* () {
        const results = yield* Effect.tryPromise({
          try: () => fetchAutocompleteWithRetry(page, prefix),
          catch: (error) =>
            new SlugCrawlerError(
              `Failed to fetch autocomplete for "${prefix}": ${error instanceof Error ? error.message : String(error)}`,
            ),
        });

        let newDevices = 0;
        const newlyAdded: { id: string; name: string }[] = [];

        for (const item of results) {
          const slug = item.url;
          const name = item.full_name;
          const brand = inferBrand(name);

          const isNew = !knownSlugs.has(slug);
          if (isNew) {
            knownSlugs.add(slug);
            newDevices++;
            const id = generateDeviceId(slug);
            newlyAdded.push({ id, name });
          }

          const device = yield* deviceRegistry.createDevice({ slug, name, brand });
          yield* deviceRegistry.linkDeviceToSource({
            deviceId: device.id,
            source: "kimovil",
            externalId: slug,
          });
        }

        if (newlyAdded.length > 0) {
          yield* Effect.logInfo(`Found ${newlyAdded.length} new device(s)`).pipe(
            Effect.annotateLogs({ service: "Crawler", devices: newlyAdded.map((d) => `[${d.id}] ${d.name}`).join(", ") }),
          );
        }

        const count = results.length;

        // Expand if we got max results (could be more) and prefix passes heuristic checks
        const shouldExpand =
          count >= MAX_RESULTS_THRESHOLD &&
          isPrefixWorthExpanding(prefix, depth);

        if (shouldExpand) {
          // Use smart expansion: derive child prefixes from actual result names
          const smartChildren = getSmartChildPrefixes(prefix, results);

          if (smartChildren.length > 0) {
            // Prefer result-driven children - much fewer than blind 38-char expansion
            for (const child of smartChildren) {
              const childDepth = child.length;
              if (isPrefixWorthExpanding(child, childDepth)) {
                yield* discoveryService.enqueueQuery("kimovil", child, childDepth);
              }
            }
          } else {
            // Fallback: blind expansion when results don't give structure
            for (const c of CHARSET) {
              const child = prefix + c;
              const childDepth = child.length;
              if (
                isValidChildPrefix(child) &&
                isPrefixWorthExpanding(child, childDepth)
              ) {
                yield* discoveryService.enqueueQuery("kimovil", child, childDepth);
              }
            }
          }
        }

        yield* discoveryService.completeQuery("kimovil", prefix, count);

        return { total: count, newDevices };
      });

    const launchStealthBrowser = async (): Promise<{
      browser: Browser;
      context: BrowserContext;
      page: Page;
    }> => {
      const browser = await chromium.launch({
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      const page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });

      console.log("[Crawler] Visiting main site to pass CF challenge...");
      await page.goto("https://www.kimovil.com/en/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page
        .waitForSelector("input, .search, [data-search]", { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(2000);
      console.log("[Crawler] CF challenge passed, ready to crawl");

      return { browser, context, page };
    };

    return {
      runFullCrawl: () =>
        Effect.gen(function* () {
          // Load existing slugs into memory for deduplication
          yield* loadKnownSlugs();

          const pendingCount = yield* discoveryService.getPendingCount("kimovil");
          if (pendingCount === 0) {
            yield* Effect.logInfo("No pending prefixes, seeding initial...").pipe(
              Effect.annotateLogs({ service: "Crawler" }),
            );
            // Seed initial 2-char prefixes for Kimovil
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
            for (const c1 of chars) {
              for (const c2 of chars) {
                yield* discoveryService.enqueueQuery("kimovil", c1 + c2, 2);
              }
            }
            yield* Effect.logInfo(`Seeded ${chars.length * chars.length} initial prefixes`).pipe(
              Effect.annotateLogs({ service: "Crawler" }),
            );
          }

          const { browser, page } = yield* Effect.tryPromise({
            try: () => launchStealthBrowser(),
            catch: (error) =>
              new SlugCrawlerError(
                `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
              ),
          });

          let processed = 0;
          let totalNewDevices = 0;

          const crawlLoop = Effect.gen(function* () {
            while (true) {
              const nextQuery = yield* discoveryService.getNextPendingQuery("kimovil");
              if (!nextQuery) {
                yield* Effect.logInfo("No more pending prefixes, done!").pipe(
                  Effect.annotateLogs({ service: "Crawler" }),
                );
                break;
              }

              const { query: prefix, depth } = nextQuery;
              const pendingLeft = yield* discoveryService.getPendingCount("kimovil");

              process.stdout.write(
                `\r[Crawler] "${prefix}" (d${depth}) | ${processed} done, ${pendingLeft} pending, ${knownSlugs.size} devices, +${totalNewDevices} new   `,
              );

              const { newDevices } = yield* processPrefix(page, prefix, depth);
              processed++;
              totalNewDevices += newDevices;

              yield* Effect.promise(() =>
                sleep(REQUEST_DELAY_MS + randomJitter()),
              );
            }

            yield* Effect.logInfo(
              `Finished! Processed ${processed} prefixes, found ${knownSlugs.size} total devices (+${totalNewDevices} new this session)`,
            ).pipe(Effect.annotateLogs({ service: "Crawler" }));
          });

          yield* Effect.ensuring(
            crawlLoop,
            Effect.promise(() => browser.close()),
          );
        }),

      getCrawlStats: () =>
        Effect.gen(function* () {
          const devices = yield* deviceRegistry.getDeviceCount();
          const pendingPrefixes = yield* discoveryService.getPendingCount("kimovil");
          return { devices, pendingPrefixes };
        }),
    };
  }),
);
