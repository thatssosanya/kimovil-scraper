import { Effect, Layer, Stream } from "effect";
import { Page } from "playwright";
import { ScrapeService, ScrapeError, ScrapeEvent } from "@repo/scraper-domain";
import {
  ScrapeResult,
  PhoneData,
  SingleCameraData,
  Sku,
  Benchmark,
} from "@repo/scraper-protocol";
import { BrowserService } from "./browser";
import { HtmlCacheService } from "./html-cache";
import { PhoneDataService } from "./phone-data";
import { OpenAIService } from "./openai";
import { getHtmlValidationError } from "./scrape-kimovil-validators";
import { extractPhoneData, RawPhoneData } from "./scrape-kimovil-extractors";

export { getHtmlValidationError } from "./scrape-kimovil-validators";
export { extractPhoneData, RawPhoneData } from "./scrape-kimovil-extractors";

const PLAYWRIGHT_TIMEOUT = 60_000;
const RELOAD_TIMEOUT = 10_000;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scrapePhoneData = async (
  page: Page,
  slug: string,
): Promise<{ data: RawPhoneData; fullHtml: string }> => {
  const url = `https://www.kimovil.com/en/where-to-buy-${slug}`;
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_TIMEOUT,
  });

  const raw = await page.content();

  const validationError = getHtmlValidationError(raw);
  if (validationError) {
    throw new Error(`Page invalid: ${validationError}`);
  }

  const data = await extractPhoneData(page, slug);
  return { data, fullHtml: raw };
};

const parseFromCachedHtml = async (
  page: Page,
  cachedHtml: string,
  slug: string,
): Promise<RawPhoneData> => {
  await page.setContent(cachedHtml, { waitUntil: "domcontentloaded" });

  const validationError = getHtmlValidationError(cachedHtml);
  if (validationError) {
    throw new Error(`Cached page invalid: ${validationError}`);
  }

  return extractPhoneData(page, slug);
};

export const ScrapeServiceKimovil = Layer.effect(
  ScrapeService,
  Effect.gen(function* () {
    const browserService = yield* BrowserService;
    const htmlCache = yield* HtmlCacheService;
    const phoneDataService = yield* PhoneDataService;
    const openaiService = yield* OpenAIService;

    const backgroundRefresh = async (slug: string) => {
      console.log(`[SWR] Starting background refresh for ${slug}`);
      try {
        await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function* () {
              const browser = yield* browserService.createBrowserScoped();
              const page = yield* Effect.promise(() => browser.newPage());
              yield* browserService.abortExtraResources(page);
              const { data, fullHtml } = yield* Effect.promise(() =>
                scrapePhoneData(page, slug),
              );
              yield* htmlCache
                .saveRawHtml(slug, fullHtml)
                .pipe(Effect.catchAll(() => Effect.void));
              yield* phoneDataService
                .saveRaw(slug, data as unknown as Record<string, unknown>)
                .pipe(Effect.catchAll(() => Effect.void));
              console.log(`[SWR] Background refresh complete for ${slug}`);
            }),
          ),
        );
      } catch (error) {
        console.error(`[SWR] Background refresh failed for ${slug}:`, error);
      }
    };

    return ScrapeService.of({
      scrape: (slug: string) => {
        const CACHE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days
        const SWR_THRESHOLD_SECONDS = 30 * 24 * 60 * 60; // 30 days

        const runScrape = async function* (): AsyncGenerator<
          ScrapeResult | ScrapeEvent,
          void,
          unknown
        > {
          const totalStart = Date.now();
          let stepStart = Date.now();

          const elapsed = () => {
            const duration = Date.now() - stepStart;
            stepStart = Date.now();
            return duration;
          };

          yield { type: "progress", stage: "Проверка кэша", percent: 1 };
          yield {
            type: "log",
            level: "info",
            message: `Начинаю скрейпинг: ${slug}`,
          };

          const cacheResult = await Effect.runPromise(
            htmlCache
              .getRawHtmlWithAge(slug)
              .pipe(Effect.catchAll(() => Effect.succeed(null))),
          );
          const cacheCheckMs = elapsed();

          const useCache =
            cacheResult && cacheResult.ageSeconds < CACHE_MAX_AGE_SECONDS;
          const needsSwr =
            cacheResult &&
            cacheResult.ageSeconds >= SWR_THRESHOLD_SECONDS &&
            cacheResult.ageSeconds < CACHE_MAX_AGE_SECONDS;

          let data: RawPhoneData | undefined;
          let browser:
            | Awaited<ReturnType<typeof Effect.runPromise<any, any>>>
            | undefined;

          if (useCache) {
            const ageDays = Math.floor(cacheResult.ageSeconds / 86400);
            yield {
              type: "progress",
              stage: `Кэш найден (${ageDays}д)`,
              percent: 3,
              durationMs: cacheCheckMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `[Cache] hit slug=${slug} ageDays=${ageDays}${needsSwr ? " (SWR)" : ""}`,
            };

            yield {
              type: "progress",
              stage: "Запуск локального браузера",
              percent: 5,
            };
            browser = await Effect.runPromise(
              browserService.createLocalBrowser(),
            );
            const browserMs = elapsed();

            try {
              yield {
                type: "progress",
                stage: "Браузер готов",
                percent: 8,
                durationMs: browserMs,
              };

              const page = await browser.newPage();
              yield { type: "progress", stage: "Парсинг из кэша", percent: 10 };

              data = await parseFromCachedHtml(page, cacheResult.html, slug);
              const parseMs = elapsed();

              yield {
                type: "progress",
                stage: "Данные извлечены",
                percent: 15,
                durationMs: parseMs,
              };
              yield {
                type: "log",
                level: "info",
                message: `Кэш распарсен за ${parseMs}ms — ${data.cameras.length} камер, ${data.skus.length} SKU`,
              };

              if (needsSwr) {
                yield {
                  type: "log",
                  level: "info",
                  message: `[SWR] Triggering background refresh (cache age > 30d)`,
                };
                backgroundRefresh(slug);
              }
            } catch (cacheError) {
              await browser.close();
              browser = undefined;
              yield {
                type: "log",
                level: "warn",
                message: `[Cache] parse failed, falling back to fresh fetch: ${cacheError}`,
              };
            }
          }

          if (!data) {
            yield {
              type: "progress",
              stage: cacheResult ? "Кэш устарел" : "Кэш пуст",
              percent: 2,
              durationMs: cacheCheckMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `[Cache] ${cacheResult ? "stale" : "miss"} slug=${slug}`,
            };

            yield { type: "progress", stage: "Запуск браузера", percent: 3 };
            browser = await Effect.runPromise(browserService.createBrowser());
            const browserMs = elapsed();

            yield {
              type: "progress",
              stage: "Браузер готов",
              percent: 5,
              durationMs: browserMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `Браузер запущен за ${browserMs}ms`,
            };

            const page = await browser.newPage();
            await Effect.runPromise(browserService.abortExtraResources(page));

            yield { type: "progress", stage: "Загрузка страницы", percent: 8 };
            yield {
              type: "log",
              level: "info",
              message: `Перехожу на kimovil.com/${slug}...`,
            };

            const result = await scrapePhoneData(page, slug);
            data = result.data;
            const scrapeMs = elapsed();

            yield {
              type: "progress",
              stage: "Данные извлечены",
              percent: 15,
              durationMs: scrapeMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `Страница загружена за ${scrapeMs}ms — ${data.cameras.length} камер, ${data.skus.length} SKU`,
            };

            await Effect.runPromise(
              htmlCache
                .saveRawHtml(slug, result.fullHtml)
                .pipe(Effect.catchAll(() => Effect.void)),
            );
          }

          try {
            yield {
              type: "progress",
              stage: "AI обработка (~25 сек)",
              percent: 20,
            };
            yield {
              type: "log",
              level: "info",
              message: "Нормализую данные через Gemini 3 Flash...",
            };

            const normalizedData = await Effect.runPromise(
              openaiService.adaptScrapedData(
                data as unknown as Record<string, unknown>,
              ),
            );
            const aiMs = elapsed();

            const totalMs = Date.now() - totalStart;
            yield {
              type: "progress",
              stage: "Готово",
              percent: 100,
              durationMs: totalMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `✓ AI: ${(aiMs / 1000).toFixed(1)}s | Всего: ${(totalMs / 1000).toFixed(1)}s`,
            };

            const phoneData = new PhoneData({
              slug: normalizedData.slug,
              name: normalizedData.name,
              brand: normalizedData.brand,
              aliases: normalizedData.aliases,
              releaseDate: normalizedData.releaseDate,
              images: data.images,
              height_mm: normalizedData.height_mm,
              width_mm: normalizedData.width_mm,
              thickness_mm: normalizedData.thickness_mm,
              weight_g: normalizedData.weight_g,
              materials: normalizedData.materials,
              ipRating: normalizedData.ipRating,
              colors: normalizedData.colors,
              size_in: normalizedData.size_in,
              displayType: normalizedData.displayType,
              resolution: normalizedData.resolution,
              aspectRatio: normalizedData.aspectRatio,
              ppi: normalizedData.ppi,
              displayFeatures: normalizedData.displayFeatures,
              cpu: normalizedData.cpu,
              cpuManufacturer: normalizedData.cpuManufacturer,
              cpuCores: normalizedData.cpuCores,
              gpu: normalizedData.gpu,
              sdSlot: normalizedData.sdSlot,
              skus: normalizedData.skus.map(
                (s) =>
                  new Sku({
                    marketId: s.marketId,
                    ram_gb: s.ram_gb,
                    storage_gb: s.storage_gb,
                  }),
              ),
              fingerprintPosition: normalizedData.fingerprintPosition,
              benchmarks: normalizedData.benchmarks.map(
                (b) => new Benchmark({ name: b.name, score: b.score }),
              ),
              nfc: normalizedData.nfc,
              bluetooth: normalizedData.bluetooth,
              sim: normalizedData.sim,
              simCount: normalizedData.simCount,
              usb: normalizedData.usb,
              headphoneJack: normalizedData.headphoneJack,
              batteryCapacity_mah: normalizedData.batteryCapacity_mah,
              batteryFastCharging: normalizedData.batteryFastCharging,
              batteryWattage: normalizedData.batteryWattage,
              cameras: normalizedData.cameras.map(
                (c) =>
                  new SingleCameraData({
                    resolution_mp: c.resolution_mp,
                    aperture_fstop: c.aperture_fstop,
                    sensor: c.sensor,
                    type: c.type,
                    features:
                      Array.isArray(c.features) && c.features.length > 0
                        ? c.features.join("|")
                        : "",
                  }),
              ),
              cameraFeatures: normalizedData.cameraFeatures,
              os: normalizedData.os,
              osSkin: normalizedData.osSkin,
              scores: null,
              others: null,
            });

            await Effect.runPromise(
              phoneDataService
                .save(slug, phoneData as unknown as Record<string, unknown>)
                .pipe(Effect.catchAll(() => Effect.void)),
            );

            yield new ScrapeResult({ data: phoneData });
          } finally {
            if (browser) {
              await browser.close();
            }
          }
        };

        return Stream.fromAsyncIterable(
          runScrape(),
          (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
        );
      },

      scrapeFast: (slug: string) => {
        const runFastScrape = async function* (): AsyncGenerator<
          ScrapeEvent,
          void,
          unknown
        > {
          const totalStart = Date.now();
          let stepStart = Date.now();

          const elapsed = () => {
            const duration = Date.now() - stepStart;
            stepStart = Date.now();
            return duration;
          };

          yield { type: "progress", stage: "Проверка кэша", percent: 1 };
          yield {
            type: "log",
            level: "info",
            message: `[Fast] Начинаю скрейпинг: ${slug}`,
          };

          // Check if HTML already exists in cache
          const existingHtml = await Effect.runPromise(
            htmlCache
              .getRawHtml(slug)
              .pipe(Effect.catchAll(() => Effect.succeed(null))),
          );

          if (existingHtml) {
            const totalMs = Date.now() - totalStart;
            yield {
              type: "progress",
              stage: "Кэш найден",
              percent: 100,
              durationMs: totalMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `✓ [Fast] Уже в кэше, пропускаю (${totalMs}ms)`,
            };
            return;
          }

          yield { type: "progress", stage: "Запуск браузера", percent: 5 };

          // Rate limiting - wait before starting
          yield {
            type: "log",
            level: "info",
            message: `Rate limit: ожидание ${RATE_LIMIT_DELAY_MS}ms...`,
          };
          await sleep(RATE_LIMIT_DELAY_MS);

          const browser = await Effect.runPromise(
            browserService.createBrowser(),
          );
          const browserMs = elapsed();

          try {
            yield {
              type: "progress",
              stage: "Браузер готов",
              percent: 15,
              durationMs: browserMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `Браузер запущен за ${browserMs}ms`,
            };

            const page = await browser.newPage();
            await Effect.runPromise(browserService.abortExtraResources(page));

            let lastError: Error | null = null;
            let data: RawPhoneData | null = null;
            let fullHtml: string | null = null;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                yield {
                  type: "progress",
                  stage: `Загрузка страницы (попытка ${attempt}/${MAX_RETRIES})`,
                  percent: 20 + (attempt - 1) * 15,
                };
                yield {
                  type: "log",
                  level: "info",
                  message: `Попытка ${attempt}/${MAX_RETRIES}: kimovil.com/${slug}...`,
                };

                const result = await scrapePhoneData(page, slug);
                data = result.data;
                fullHtml = result.fullHtml;
                lastError = null;
                break;
              } catch (error) {
                lastError =
                  error instanceof Error ? error : new Error(String(error));
                const isBotBlock =
                  lastError.message.includes("Bot protection") ||
                  lastError.message.includes("Page blocked") ||
                  lastError.message.includes("Page invalid");

                if (isBotBlock && attempt < MAX_RETRIES) {
                  yield {
                    type: "retry",
                    attempt,
                    maxAttempts: MAX_RETRIES,
                    delay: RETRY_DELAY_MS,
                    reason: lastError.message,
                  };
                  yield {
                    type: "log",
                    level: "warn",
                    message: `Попытка ${attempt} неудачна: ${lastError.message}. Повтор через ${RETRY_DELAY_MS / 1000}s...`,
                  };
                  await sleep(RETRY_DELAY_MS);
                  try {
                    await page.reload({
                      waitUntil: "domcontentloaded",
                      timeout: RELOAD_TIMEOUT,
                    });
                  } catch {}
                } else if (!isBotBlock) {
                  break;
                }
              }
            }

            if (lastError || !data || !fullHtml) {
              throw lastError || new Error("Failed to scrape after retries");
            }

            const scrapeMs = elapsed();

            yield {
              type: "progress",
              stage: "Данные извлечены",
              percent: 70,
              durationMs: scrapeMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `Страница загружена за ${scrapeMs}ms — ${data.cameras.length} камер, ${data.skus.length} SKU`,
            };

            await Effect.runPromise(
              htmlCache
                .saveRawHtml(slug, fullHtml)
                .pipe(Effect.catchAll(() => Effect.void)),
            );

            await Effect.runPromise(
              phoneDataService
                .saveRaw(slug, data as unknown as Record<string, unknown>)
                .pipe(Effect.catchAll(() => Effect.void)),
            );

            yield { type: "progress", stage: "Данные сохранены", percent: 90 };
            yield {
              type: "log",
              level: "info",
              message: `Raw HTML + phone data сохранены в кэш`,
            };

            const totalMs = Date.now() - totalStart;
            yield {
              type: "progress",
              stage: "Готово (fast)",
              percent: 100,
              durationMs: totalMs,
            };
            yield {
              type: "log",
              level: "info",
              message: `✓ Fast scrape завершён за ${(totalMs / 1000).toFixed(1)}s (без AI)`,
            };
          } finally {
            await browser.close();
          }
        };

        return Stream.fromAsyncIterable(
          runFastScrape(),
          (e) => new ScrapeError(e instanceof Error ? e.message : String(e)),
        );
      },
    });
  }),
);
