import { Effect, Layer, Stream, Queue } from "effect";
import { Page } from "playwright";
import { ScrapeService, ScrapeError, ScrapeEvent } from "@repo/scraper-domain";
import {
  ScrapeResult,
  PhoneData,
  SingleCameraData,
  Sku,
  Benchmark,
} from "@repo/scraper-protocol";
import { BrowserService, getCpuCores, parseReleaseDate } from "./browser";
import { StorageService } from "./storage";
import { OpenAIService, convertArraysToPipeDelimited } from "./openai";

const PLAYWRIGHT_TIMEOUT = 60_000;
const RELOAD_TIMEOUT = 10_000;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const SIM_TYPES = ["Nano-SIM", "Mini-SIM", "Micro-SIM", "eSIM"] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isBotProtectionPage = (html: string): string | null => {
  if (html.includes("Enable JavaScript and cookies to continue")) {
    return "Bot protection: JavaScript/cookies required";
  }
  if (html.includes("Please verify you are a human")) {
    return "Bot protection: Human verification required";
  }
  if (html.includes("Access denied")) {
    return "Bot protection: Access denied";
  }
  if (!html.includes("<main")) {
    return "Missing main content element";
  }
  return null;
};

export const getHtmlValidationError = (html: string): string | null => {
  const botReason = isBotProtectionPage(html);
  if (botReason) return botReason;
  if (!html.includes("k-dltable") && !html.includes("container-sheet")) {
    return "Missing expected content structure";
  }
  return null;
};
type Sim = (typeof SIM_TYPES)[number];

type DirtySku = { ram: number; rom: number };
type DirtyMarket = { mkid: string; devices: DirtySku[] };

// Raw phone data before normalization
export interface RawPhoneData {
  slug: string;
  name: string;
  brand: string;
  aliases: string;
  releaseDate: string | null;
  images: string | null;
  height_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  weight_g: number | null;
  materials: string;
  ipRating: string | null;
  colors: string;
  size_in: number | null;
  displayType: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  ppi: number | null;
  displayFeatures: string;
  cpu: string | null;
  cpuManufacturer: string | null;
  cpuCores: string | null;
  gpu: string | null;
  sdSlot: boolean | null;
  skus: Sku[];
  fingerprintPosition: "screen" | "side" | "back" | null;
  benchmarks: Benchmark[];
  nfc: boolean | null;
  bluetooth: string | null;
  sim: string;
  simCount: number;
  usb: "USB-A" | "USB-C" | "Lightning" | null;
  headphoneJack: boolean | null;
  batteryCapacity_mah: number | null;
  batteryFastCharging: boolean | null;
  batteryWattage: number | null;
  cameras: SingleCameraData[];
  cameraFeatures: string;
  os: string | null;
  osSkin: string | null;
  scores: string | null;
  others: string | null;
}

const getTextExtractor =
  (page: Page) =>
  async (selector: string): Promise<string | null> => {
    try {
      return await page.$eval(selector, (e) => e.textContent?.trim() || "");
    } catch {
      return null;
    }
  };

// Returns plain objects - runs in browser context via $$eval
const getCameras = (cameraTables: Element[]) => {
  return cameraTables
    .map((el) => {
      const cameraData: Record<string, string> = {};

      if (el.tagName === "TABLE") {
        el.querySelectorAll("tr").forEach((row) => {
          const th = row.querySelector("th")?.textContent?.trim();
          const td = row.querySelector("td")?.textContent?.trim();
          if (th && td) cameraData[th] = td;
        });
      } else if (el.tagName === "DL") {
        let currentKey = "";
        el.querySelectorAll("dt, dd").forEach((item) => {
          if (item.tagName === "DT") {
            currentKey = item.textContent?.trim() || "";
          } else if (item.tagName === "DD" && currentKey) {
            cameraData[currentKey] = item.textContent?.trim() || "";
          }
        });
      }

      const type = el.querySelector(".k-head")?.textContent?.trim() || "Selfie";
      const resolutionText = cameraData["Resolution"] || "";
      const resolutionMatch = resolutionText.match(/\b(\d+\.?\d*)\b/);
      const resolution_mp = resolutionMatch
        ? parseFloat(resolutionMatch[1])
        : null;

      const apertureText = cameraData["Aperture"] || "";
      let aperture_fstop: string | null =
        apertureText.replace("ƒ/", "").trim() || null;
      if (aperture_fstop === "Unknown") aperture_fstop = null;

      const sensorText = cameraData["Sensor"];
      const sensor = sensorText === "--" ? null : (sensorText ?? null);

      return resolution_mp !== null
        ? {
            resolution_mp,
            aperture_fstop,
            sensor,
            type,
            features: "",
          }
        : null;
    })
    .filter(Boolean);
};

const getCameraFeatures = (features: Element[]): string[] => {
  return features.map((el) => el.textContent?.trim() || "").filter(Boolean);
};

const getSoftware = (
  input: string | null,
): { os: string; osSkin: string } | null => {
  if (!input) return null;

  const [osPart, _, osSkinPart] = input.split("\n");
  const osMatch = osPart?.trim().match(/\w+ ?[\d\.,]*/i);
  if (!osMatch) return null;

  const osSkinSplit = osSkinPart?.split("(") ?? [];
  return { os: osMatch[0], osSkin: osSkinSplit[0]?.trim() ?? "" };
};

export const extractPhoneData = async (
  page: Page,
  slug: string,
): Promise<RawPhoneData> => {
  const extractText = getTextExtractor(page);

  // Name and brand
  const nameText = await extractText("header .title-group #sec-start");
  const fullName = nameText
    ?.replace("Price and specifications on", "")
    .trim()
    .split(" ");
  const name = fullName ? fullName.slice(1).join(" ") : "";
  const brand = fullName ? fullName[0] : "";

  // Aliases
  const aliasesText = await extractText(
    'section.container-sheet-intro .k-dltable tr:has-text("Aliases") td',
  );
  const aliases = aliasesText
    ? aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
        .join("|")
    : "";

  // Release date
  const releaseDateText = await extractText(
    'section.container-sheet-intro .k-dltable tr:has-text("Release date") td',
  );
  const releaseDateStr = releaseDateText
    ? releaseDateText.split(",")[0].trim()
    : "";
  const releaseDate = releaseDateStr
    ? (parseReleaseDate(releaseDateStr)?.toISOString() ?? null)
    : null;

  // Images
  const images = await page.$$eval(
    "header .gallery-thumbs img, header .main-image img",
    (imgs) =>
      imgs
        .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
        .filter(Boolean)
        .join("|"),
  );

  // Dimensions
  const dimensionsText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Size") td',
  );
  let height_mm: number | null = null;
  let width_mm: number | null = null;
  let thickness_mm: number | null = null;
  if (dimensionsText) {
    const mmMatches = dimensionsText.match(/\b(\d+\.?\d*)\b/g);
    if (mmMatches && mmMatches.length === 3) {
      const values = mmMatches.map((m) => parseFloat(m)).sort((a, b) => b - a);
      height_mm = values[0] || null;
      width_mm = values[1] || null;
      thickness_mm = values[2] || null;
    }
  }

  // Weight
  const weightText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Weight") td',
  );
  let weight_g: number | null = null;
  const weightMatch = weightText?.match(/([\d.]+)\s*g/);
  if (weightMatch) weight_g = parseFloat(weightMatch[1]);

  // Materials
  const materialsText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Materials") td',
  );
  const materials = materialsText
    ? materialsText
        .replace(/\s+/g, " ")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
        .join("|")
    : "";

  // IP Rating
  const ipText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Resistance certificates") td',
  );
  const ipRating = ipText || null;

  // Colors
  const colors = await page.$$eval(
    'section.container-sheet-design .k-dltable tr:has-text("Colors") td .color-sep',
    (els) =>
      els
        .map((e) => e.textContent?.trim() || "")
        .filter(Boolean)
        .join("|"),
  );

  // Display
  const aspectRatio = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Aspect Ratio") td',
  );
  const displaySizeText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Diagonal") td',
  );
  let size_in: number | null = null;
  const displaySizeMatch = displaySizeText?.match(/([\d.]+)"/);
  if (displaySizeMatch) size_in = parseFloat(displaySizeMatch[1]);

  const displayType = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Type") td',
  );

  const displayResolutionText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Resolution") td',
  );
  const resolutionMatch = displayResolutionText?.match(/(\d+\s*x\s*\d+)/i);
  const resolution = resolutionMatch ? resolutionMatch[1] : null;

  const displayPpiText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Density") td',
  );
  const ppiMatch = displayPpiText?.match(/(\d+)\s*ppi/i);
  const ppi = ppiMatch ? parseInt(ppiMatch[1], 10) : null;

  const displayFeatures = await page.$$eval(
    'section.container-sheet-design .k-dltable tr:has-text("Others") td li',
    (els) =>
      els
        .map((e) => e.textContent?.trim() || "")
        .filter(Boolean)
        .join("|"),
  );

  // Hardware
  const cpuText = await extractText(
    'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("Model") td',
  );
  const [cpuManufacturer, ...cpuArr] = !cpuText ? [null] : cpuText.split(" ");
  const cpu = cpuArr?.join(" ") || null;

  const cpuCoresText = await extractText(
    'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("CPU") td',
  );
  const cpuCores = getCpuCores(cpuCoresText)?.join("|") ?? null;

  const gpu = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("GPU") td',
  );

  // SKUs
  let skus: Sku[] = [];
  try {
    const skusDataJson = await page.$eval(
      "header .grouped-versions-list",
      (e) => e.getAttribute("data-versions"),
    );
    if (skusDataJson) {
      const skusData = JSON.parse(skusDataJson);
      const marketsData = Object.values(skusData) as DirtyMarket[];
      const groupedSkus: Record<string, Sku> = {};
      marketsData.forEach((market) => {
        const dirtySkus = Object.values(market.devices) as DirtySku[];
        dirtySkus.forEach((sku) => {
          const ram_gb = sku.ram / 1024;
          const storage_gb = sku.rom / 1024;
          const key = `${ram_gb}/${storage_gb}`;
          if (groupedSkus[key]) {
            if (!groupedSkus[key].marketId.includes(market.mkid)) {
              groupedSkus[key] = new Sku({
                ...groupedSkus[key],
                marketId: groupedSkus[key].marketId + "|" + market.mkid,
              });
            }
          } else {
            groupedSkus[key] = new Sku({
              marketId: market.mkid,
              ram_gb,
              storage_gb,
            });
          }
        });
      });
      skus = Object.values(groupedSkus);
    }
  } catch {
    // SKUs not available
  }

  // SD Slot
  const sdSlotText = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("SD Slot") td',
  );
  const sdSlot = sdSlotText ? sdSlotText.includes("Yes") : null;

  // Fingerprint
  const fingerprintPositionText = await extractText(
    'section.container-sheet-hardware h3:has-text("Security") + .k-dltable tr:has-text("Fingerprint") td',
  );
  const fingerprintPosition: "screen" | "side" | "back" | null =
    fingerprintPositionText?.includes("screen")
      ? "screen"
      : fingerprintPositionText?.includes("side")
        ? "side"
        : fingerprintPositionText?.includes("back")
          ? "back"
          : null;

  // Benchmarks
  const benchmarks: Benchmark[] = [];
  const antutuText = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("Score") td',
  );
  if (antutuText) {
    const [antutuScore, antutuVersion] = antutuText
      .split("\n")
      .map((part) => part.replace(/[•\.,]/g, "").trim());
    if (antutuScore && antutuVersion) {
      benchmarks.push(
        new Benchmark({
          name: antutuVersion,
          score: parseFloat(antutuScore),
        }),
      );
    }
  }

  // Cameras ($$eval returns plain objects, convert to SingleCameraData)
  const rearCamerasFromTables = await page.$$eval(
    'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks table',
    getCameras,
  );
  const rearCamerasFromDls = await page.$$eval(
    'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks dl',
    getCameras,
  );
  const rearCameras = [...rearCamerasFromTables, ...rearCamerasFromDls];
  const rearCameraFeatures = await page.$$eval(
    'section.container-sheet-camera table.k-dltable th:has-text("Features") + td li',
    getCameraFeatures,
  );
  const frontCameras = await page.$$eval(
    'section.container-sheet-camera h3.k-h4:has-text("Selfie") + .k-column-blocks table',
    getCameras,
  );
  const frontCameraFeatures = await page.$$eval(
    'section.container-sheet-camera dl.k-dl dt:has-text("Extra") + dd li',
    getCameraFeatures,
  );

  const cameras = [...rearCameras, ...frontCameras].map(
    (c) => new SingleCameraData(c as any),
  );
  const cameraFeatures = [...rearCameraFeatures, ...frontCameraFeatures].join(
    "|",
  );

  // Connectivity
  const nfcText = await extractText(
    'section.container-sheet-connectivity dl.k-dl dt:has-text("NFC") + dd',
  );
  const nfc = nfcText ? nfcText.includes("Yes") : null;

  const bluetoothText = await extractText(
    'section.container-sheet-connectivity h3.k-h4:has-text("Bluetooth") + .k-dltable tr:has-text("Version") td',
  );
  const bluetoothMatch = bluetoothText?.match(/Bluetooth\s([\d.]+)/i);
  const bluetooth = bluetoothMatch ? `Bluetooth ${bluetoothMatch[1]}` : null;

  const usbText = await extractText(
    'section.container-sheet-connectivity .k-dltable tr:has-text("Proprietary") td',
  );
  const usb: "USB-A" | "USB-C" | "Lightning" | null =
    usbText && usbText.includes("Yes") ? "Lightning" : "USB-C";

  const simText = await extractText(
    'section.container-sheet-connectivity h3.k-h4:has-text("SIM card") + .k-dltable tr:has-text("Type") td',
  );
  const sim: Sim[] = [];
  if (simText) {
    let trimmedSimText = simText.slice(
      simText.indexOf("("),
      simText.indexOf(")") + 1,
    );
    for (const simType of SIM_TYPES) {
      const i = trimmedSimText.indexOf(simType);
      if (i !== -1 && trimmedSimText) {
        sim.push(simType);
        trimmedSimText =
          trimmedSimText.slice(0, i) + trimmedSimText.slice(i + simType.length);
      }
    }
  }

  const headphoneJackText = await extractText(
    'section.container-sheet-connectivity .k-dltable tr:has-text("Audio Jack") td',
  );
  const headphoneJack = headphoneJackText === "Yes";

  // Battery
  const batteryCapacityText = await extractText(
    'section.container-sheet-battery .k-dltable tr:has-text("Capacity") td',
  );
  const batteryCapacity_mah = batteryCapacityText
    ? parseInt(batteryCapacityText)
    : null;

  const fastChargingText = await extractText(
    'section.container-sheet-battery .k-dltable tr:has-text("Fast charge") td',
  );
  const batteryFastCharging = fastChargingText
    ? fastChargingText.includes("Yes")
    : null;
  const batteryWattageMatch = fastChargingText
    ?.toLowerCase()
    ?.match(/(\d*(?:\.\d+)?)w/i);
  const batteryWattage = batteryWattageMatch
    ? parseFloat(batteryWattageMatch[1])
    : null;

  // Software
  const osText = await extractText(
    'section.container-sheet-software .k-dltable tr:has-text("Operating System") td',
  );
  const software = getSoftware(osText);

  const data: RawPhoneData = {
    slug,
    name,
    brand,
    aliases,
    releaseDate,
    images: images || null,
    height_mm,
    width_mm,
    thickness_mm,
    weight_g,
    materials,
    ipRating,
    colors,
    size_in,
    displayType,
    resolution,
    aspectRatio,
    ppi,
    displayFeatures,
    cpu,
    cpuManufacturer: cpuManufacturer ?? null,
    cpuCores,
    gpu,
    sdSlot,
    skus,
    fingerprintPosition,
    benchmarks,
    nfc,
    bluetooth,
    sim: sim.join("|"),
    simCount: sim.length,
    usb,
    headphoneJack,
    batteryCapacity_mah,
    batteryFastCharging,
    batteryWattage,
    cameras,
    cameraFeatures,
    os: software?.os ?? null,
    osSkin: software?.osSkin ?? null,
    scores: null,
    others: null,
  };

  return data;
};

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
    const storageService = yield* StorageService;
    const openaiService = yield* OpenAIService;

    const backgroundRefresh = async (slug: string) => {
      console.log(`[SWR] Starting background refresh for ${slug}`);
      try {
        const browser = await Effect.runPromise(browserService.createBrowser());
        try {
          const page = await browser.newPage();
          await Effect.runPromise(browserService.abortExtraResources(page));
          const { data, fullHtml } = await scrapePhoneData(page, slug);
          await Effect.runPromise(
            storageService
              .saveRawHtml(slug, fullHtml)
              .pipe(Effect.catchAll(() => Effect.void)),
          );
          await Effect.runPromise(
            storageService
              .savePhoneDataRaw(slug, data as unknown as Record<string, unknown>)
              .pipe(Effect.catchAll(() => Effect.void)),
          );
          console.log(`[SWR] Background refresh complete for ${slug}`);
        } finally {
          await browser.close();
        }
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
            storageService
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
              storageService
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
              storageService
                .savePhoneData(slug, phoneData as unknown as Record<string, unknown>)
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
            storageService
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
              storageService
                .saveRawHtml(slug, fullHtml)
                .pipe(Effect.catchAll(() => Effect.void)),
            );

            await Effect.runPromise(
              storageService
                .savePhoneDataRaw(slug, data as unknown as Record<string, unknown>)
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
