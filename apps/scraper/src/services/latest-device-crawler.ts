import { Effect, Layer, Context, Data } from "effect";
import { Page } from "playwright";
import { BrowserService, BrowserError } from "./browser";
import { DeviceRegistryService, DeviceRegistryError } from "./device-registry";
import { JobQueueService, JobQueueError } from "./job-queue";
import { EntityDataService, EntityDataError } from "./entity-data";
import { inferBrand } from "./kimovil/slug-logic";

export class LatestDeviceCrawlerError extends Data.TaggedError("LatestDeviceCrawlerError")<{
  message: string;
  cause?: unknown;
}> {}

export interface CrawlOptions {
  maxPages?: number; // Default: 20
  minPages?: number; // Minimum pages to scan before stop condition applies (default: 5)
  stopAfterKnown?: number; // Stop after N consecutive known devices (default: 50)
  dryRun?: boolean; // Report only, don't modify DB
  jobId?: string; // Parent job ID for queued items
}

export interface CrawlResult {
  discovered: number;
  alreadyKnown: number;
  alreadyScraped: number;
  queued: number;
  pagesScanned: number;
}

interface DiscoveredDevice {
  slug: string;
  name: string;
}

export interface LatestDeviceCrawlerService {
  readonly crawl: (options?: CrawlOptions) => Effect.Effect<CrawlResult, LatestDeviceCrawlerError>;
}

export const LatestDeviceCrawlerService =
  Context.GenericTag<LatestDeviceCrawlerService>("LatestDeviceCrawlerService");

const extractDevices = (page: Page): Effect.Effect<DiscoveredDevice[], BrowserError> =>
  Effect.tryPromise({
    try: () =>
      page.$$eval("a.device-link", (els) =>
        els
          .map((el) => {
            const href = el.getAttribute("href") || "";
            const match = href.match(/\/where-to-buy-(.+)$/);
            const slug = match?.[1];
            // Extract from .title div (clean name without region suffix)
            const titleEl = el.querySelector(".title");
            const name = titleEl?.textContent?.trim() || slug || "";
            return { slug, name };
          })
          .filter(
            (d): d is { slug: string; name: string } =>
              d.slug != null &&
              d.name.length > 0 &&
              !/-\d+gb-\d+gb$/i.test(d.slug),
          ),
      ),
    catch: (e) => new BrowserError(`Failed to extract devices: ${e}`),
  }).pipe(
    Effect.map((devices) => {
      const seen = new Set<string>();
      return devices.filter((d) => {
        if (seen.has(d.slug)) return false;
        seen.add(d.slug);
        return true;
      });
    }),
  );

type RegisterResult = "queued" | "already_scraped";

const registerAndQueue = (
  registry: DeviceRegistryService,
  jobQueue: JobQueueService,
  entityData: EntityDataService,
  device: DiscoveredDevice,
  jobId?: string,
): Effect.Effect<RegisterResult, DeviceRegistryError | JobQueueError | EntityDataError> =>
  Effect.gen(function* () {
    const existingLinked = yield* registry.lookupDevice("kimovil", device.slug);
    if (existingLinked) {
      const hasData = yield* entityData.getFinalData(existingLinked.id, "specs");
      if (hasData) {
        return "already_scraped";
      }
      yield* jobQueue.queueScrape(device.slug, existingLinked.id, "fast", {
        source: "kimovil",
        dataKind: "specs",
        jobId: jobId ?? null,
      });
      return "queued";
    }

    const existingDevice = yield* registry.getDeviceBySlug(device.slug);
    if (existingDevice) {
      const hasData = yield* entityData.getFinalData(existingDevice.id, "specs");
      if (hasData) {
        yield* registry.linkDeviceToSource({
          deviceId: existingDevice.id,
          source: "kimovil",
          externalId: device.slug,
          metadata: { discovered_via: "latest_crawler" },
        });
        return "already_scraped";
      }
    }

    const deviceId = existingDevice
      ? existingDevice.id
      : (yield* registry.createDevice({
          slug: device.slug,
          name: device.name,
          brand: inferBrand(device.name),
        })).id;

    yield* registry.linkDeviceToSource({
      deviceId,
      source: "kimovil",
      externalId: device.slug,
      metadata: { discovered_via: "latest_crawler" },
    });

    yield* jobQueue.queueScrape(device.slug, deviceId, "fast", {
      source: "kimovil",
      dataKind: "specs",
      jobId: jobId ?? null,
    });
    return "queued";
  });

const fetchPageWithFreshBrowser = (
  browserService: BrowserService,
  pageNum: number,
): Effect.Effect<DiscoveredDevice[], LatestDeviceCrawlerError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const url = `https://www.kimovil.com/en/compare-smartphones/order.dm+unveiledDate,page.${pageNum}`;

      // Each page gets a fresh browser with unique session ID to avoid Bright Data navigation limits
      const browser = yield* browserService.createBrowserScoped().pipe(
        Effect.mapError((e) => new LatestDeviceCrawlerError({ message: e.message, cause: e })),
      );

      const page = yield* Effect.tryPromise({
        try: () => browser.newPage(),
        catch: (e) => new LatestDeviceCrawlerError({ message: `Failed to create page: ${e}` }),
      });

      yield* browserService.abortExtraResources(page).pipe(
        Effect.mapError((e) => new LatestDeviceCrawlerError({ message: e.message, cause: e })),
      );

      yield* Effect.tryPromise({
        try: () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
        catch: (e) => new LatestDeviceCrawlerError({ message: `Navigation failed: ${e}` }),
      });

      yield* Effect.tryPromise({
        try: () => page.waitForSelector("a.device-link", { timeout: 10000 }),
        catch: (e) => new LatestDeviceCrawlerError({ message: `waitForSelector failed: ${e}` }),
      }).pipe(Effect.catchAll(() => Effect.void));

      return yield* extractDevices(page).pipe(
        Effect.mapError((e) => new LatestDeviceCrawlerError({ message: e.message, cause: e })),
      );
    }),
  );

const crawlImpl = (
  browserService: BrowserService,
  registry: DeviceRegistryService,
  jobQueue: JobQueueService,
  entityData: EntityDataService,
  options: CrawlOptions = {},
): Effect.Effect<CrawlResult, LatestDeviceCrawlerError> =>
  Effect.gen(function* () {
    const maxPages = options.maxPages ?? 20;
    const minPages = options.minPages ?? 5;
    const stopAfterKnown = options.stopAfterKnown ?? 50;

    const knownDevices = yield* registry.getDevicesBySource("kimovil").pipe(
      Effect.mapError((e) => new LatestDeviceCrawlerError({ message: e.message, cause: e })),
    );
    const knownSlugs = new Set(knownDevices.map((d) => d.externalId));

    yield* Effect.logInfo("Loaded known slugs").pipe(
      Effect.annotateLogs({ count: knownSlugs.size }),
    );

    let discovered = 0;
    let alreadyKnown = 0;
    let alreadyScraped = 0;
    let queued = 0;
    let consecutiveKnown = 0;
    let pagesScanned = 0;
    const seenThisSession = new Set<string>();

    // Helper to process devices from a page
    const processDevices = (
      devices: DiscoveredDevice[],
      pageNum: number,
    ): Effect.Effect<boolean, LatestDeviceCrawlerError> =>
      Effect.gen(function* () {
        for (const device of devices) {
          if (seenThisSession.has(device.slug)) continue;
          seenThisSession.add(device.slug);

          const isKnown = knownSlugs.has(device.slug);

          if (isKnown) {
            alreadyKnown++;
            consecutiveKnown++;
            if (pageNum > minPages && consecutiveKnown >= stopAfterKnown) {
              return true; // Signal to stop
            }
            continue;
          }

          consecutiveKnown = 0;
          discovered++;

          yield* Effect.logDebug("Discovered new device").pipe(
            Effect.annotateLogs({ slug: device.slug, name: device.name, discovered }),
          );

          if (!options.dryRun) {
            const registerResult = yield* registerAndQueue(
              registry,
              jobQueue,
              entityData,
              device,
              options.jobId,
            ).pipe(
              Effect.map((r) => ({ ok: true as const, result: r })),
              Effect.catchAll((error) =>
                Effect.logWarning("Failed to register/queue device").pipe(
                  Effect.annotateLogs({ slug: device.slug, error: String(error) }),
                  Effect.map(() => ({ ok: false as const, result: null })),
                ),
              ),
            );

            if (registerResult.ok) {
              knownSlugs.add(device.slug);
              if (registerResult.result === "queued") {
                queued++;
              } else if (registerResult.result === "already_scraped") {
                alreadyScraped++;
              }
            }
          }
        }
        return false; // Continue crawling
      });

    // Fetch a single page with error handling
    const fetchPage = (pageNum: number) =>
      fetchPageWithFreshBrowser(browserService, pageNum).pipe(
        Effect.map((devices) => ({ pageNum, ok: true as const, devices })),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning("Failed to fetch page, skipping").pipe(
              Effect.annotateLogs({ pageNum, error: String(error) }),
            );
            return { pageNum, ok: false as const, devices: [] as DiscoveredDevice[] };
          }),
        ),
      );

    // Phase 1: Fetch first minPages in parallel
    yield* Effect.logInfo("Fetching initial pages in parallel").pipe(
      Effect.annotateLogs({ count: minPages }),
    );

    const initialPageNums = Array.from({ length: minPages }, (_, i) => i + 1);
    const initialResults = yield* Effect.all(
      initialPageNums.map(fetchPage),
      { concurrency: minPages },
    );
    pagesScanned += minPages;

    // Process initial results in order
    for (const result of initialResults) {
      if (!result.ok || result.devices.length === 0) continue;

      yield* Effect.logInfo("Extracted devices from page").pipe(
        Effect.annotateLogs({ pageNum: result.pageNum, count: result.devices.length }),
      );

      yield* processDevices(result.devices, result.pageNum);
    }

    // Phase 2: Continue sequentially after minPages
    for (let pageNum = minPages + 1; pageNum <= maxPages; pageNum++) {
      if (consecutiveKnown >= stopAfterKnown) {
        yield* Effect.logInfo("Stopping: hit consecutive known threshold").pipe(
          Effect.annotateLogs({ consecutiveKnown, stopAfterKnown, afterMinPages: minPages }),
        );
        break;
      }

      yield* Effect.logDebug("Fetching page").pipe(
        Effect.annotateLogs({ pageNum }),
      );

      const fetchResult = yield* fetchPage(pageNum);
      pagesScanned++;

      if (!fetchResult.ok) continue;

      const devices = fetchResult.devices;

      if (devices.length === 0) {
        yield* Effect.logInfo("No devices on page, stopping").pipe(
          Effect.annotateLogs({ pageNum }),
        );
        break;
      }

      yield* Effect.logInfo("Extracted devices from page").pipe(
        Effect.annotateLogs({ pageNum, count: devices.length }),
      );

      const shouldStop = yield* processDevices(devices, pageNum);
      if (shouldStop) {
        yield* Effect.logInfo("Hit consecutive known threshold mid-page").pipe(
          Effect.annotateLogs({ consecutiveKnown, stopAfterKnown, pageNum, afterMinPages: minPages }),
        );
        break;
      }
    }

    const result = { discovered, alreadyKnown, alreadyScraped, queued, pagesScanned };

    yield* Effect.logInfo("Crawl completed").pipe(Effect.annotateLogs(result));

    return result;
  });

export const LatestDeviceCrawlerServiceLive = Layer.effect(
  LatestDeviceCrawlerService,
  Effect.gen(function* () {
    const browser = yield* BrowserService;
    const registry = yield* DeviceRegistryService;
    const jobQueue = yield* JobQueueService;
    const entityData = yield* EntityDataService;

    return LatestDeviceCrawlerService.of({
      crawl: (options) => crawlImpl(browser, registry, jobQueue, entityData, options),
    });
  }),
);
