import { Effect, Layer, Context, Data } from "effect";
import { Page } from "playwright";
import { BrowserService, BrowserError } from "./browser";
import { DeviceRegistryService, DeviceRegistryError } from "./device-registry";
import { JobQueueService, JobQueueError } from "./job-queue";
import { inferBrand } from "./kimovil/slug-logic";

export class LatestDeviceCrawlerError extends Data.TaggedError("LatestDeviceCrawlerError")<{
  message: string;
  cause?: unknown;
}> {}

export interface CrawlOptions {
  maxScrolls?: number; // Default: 20
  stopAfterEmptyScrolls?: number; // Stop after N scrolls with no new devices (default: 3)
  dryRun?: boolean; // Report only, don't modify DB
  jobId?: string; // Parent job ID for queued items
}

export interface CrawlResult {
  discovered: number;
  alreadyKnown: number;
  queued: number;
  scrollCount: number;
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
            // Name is in text content, strip region/specs suffix
            const rawText = el.textContent?.trim() || "";
            const name = rawText.split(/\t|\n/)[0]?.trim() || slug || "";
            return { slug, name };
          })
          .filter(
            (d): d is { slug: string; name: string } =>
              d.slug != null &&
              d.name.length > 0 &&
              !/-\d+gb-\d+gb$/i.test(d.slug), // Filter SKU variants
          ),
      ),
    catch: (e) => new BrowserError(`Failed to extract devices: ${e}`),
  }).pipe(
    Effect.map((devices) => {
      // Dedupe by slug, keep first occurrence
      const seen = new Set<string>();
      return devices.filter((d) => {
        if (seen.has(d.slug)) return false;
        seen.add(d.slug);
        return true;
      });
    }),
  );

const scrollAndWaitForContent = (
  page: Page,
): Effect.Effect<{ hasMore: boolean }, BrowserError> =>
  Effect.gen(function* () {
    const beforeCount = yield* Effect.tryPromise({
      try: () => page.$$eval("a.device-link", (els) => els.length),
      catch: (e) => new BrowserError(`Failed to count elements: ${e}`),
    });

    yield* Effect.tryPromise({
      try: () => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)),
      catch: (e) => new BrowserError(`Failed to scroll: ${e}`),
    });

    // Wait for new content or timeout (5s = no more content)
    yield* Effect.tryPromise({
      try: () =>
        page.waitForFunction(
          (prev: number) => document.querySelectorAll("a.device-link").length > prev,
          beforeCount,
          { timeout: 5000 },
        ),
      catch: (e) => new BrowserError(`waitForFunction failed: ${e}`),
    }).pipe(
      Effect.catchAll((error) => {
        // Only swallow timeout errors - these are expected when no more content
        if (error.message.includes("Timeout") || error.message.includes("timeout")) {
          return Effect.void;
        }
        return Effect.fail(error);
      }),
    );

    const afterCount = yield* Effect.tryPromise({
      try: () => page.$$eval("a.device-link", (els) => els.length),
      catch: (e) => new BrowserError(`Failed to count elements: ${e}`),
    });

    return { hasMore: afterCount > beforeCount };
  });

const registerAndQueue = (
  registry: DeviceRegistryService,
  jobQueue: JobQueueService,
  device: DiscoveredDevice,
  jobId?: string,
): Effect.Effect<void, DeviceRegistryError | JobQueueError> =>
  Effect.gen(function* () {
    // Check if device+source link already exists (idempotent check)
    const existingLinked = yield* registry.lookupDevice("kimovil", device.slug);
    if (existingLinked) {
      // Already fully registered, just queue for scrape
      yield* jobQueue.queueScrape(device.slug, existingLinked.id, "fast", {
        source: "kimovil",
        dataKind: "specs",
        jobId: jobId ?? null,
      });
      return;
    }

    // Check if device exists but source link is missing (partial failure recovery)
    const existingDevice = yield* registry.getDeviceBySlug(device.slug);
    const deviceId = existingDevice
      ? existingDevice.id
      : (yield* registry.createDevice({
          slug: device.slug,
          name: device.name,
          brand: inferBrand(device.name),
        })).id;

    // Link to source with discovery metadata
    yield* registry.linkDeviceToSource({
      deviceId,
      source: "kimovil",
      externalId: device.slug,
      metadata: { discovered_via: "latest_crawler" },
    });

    // Queue for fast scrape
    yield* jobQueue.queueScrape(device.slug, deviceId, "fast", {
      source: "kimovil",
      dataKind: "specs",
      jobId: jobId ?? null,
    });
  });

const crawlImpl = (
  browser: BrowserService,
  registry: DeviceRegistryService,
  jobQueue: JobQueueService,
  options: CrawlOptions = {},
): Effect.Effect<CrawlResult, LatestDeviceCrawlerError> =>
  Effect.gen(function* () {
    const maxScrolls = options.maxScrolls ?? 20;
    const stopAfterEmptyScrolls = options.stopAfterEmptyScrolls ?? 3;

    // Load known slugs into memory
    const knownDevices = yield* registry.getDevicesBySource("kimovil").pipe(
      Effect.mapError((e) => new LatestDeviceCrawlerError({ message: e.message, cause: e })),
    );
    const knownSlugs = new Set(knownDevices.map((d) => d.externalId));

    yield* Effect.logInfo("Loaded known slugs").pipe(
      Effect.annotateLogs({ count: knownSlugs.size }),
    );

    const result = yield* browser
      .withPersistentStealthPage("kimovil", (page) =>
        Effect.gen(function* () {
          // Navigate
          yield* Effect.tryPromise({
            try: () =>
              page.goto(
                "https://www.kimovil.com/en/compare-smartphones/order.dm+unveiledDate",
                { waitUntil: "domcontentloaded", timeout: 30000 },
              ),
            catch: (e) => new BrowserError(`Navigation failed: ${e}`),
          });
          yield* Effect.tryPromise({
            try: () => page.waitForTimeout(2000),
            catch: () => undefined,
          });

          let discovered = 0;
          let alreadyKnown = 0;
          let queued = 0;
          let emptyScrollCount = 0;
          let scrollCount = 0;
          const seenThisSession = new Set<string>();

          while (scrollCount < maxScrolls && emptyScrollCount < stopAfterEmptyScrolls) {
            const allDevices = yield* extractDevices(page).pipe(
              Effect.mapError(
                (e) => new LatestDeviceCrawlerError({ message: e.message, cause: e }),
              ),
            );

            // Track new devices found in this scroll iteration
            let newDevicesThisScroll = 0;

            // Iterate all devices, rely on seenThisSession for dedup
            // (DOM may reorder/virtualize, so we can't assume append-only)
            for (const device of allDevices) {
              // Skip if already seen this session
              if (seenThisSession.has(device.slug)) continue;
              seenThisSession.add(device.slug);

              const isKnown = knownSlugs.has(device.slug);

              if (isKnown) {
                alreadyKnown++;
                continue;
              }

              // New device found!
              newDevicesThisScroll++;
              discovered++;

              yield* Effect.logInfo("Discovered new device").pipe(
                Effect.annotateLogs({ slug: device.slug, name: device.name, discovered }),
              );

              if (!options.dryRun) {
                const registered = yield* registerAndQueue(
                  registry,
                  jobQueue,
                  device,
                  options.jobId,
                ).pipe(
                  Effect.map(() => true),
                  Effect.catchAll((error) =>
                    Effect.logWarning("Failed to register/queue device").pipe(
                      Effect.annotateLogs({ slug: device.slug, error: String(error) }),
                      Effect.map(() => false),
                    ),
                  ),
                );

                if (registered) {
                  knownSlugs.add(device.slug); // Prevent re-processing only on success
                  queued++;
                }
              }
            }

            // Track consecutive scrolls with no new devices
            if (newDevicesThisScroll === 0) {
              emptyScrollCount++;
              if (emptyScrollCount >= stopAfterEmptyScrolls) {
                yield* Effect.logInfo("Stopping: no new devices in recent scrolls").pipe(
                  Effect.annotateLogs({ emptyScrollCount, stopAfterEmptyScrolls }),
                );
                break;
              }
            } else {
              emptyScrollCount = 0; // Reset on finding new devices
            }

            const { hasMore } = yield* scrollAndWaitForContent(page).pipe(
              Effect.mapError(
                (e) => new LatestDeviceCrawlerError({ message: e.message, cause: e }),
              ),
            );

            if (!hasMore) {
              yield* Effect.logInfo("No more content to load");
              break;
            }

            scrollCount++;
          }

          return { discovered, alreadyKnown, queued, scrollCount };
        }),
      )
      .pipe(
        Effect.mapError((e) =>
          e instanceof LatestDeviceCrawlerError
            ? e
            : new LatestDeviceCrawlerError({ message: String(e), cause: e }),
        ),
      );

    yield* Effect.logInfo("Crawl completed").pipe(Effect.annotateLogs(result));

    return result;
  });

export const LatestDeviceCrawlerServiceLive = Layer.effect(
  LatestDeviceCrawlerService,
  Effect.gen(function* () {
    const browser = yield* BrowserService;
    const registry = yield* DeviceRegistryService;
    const jobQueue = yield* JobQueueService;

    return LatestDeviceCrawlerService.of({
      crawl: (options) => crawlImpl(browser, registry, jobQueue, options),
    });
  }),
);
