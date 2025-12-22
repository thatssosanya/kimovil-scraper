import { Effect, Layer, Stream, Scope } from "effect";
import { Page, Browser } from "playwright";
import { ScrapeService, ScrapeError, ScrapeEvent } from "@repo/scraper-domain";
import type { RawPhoneData as DomainRawPhoneData } from "@repo/scraper-domain";
import {
  ScrapeResult,
  PhoneData,
  SingleCameraData,
  Sku,
  Benchmark,
  CpuCoreCluster,
} from "@repo/scraper-protocol";
import { BrowserService, BrowserError } from "../browser";
import { HtmlCacheService, HtmlCacheError } from "../html-cache";
import { PhoneDataService, PhoneDataError } from "../phone-data";
import { RobotService, RobotError } from "../robot";
import { getHtmlValidationError } from "./validators";
import {
  extractPhoneData,
  extractPhoneDataAsync,
  RawPhoneData,
} from "./extractors";
import type { ExtractionIssue } from "./extraction";

export { getHtmlValidationError } from "./validators";
export {
  extractPhoneData,
  extractPhoneDataAsync,
  RawPhoneData,
} from "./extractors";

const PLAYWRIGHT_TIMEOUT = 60_000;
const RELOAD_TIMEOUT = 10_000;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const logExtractionIssues = (
  issues: ExtractionIssue[],
  slug: string
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (issues.length === 0) return;
    for (const issue of issues) {
      yield* Effect.logWarning(
        `Extraction issue in ${issue.field}: ${issue.message} (strategy: ${issue.strategy})`
      ).pipe(Effect.annotateLogs({ service: "Extractor", slug }));
    }
  });

const scrapePhoneData = (
  page: Page,
  slug: string
): Effect.Effect<
  { data: RawPhoneData; fullHtml: string; issues: ExtractionIssue[] },
  ScrapeError
> =>
  Effect.gen(function* () {
    const url = `https://www.kimovil.com/en/where-to-buy-${slug}`;
    yield* Effect.tryPromise({
      try: () =>
        page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: PLAYWRIGHT_TIMEOUT,
        }),
      catch: (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
    });

    const raw = yield* Effect.tryPromise({
      try: () => page.content(),
      catch: (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
    });

    const validationError = getHtmlValidationError(raw);
    if (validationError) {
      return yield* Effect.fail(
        new ScrapeError(`Page invalid: ${validationError}`)
      );
    }

    const result = yield* extractPhoneData(page, slug).pipe(
      Effect.mapError(
        (e) => new ScrapeError(`Extraction failed: ${e.message}`)
      )
    );

    yield* logExtractionIssues(result.issues, slug);

    return { data: result.data, fullHtml: raw, issues: result.issues };
  });

const parseFromCachedHtml = (
  page: Page,
  cachedHtml: string,
  slug: string
): Effect.Effect<
  { data: RawPhoneData; issues: ExtractionIssue[] },
  ScrapeError
> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => page.setContent(cachedHtml, { waitUntil: "domcontentloaded" }),
      catch: (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
    });

    const validationError = getHtmlValidationError(cachedHtml);
    if (validationError) {
      return yield* Effect.fail(
        new ScrapeError(`Cached page invalid: ${validationError}`)
      );
    }

    const result = yield* extractPhoneData(page, slug).pipe(
      Effect.mapError(
        (e) => new ScrapeError(`Extraction failed: ${e.message}`)
      )
    );

    yield* logExtractionIssues(result.issues, slug);

    return { data: result.data, issues: result.issues };
  });

const createPageScoped = (
  browser: Browser,
): Effect.Effect<Page, ScrapeError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () => browser.newPage(),
      catch: (e) =>
        new ScrapeError(
          `Failed to create page: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }),
    (page) =>
      Effect.promise(() => page.close()).pipe(
        Effect.catchAll((e) =>
          Effect.logError(`Error closing page: ${e}`).pipe(
            Effect.annotateLogs({ service: "Page" }),
          ),
        ),
      ),
  );

type ScrapeServiceDeps = {
  browserService: BrowserService;
  htmlCache: HtmlCacheService;
  phoneDataService: PhoneDataService;
  robotService: RobotService;
};

type AllErrors = ScrapeError | BrowserError | HtmlCacheError | RobotError;

const backgroundRefresh = (
  slug: string,
  deps: ScrapeServiceDeps,
): Effect.Effect<void, AllErrors> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Starting background refresh").pipe(
      Effect.annotateLogs({ service: "SWR", slug }),
    );
    yield* Effect.scoped(
      Effect.gen(function* () {
        const browser = yield* deps.browserService.createBrowserScoped();
        const page = yield* createPageScoped(browser);
        yield* deps.browserService.abortExtraResources(page);
        const { data, fullHtml } = yield* scrapePhoneData(page, slug);
        yield* deps.htmlCache
          .saveRawHtml(slug, fullHtml)
          .pipe(
            Effect.catchAll((error) =>
              Effect.logWarning("Failed to save raw HTML").pipe(
                Effect.annotateLogs({ service: "SWR", slug, error }),
              ),
            ),
          );
        yield* deps.phoneDataService
          .saveRaw(slug, data as unknown as Record<string, unknown>)
          .pipe(
            Effect.catchAll((error) =>
              Effect.logWarning("Failed to save raw data").pipe(
                Effect.annotateLogs({ service: "SWR", slug, error }),
              ),
            ),
          );
        yield* Effect.logInfo("Background refresh complete").pipe(
          Effect.annotateLogs({ service: "SWR", slug }),
        );
      }),
    );
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logError(`Background refresh failed: ${error}`).pipe(
        Effect.annotateLogs({ service: "SWR", slug }),
      ),
    ),
  );

const mapFingerprintPosition = (
  pos: string | null,
): "screen" | "side" | "back" | null => {
  if (pos === "screen" || pos === "side" || pos === "back") return pos;
  return null;
};

const mapUsb = (usb: string | null): "USB-A" | "USB-C" | "Lightning" | null => {
  if (usb === "USB-A" || usb === "USB-C" || usb === "Lightning") return usb;
  return null;
};

const buildPhoneData = (
  normalizedData: Record<string, unknown>,
  images: string[] | null,
): PhoneData => {
  const nd = normalizedData as {
    slug: string;
    name: string;
    brand: string;
    aliases: string[];
    releaseDate: string | null;
    height_mm: number | null;
    width_mm: number | null;
    thickness_mm: number | null;
    weight_g: number | null;
    materials: string[];
    ipRating: string | null;
    colors: string[];
    size_in: number | null;
    displayType: string | null;
    resolution: string | null;
    aspectRatio: string | null;
    ppi: number | null;
    displayFeatures: string[];
    cpu: string | null;
    cpuManufacturer: string | null;
    cpuCores: string[] | null;
    cpuCoreClusters: Array<{
      count: number;
      maxFreqMhz: number | null;
      label: string | null;
      role: "performance" | "efficiency" | "balanced" | "unknown";
      rawGroup: string;
      index: number;
    }> | null;
    gpu: string | null;
    sdSlot: boolean | null;
    skus: Array<{
      marketIds: string[];
      ram_gb: number | null;
      storage_gb: number | null;
    }>;
    fingerprintPosition: string | null;
    benchmarks: Array<{ name: string; score: number }>;
    nfc: boolean | null;
    bluetooth: string | null;
    sim: string[];
    simCount: number | null;
    usb: string | null;
    headphoneJack: boolean | null;
    batteryCapacity_mah: number | null;
    batteryFastCharging: boolean | null;
    batteryWattage: number | null;
    cameras: Array<{
      resolution_mp: number | null;
      aperture_fstop: number | null;
      sensor: string | null;
      type: string | null;
      features: string[] | null;
    }>;
    cameraFeatures: string[];
    os: string | null;
    osSkin: string | null;
  };

  return new PhoneData({
    slug: nd.slug,
    name: nd.name,
    brand: nd.brand,
    aliases: nd.aliases ?? [],
    releaseDate: nd.releaseDate,
    images: images,
    height_mm: nd.height_mm,
    width_mm: nd.width_mm,
    thickness_mm: nd.thickness_mm,
    weight_g: nd.weight_g,
    materials: nd.materials ?? [],
    ipRating: nd.ipRating,
    colors: nd.colors ?? [],
    size_in: nd.size_in,
    displayType: nd.displayType,
    resolution: nd.resolution,
    aspectRatio: nd.aspectRatio,
    ppi: nd.ppi,
    displayFeatures: nd.displayFeatures ?? [],
    cpu: nd.cpu,
    cpuManufacturer: nd.cpuManufacturer,
    cpuCores: nd.cpuCores,
    cpuCoreClusters: nd.cpuCoreClusters?.map(
      (c) =>
        new CpuCoreCluster({
          count: c.count,
          maxFreqMhz: c.maxFreqMhz,
          label: c.label,
          role: c.role,
          rawGroup: c.rawGroup,
          index: c.index,
        }),
    ) ?? null,
    gpu: nd.gpu,
    sdSlot: nd.sdSlot,
    skus: nd.skus.map(
      (s) =>
        new Sku({
          marketIds: s.marketIds ?? [],
          ram_gb: s.ram_gb ?? 0,
          storage_gb: s.storage_gb ?? 0,
        }),
    ),
    fingerprintPosition: mapFingerprintPosition(nd.fingerprintPosition),
    benchmarks: nd.benchmarks.map(
      (b) => new Benchmark({ name: b.name, score: b.score }),
    ),
    nfc: nd.nfc,
    bluetooth: nd.bluetooth,
    sim: nd.sim ?? [],
    simCount: nd.simCount ?? 0,
    usb: mapUsb(nd.usb),
    headphoneJack: nd.headphoneJack,
    batteryCapacity_mah: nd.batteryCapacity_mah,
    batteryFastCharging: nd.batteryFastCharging,
    batteryWattage: nd.batteryWattage,
    cameras: nd.cameras.map(
      (c) =>
        new SingleCameraData({
          resolution_mp: c.resolution_mp ?? 0,
          aperture_fstop: c.aperture_fstop != null ? String(c.aperture_fstop) : null,
          sensor: c.sensor ?? null,
          type: c.type ?? "",
          features: c.features ?? [],
        }),
    ),
    cameraFeatures: nd.cameraFeatures ?? [],
    os: nd.os,
    osSkin: nd.osSkin,
    scores: null,
    others: null,
  });
};

const CACHE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days
const SWR_THRESHOLD_SECONDS = 30 * 24 * 60 * 60; // 30 days

const scrapeWithCache = (
  slug: string,
  deps: ScrapeServiceDeps,
): Stream.Stream<ScrapeResult | ScrapeEvent, ScrapeError> => {
  const scrapeEffect = Effect.gen(function* () {
    const events: (ScrapeResult | ScrapeEvent)[] = [];
    const emit = (e: ScrapeResult | ScrapeEvent) => events.push(e);

    const totalStart = Date.now();
    let stepStart = Date.now();

    const elapsed = () => {
      const duration = Date.now() - stepStart;
      stepStart = Date.now();
      return duration;
    };

    emit({ type: "progress", stage: "Проверка кэша", percent: 1 });
    emit({
      type: "log",
      level: "info",
      message: `Начинаю скрейпинг: ${slug}`,
    });

    const cacheResult = yield* deps.htmlCache
      .getRawHtmlWithAge(slug)
      .pipe(
        Effect.catchAll((error) =>
          Effect.logWarning("Cache check failed").pipe(
            Effect.annotateLogs({ slug, error }),
            Effect.map(() => null),
          ),
        ),
      );
    const cacheCheckMs = elapsed();

    const useCache =
      cacheResult && cacheResult.ageSeconds < CACHE_MAX_AGE_SECONDS;
    const needsSwr =
      cacheResult &&
      cacheResult.ageSeconds >= SWR_THRESHOLD_SECONDS &&
      cacheResult.ageSeconds < CACHE_MAX_AGE_SECONDS;

    let data: RawPhoneData | undefined;
    let images: string[] | null = null;

    if (useCache) {
      const ageDays = Math.floor(cacheResult.ageSeconds / 86400);
      emit({
        type: "progress",
        stage: `Кэш найден (${ageDays}д)`,
        percent: 3,
        durationMs: cacheCheckMs,
      });
      emit({
        type: "log",
        level: "info",
        message: `[Cache] hit slug=${slug} ageDays=${ageDays}${needsSwr ? " (SWR)" : ""}`,
      });

      emit({
        type: "progress",
        stage: "Запуск локального браузера",
        percent: 5,
      });

      const cacheParseResult = yield* Effect.scoped(
        Effect.gen(function* () {
          const browser = yield* deps.browserService.createLocalBrowserScoped();
          const browserMs = elapsed();

          emit({
            type: "progress",
            stage: "Браузер готов",
            percent: 8,
            durationMs: browserMs,
          });

          const page = yield* createPageScoped(browser);
          emit({ type: "progress", stage: "Парсинг из кэша", percent: 10 });

          const parsedResult = yield* parseFromCachedHtml(
            page,
            cacheResult.html,
            slug
          );
          const parseMs = elapsed();

          emit({
            type: "progress",
            stage: "Данные извлечены",
            percent: 15,
            durationMs: parseMs,
          });
          emit({
            type: "log",
            level: "info",
            message: `Кэш распарсен за ${parseMs}ms — ${parsedResult.data.cameras.length} камер, ${parsedResult.data.skus.length} SKU`,
          });

          return parsedResult.data;
        }),
      ).pipe(
        Effect.catchAll((error) => {
          emit({
            type: "log",
            level: "warn",
            message: `[Cache] parse failed, falling back to fresh fetch: ${error}`,
          });
          return Effect.succeed(null);
        }),
      );

      if (cacheParseResult) {
        data = cacheParseResult;
        images = data.images;
        if (needsSwr) {
          emit({
            type: "log",
            level: "info",
            message: `[SWR] Triggering background refresh (cache age > 30d)`,
          });
          yield* Effect.forkDaemon(backgroundRefresh(slug, deps));
        }
      }
    }

    if (!data) {
      emit({
        type: "progress",
        stage: cacheResult ? "Кэш устарел" : "Кэш пуст",
        percent: 2,
        durationMs: cacheCheckMs,
      });
      emit({
        type: "log",
        level: "info",
        message: `[Cache] ${cacheResult ? "stale" : "miss"} slug=${slug}`,
      });

      emit({ type: "progress", stage: "Запуск браузера", percent: 3 });

      const freshResult = yield* Effect.scoped(
        Effect.gen(function* () {
          const browser = yield* deps.browserService.createBrowserScoped();
          const browserMs = elapsed();

          emit({
            type: "progress",
            stage: "Браузер готов",
            percent: 5,
            durationMs: browserMs,
          });
          emit({
            type: "log",
            level: "info",
            message: `Браузер запущен за ${browserMs}ms`,
          });

          const page = yield* createPageScoped(browser);
          yield* deps.browserService.abortExtraResources(page);

          emit({ type: "progress", stage: "Загрузка страницы", percent: 8 });
          emit({
            type: "log",
            level: "info",
            message: `Перехожу на kimovil.com/${slug}...`,
          });

          const result = yield* scrapePhoneData(page, slug);
          const scrapeMs = elapsed();

          emit({
            type: "progress",
            stage: "Данные извлечены",
            percent: 15,
            durationMs: scrapeMs,
          });
          emit({
            type: "log",
            level: "info",
            message: `Страница загружена за ${scrapeMs}ms — ${result.data.cameras.length} камер, ${result.data.skus.length} SKU`,
          });

          yield* deps.htmlCache
            .saveRawHtml(slug, result.fullHtml)
            .pipe(
              Effect.catchAll((error) =>
                Effect.logWarning("Failed to cache HTML").pipe(
                  Effect.annotateLogs({ slug, error }),
                ),
              ),
            );

          return result;
        }),
      );

      data = freshResult.data;
      images = data.images;
    }

    emit({
      type: "progress",
      stage: "AI обработка (~25 сек)",
      percent: 20,
    });
    emit({
      type: "log",
      level: "info",
      message: "Нормализую данные через Gemini 3 Flash...",
    });

    const normalizedData = yield* deps.robotService.adaptScrapedData(
      data as unknown as DomainRawPhoneData,
    );
    const aiMs = elapsed();

    const totalMs = Date.now() - totalStart;
    emit({
      type: "progress",
      stage: "Готово",
      percent: 100,
      durationMs: totalMs,
    });
    emit({
      type: "log",
      level: "info",
      message: `✓ AI: ${(aiMs / 1000).toFixed(1)}s | Всего: ${(totalMs / 1000).toFixed(1)}s`,
    });

    const phoneData = buildPhoneData(normalizedData, images);

    yield* deps.phoneDataService
      .save(slug, phoneData as unknown as Record<string, unknown>)
      .pipe(
        Effect.catchAll((error) =>
          Effect.logWarning("Failed to save phone data").pipe(
            Effect.annotateLogs({ slug, error }),
          ),
        ),
      );

    emit(new ScrapeResult({ data: phoneData }));

    return events;
  }).pipe(
    Effect.mapError(
      (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
    ),
  );

  return Stream.fromIterableEffect(scrapeEffect);
};

const scrapeFastImpl = (
  slug: string,
  deps: ScrapeServiceDeps,
): Stream.Stream<ScrapeEvent, ScrapeError> => {
  const scrapeEffect = Effect.gen(function* () {
    const events: ScrapeEvent[] = [];
    const emit = (e: ScrapeEvent) => events.push(e);

    const totalStart = Date.now();
    let stepStart = Date.now();

    const elapsed = () => {
      const duration = Date.now() - stepStart;
      stepStart = Date.now();
      return duration;
    };

    emit({ type: "progress", stage: "Проверка кэша", percent: 1 });
    emit({
      type: "log",
      level: "info",
      message: `[Fast] Начинаю скрейпинг: ${slug}`,
    });

    const existingHtml = yield* deps.htmlCache
      .getRawHtml(slug)
      .pipe(
        Effect.catchAll((error) =>
          Effect.logWarning("Cache read failed").pipe(
            Effect.annotateLogs({ slug, error }),
            Effect.map(() => null),
          ),
        ),
      );

    if (existingHtml) {
      const totalMs = Date.now() - totalStart;
      emit({
        type: "progress",
        stage: "Кэш найден",
        percent: 100,
        durationMs: totalMs,
      });
      emit({
        type: "log",
        level: "info",
        message: `✓ [Fast] Уже в кэше, пропускаю (${totalMs}ms)`,
      });
      return events;
    }

    emit({ type: "progress", stage: "Запуск браузера", percent: 5 });

    emit({
      type: "log",
      level: "info",
      message: `Rate limit: ожидание ${RATE_LIMIT_DELAY_MS}ms...`,
    });
    yield* Effect.sleep(RATE_LIMIT_DELAY_MS);

    yield* Effect.scoped(
      Effect.gen(function* () {
        const browser = yield* deps.browserService.createBrowserScoped();
        const browserMs = elapsed();

        emit({
          type: "progress",
          stage: "Браузер готов",
          percent: 15,
          durationMs: browserMs,
        });
        emit({
          type: "log",
          level: "info",
          message: `Браузер запущен за ${browserMs}ms`,
        });

        const page = yield* createPageScoped(browser);
        yield* deps.browserService.abortExtraResources(page);

        let lastError: ScrapeError | null = null;
        let data: RawPhoneData | null = null;
        let fullHtml: string | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          const result = yield* Effect.gen(function* () {
            emit({
              type: "progress",
              stage: `Загрузка страницы (попытка ${attempt}/${MAX_RETRIES})`,
              percent: 20 + (attempt - 1) * 15,
            });
            emit({
              type: "log",
              level: "info",
              message: `Попытка ${attempt}/${MAX_RETRIES}: kimovil.com/${slug}...`,
            });

            const scrapeResult = yield* scrapePhoneData(page, slug);
            return scrapeResult;
          }).pipe(
            Effect.map((r) => ({ success: true as const, data: r })),
            Effect.catchAll((error) =>
              Effect.succeed({ success: false as const, error }),
            ),
          );

          if (result.success) {
            data = result.data.data;
            fullHtml = result.data.fullHtml;
            lastError = null;
            break;
          } else {
            lastError = result.error;
            const isBotBlock =
              lastError.message.includes("Bot protection") ||
              lastError.message.includes("Page blocked") ||
              lastError.message.includes("Page invalid");

            if (isBotBlock && attempt < MAX_RETRIES) {
              emit({
                type: "retry",
                attempt,
                maxAttempts: MAX_RETRIES,
                delay: RETRY_DELAY_MS,
                reason: lastError.message,
              });
              emit({
                type: "log",
                level: "warn",
                message: `Попытка ${attempt} неудачна: ${lastError.message}. Повтор через ${RETRY_DELAY_MS / 1000}s...`,
              });
              yield* Effect.sleep(RETRY_DELAY_MS);
              yield* Effect.tryPromise({
                try: () =>
                  page.reload({
                    waitUntil: "domcontentloaded",
                    timeout: RELOAD_TIMEOUT,
                  }),
                catch: () => new ScrapeError("Reload failed"),
              }).pipe(Effect.catchAll(() => Effect.void));
            } else if (!isBotBlock) {
              break;
            }
          }
        }

        if (lastError || !data || !fullHtml) {
          return yield* Effect.fail(
            lastError || new ScrapeError("Failed to scrape after retries"),
          );
        }

        const scrapeMs = elapsed();

        emit({
          type: "progress",
          stage: "Данные извлечены",
          percent: 70,
          durationMs: scrapeMs,
        });
        emit({
          type: "log",
          level: "info",
          message: `Страница загружена за ${scrapeMs}ms — ${data.cameras.length} камер, ${data.skus.length} SKU`,
        });

        yield* deps.htmlCache
          .saveRawHtml(slug, fullHtml)
          .pipe(Effect.catchAll(() => Effect.void));

        yield* deps.phoneDataService
          .saveRaw(slug, data as unknown as Record<string, unknown>)
          .pipe(Effect.catchAll(() => Effect.void));

        emit({ type: "progress", stage: "Данные сохранены", percent: 90 });
        emit({
          type: "log",
          level: "info",
          message: `Raw HTML + phone data сохранены в кэш`,
        });

        const totalMs = Date.now() - totalStart;
        emit({
          type: "progress",
          stage: "Готово (fast)",
          percent: 100,
          durationMs: totalMs,
        });
        emit({
          type: "log",
          level: "info",
          message: `✓ Fast scrape завершён за ${(totalMs / 1000).toFixed(1)}s (без AI)`,
        });
      }),
    );

    return events;
  }).pipe(
    Effect.mapError(
      (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
    ),
  );

  return Stream.fromIterableEffect(scrapeEffect);
};

export const ScrapeServiceKimovil = Layer.effect(
  ScrapeService,
  Effect.gen(function* () {
    const browserService = yield* BrowserService;
    const htmlCache = yield* HtmlCacheService;
    const phoneDataService = yield* PhoneDataService;
    const robotService = yield* RobotService;

    const deps: ScrapeServiceDeps = {
      browserService,
      htmlCache,
      phoneDataService,
      robotService,
    };

    return ScrapeService.of({
      scrape: (slug: string) => scrapeWithCache(slug, deps),
      scrapeFast: (slug: string) => scrapeFastImpl(slug, deps),
    });
  }),
);
