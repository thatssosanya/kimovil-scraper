import { Effect, Layer, Context } from "effect";
import { chromium, Page, Browser, BrowserContext } from "playwright";
import { StorageService, StorageError } from "./storage";

const MAX_PREFIX_LENGTH = 12;
const MAX_RESULTS_THRESHOLD = 8;
const REQUEST_DELAY_MS = 600;
const REQUEST_JITTER_MS = 400;
const MAX_RETRIES = 5;
// Removed MIN_NEW_DEVICES_TO_EXPAND - expansion should be based on result count, not novelty
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
  readonly runFullCrawl: () => Effect.Effect<void, SlugCrawlerError | StorageError>;
  readonly getCrawlStats: () => Effect.Effect<
    { devices: number; pendingPrefixes: number },
    StorageError
  >;
}

export const SlugCrawlerService =
  Context.GenericTag<SlugCrawlerService>("SlugCrawlerService");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomJitter = () => Math.random() * REQUEST_JITTER_MS;

const inferBrand = (name: string): string | null => {
  const brands = [
    "Samsung", "Apple", "Xiaomi", "Redmi", "POCO", "OnePlus", "Huawei",
    "OPPO", "Vivo", "Realme", "Google", "Motorola", "Nokia", "Sony",
    "LG", "Asus", "ZTE", "Honor", "Lenovo", "Nothing", "Infinix",
    "Tecno", "TCL", "Meizu", "HTC", "Alcatel", "BlackBerry", "Doogee",
    "Ulefone", "Oukitel", "Cubot", "Umidigi", "Wiko", "BLU", "Micromax",
  ];
  const lowerName = name.toLowerCase();
  for (const brand of brands) {
    if (lowerName.startsWith(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
};

const isValidChildPrefix = (prefix: string): boolean => {
  if (prefix.startsWith(" ") || prefix.startsWith("-")) return false;
  if (prefix.includes("  ") || prefix.includes("--")) return false;
  if (prefix.endsWith("  ")) return false;
  if (prefix.includes(" -") || prefix.includes("- ")) return false;
  return true;
};

const isPrefixWorthExpanding = (prefix: string, depth: number): boolean => {
  if (depth >= MAX_PREFIX_LENGTH) return false;
  
  // Don't expand pure numeric prefixes beyond depth 3 (e.g., "123x")
  if (/^\d+$/.test(prefix) && depth > 3) return false;
  
  // Don't expand prefixes ending with space + short suffix
  if (/\s[a-z0-9]$/.test(prefix) && depth > 4) return false;
  
  // Don't expand if prefix has multiple spaces (model number patterns like "note 10 pro")
  if ((prefix.match(/ /g) || []).length >= 2) return false;
  
  return true;
};

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
    const storage = yield* StorageService;

    // In-memory cache of known slugs to detect new devices
    const knownSlugs = new Set<string>();

    const loadKnownSlugs = (): Effect.Effect<void, StorageError> =>
      Effect.gen(function* () {
        const devices = yield* storage.getAllDevices();
        for (const d of devices) {
          knownSlugs.add(d.slug);
        }
        console.log(`[Crawler] Loaded ${knownSlugs.size} known slugs into memory`);
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
            console.log(
              `\n[Crawler] Rate limited (${response.status}), waiting ${backoffMs / 1000}s...`,
            );
            await sleep(backoffMs);
            continue;
          }

          try {
            const data = JSON.parse(response.text) as AutocompleteResponse;
            return data.results || [];
          } catch {
            console.log(`\n[Crawler] Invalid JSON for "${prefix}", retrying...`);
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
    ): Effect.Effect<{ total: number; newDevices: number }, SlugCrawlerError | StorageError> =>
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
          const isRumor = item.is_rumor ?? false;

          const isNew = !knownSlugs.has(slug);
          if (isNew) {
            knownSlugs.add(slug);
            newDevices++;
            // Generate same hash as storage uses
            const hasher = new Bun.CryptoHasher("sha256");
            hasher.update(slug);
            const id = hasher.digest("hex").slice(0, 16);
            newlyAdded.push({ id, name });
          }

          yield* storage.upsertDevice({
            slug,
            name,
            brand,
            isRumor,
            raw: JSON.stringify(item),
          });
        }

        if (newlyAdded.length > 0) {
          console.log(`\n  + Found ${newlyAdded.length} new device(s):`);
          for (const d of newlyAdded) {
            console.log(`    [${d.id}] ${d.name}`);
          }
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
                yield* storage.enqueuePrefix(child, childDepth);
              }
            }
          } else {
            // Fallback: blind expansion when results don't give structure
            for (const c of CHARSET) {
              const child = prefix + c;
              const childDepth = child.length;
              if (isValidChildPrefix(child) && isPrefixWorthExpanding(child, childDepth)) {
                yield* storage.enqueuePrefix(child, childDepth);
              }
            }
          }
        }

        yield* storage.markPrefixDone(prefix, count);

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

          const pendingCount = yield* storage.getPendingPrefixCount();
          if (pendingCount === 0) {
            console.log("[Crawler] No pending prefixes, seeding initial...");
            yield* storage.seedInitialPrefixes();
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
              const nextPrefix = yield* storage.getNextPendingPrefix();
              if (!nextPrefix) {
                console.log("\n[Crawler] No more pending prefixes, done!");
                break;
              }

              const { prefix, depth } = nextPrefix;
              const pendingLeft = yield* storage.getPendingPrefixCount();

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

            console.log(
              `\n[Crawler] Finished! Processed ${processed} prefixes, found ${knownSlugs.size} total devices (+${totalNewDevices} new this session)`,
            );
          });

          yield* Effect.ensuring(
            crawlLoop,
            Effect.promise(() => browser.close()),
          );
        }),

      getCrawlStats: () =>
        Effect.gen(function* () {
          const devices = yield* storage.getDeviceCount();
          const pendingPrefixes = yield* storage.getPendingPrefixCount();
          return { devices, pendingPrefixes };
        }),
    };
  }),
);
