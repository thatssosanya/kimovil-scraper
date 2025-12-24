import { Effect, Option } from "effect";
import { Page } from "playwright";
import { SingleCameraData, Sku, Benchmark } from "@repo/scraper-protocol";
import { getCpuCores, getCpuCoreClusters, parseReleaseDate, getSoftware, parseSim } from "./parsers";
import type { CpuCoreCluster } from "./parsers";
import {
  ExtractionContext,
  ExtractionError,
  ExtractionIssue,
  ExtractionResult,
  extractImages,
  extractScores,
  extractOthers,
  ensureHttpsProtocol,
} from "./extraction";



type DirtySku = { ram: number; rom: number };
type DirtyMarket = { mkid: string; devices: DirtySku[] };

export interface RawPhoneData {
  slug: string;
  name: string;
  brand: string;
  aliases: string[];
  releaseDate: string | null;
  images: string[] | null;
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
  cpuCoreClusters: CpuCoreCluster[] | null;
  gpu: string | null;
  sdSlot: boolean | null;
  skus: Sku[];
  fingerprintPosition: "screen" | "side" | "back" | null;
  benchmarks: Benchmark[];
  nfc: boolean | null;
  bluetooth: string | null;
  sim: string[];
  simCount: number;
  usb: "USB-A" | "USB-C" | "Lightning" | null;
  headphoneJack: boolean | null;
  batteryCapacity_mah: number | null;
  batteryFastCharging: boolean | null;
  batteryWattage: number | null;
  cameras: SingleCameraData[];
  cameraFeatures: string[];
  os: string | null;
  osSkin: string | null;
  scores: string | null;
  others: string[] | null;
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

export const getCameras = (cameraTables: Element[]) => {
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

export const getCameraFeatures = (features: Element[]): string[] => {
  return features.map((el) => el.textContent?.trim() || "").filter(Boolean);
};

export const extractPhoneDataAsync = async (
  page: Page,
  slug: string
): Promise<RawPhoneData> => {
  const extractText = getTextExtractor(page);

  const nameText = await extractText("header .title-group #sec-start");
  const fullName = nameText
    ?.replace("Price and specifications on", "")
    .trim()
    .split(" ");
  const name = fullName ? fullName.slice(1).join(" ") : "";
  const brand = fullName ? fullName[0] : "";

  const aliasesText = await extractText(
    'section.container-sheet-intro .k-dltable tr:has-text("Aliases") td'
  );
  const aliases = aliasesText
    ? aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  const releaseDateText = await extractText(
    'section.container-sheet-intro .k-dltable tr:has-text("Release date") td'
  );
  const releaseDateStr = releaseDateText
    ? releaseDateText.split(",")[0].trim()
    : "";
  const releaseDate = releaseDateStr
    ? (parseReleaseDate(releaseDateStr)?.toISOString() ?? null)
    : null;

  let images: string[] | null = null;

  const imagesArr = await page.$$eval(
    "header .gallery-thumbs img, header .device-main-image img",
    (imgs) =>
      imgs
        .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
        .filter((src): src is string => Boolean(src))
  );
  if (imagesArr.length > 0) {
    images = imagesArr.map(ensureHttpsProtocol);
  }

  if (!images) {
    const galleryImages = await page.$$eval(".product-gallery img", (imgs) =>
      imgs
        .map((img) => img.getAttribute("src"))
        .filter((src): src is string => Boolean(src))
    );
    if (galleryImages.length > 0) {
      images = galleryImages.map(ensureHttpsProtocol);
    }
  }

  if (!images) {
    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute("content")
    ).catch(() => null);
    if (ogImage) {
      images = [ensureHttpsProtocol(ogImage)];
    }
  }

  const dimensionsText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Size") td'
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

  const weightText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Weight") td'
  );
  let weight_g: number | null = null;
  const weightMatch = weightText?.match(/([\d.]+)\s*g/);
  if (weightMatch) weight_g = parseFloat(weightMatch[1]);

  const materialsText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Materials") td'
  );
  const materials = materialsText
    ? materialsText
        .replace(/\s+/g, " ")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  const ipText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Resistance certificates") td'
  );
  const ipRating = ipText || null;

  const colors = await page.$$eval(
    'section.container-sheet-design .k-dltable tr:has-text("Colors") td .color-sep',
    (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
  );

  const aspectRatio = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Aspect Ratio") td'
  );
  const displaySizeText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Diagonal") td'
  );
  let size_in: number | null = null;
  const displaySizeMatch = displaySizeText?.match(/([\d.]+)"/);
  if (displaySizeMatch) size_in = parseFloat(displaySizeMatch[1]);

  const displayType = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Type") td'
  );

  const displayResolutionText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Resolution") td'
  );
  const resolutionMatch = displayResolutionText?.match(/(\d+\s*x\s*\d+)/i);
  const resolution = resolutionMatch ? resolutionMatch[1] : null;

  const displayPpiText = await extractText(
    'section.container-sheet-design .k-dltable tr:has-text("Density") td'
  );
  const ppiMatch = displayPpiText?.match(/(\d+)\s*ppi/i);
  const ppi = ppiMatch ? parseInt(ppiMatch[1], 10) : null;

  const displayFeatures = await page.$$eval(
    'section.container-sheet-design .k-dltable tr:has-text("Others") td li',
    (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
  );

  const cpuText = await extractText(
    'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("Model") td'
  );
  const [cpuManufacturer, ...cpuArr] = !cpuText ? [null] : cpuText.split(" ");
  const cpu = cpuArr?.join(" ") || null;

  const cpuCoresText = await extractText(
    'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("CPU") td'
  );
  const cpuCores = getCpuCores(cpuCoresText) ?? null;
  const cpuCoreClusters = getCpuCoreClusters(cpuCoresText) ?? null;

  const gpu = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("GPU") td'
  );

  let skus: Sku[] = [];
  try {
    const skusDataJson = await page.$eval(
      "header .grouped-versions-list",
      (e) => e.getAttribute("data-versions")
    );
    if (skusDataJson) {
      const skusData = JSON.parse(skusDataJson);
      const marketsData = Object.values(skusData) as DirtyMarket[];
      const groupedSkus: Record<
        string,
        { marketIds: string[]; ram_gb: number; storage_gb: number }
      > = {};
      marketsData.forEach((market) => {
        const dirtySkus = Object.values(market.devices) as DirtySku[];
        dirtySkus.forEach((sku) => {
          const ram_gb = sku.ram / 1024;
          const storage_gb = sku.rom / 1024;
          const key = `${ram_gb}/${storage_gb}`;
          if (groupedSkus[key]) {
            if (!groupedSkus[key].marketIds.includes(market.mkid)) {
              groupedSkus[key].marketIds.push(market.mkid);
            }
          } else {
            groupedSkus[key] = {
              marketIds: [market.mkid],
              ram_gb,
              storage_gb,
            };
          }
        });
      });
      skus = Object.values(groupedSkus).map(
        (s) =>
          new Sku({
            marketIds: s.marketIds,
            ram_gb: s.ram_gb,
            storage_gb: s.storage_gb,
          })
      );
    }
  } catch {
    // SKUs not available
  }

  const sdSlotText = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("SD Slot") td'
  );
  const sdSlot = sdSlotText ? sdSlotText.includes("Yes") : null;

  const fingerprintPositionText = await extractText(
    'section.container-sheet-hardware h3:has-text("Security") + .k-dltable tr:has-text("Fingerprint") td'
  );
  const fingerprintPosition: "screen" | "side" | "back" | null =
    fingerprintPositionText?.includes("screen")
      ? "screen"
      : fingerprintPositionText?.includes("side")
        ? "side"
        : fingerprintPositionText?.includes("back")
          ? "back"
          : null;

  const benchmarks: Benchmark[] = [];
  const antutuText = await extractText(
    'section.container-sheet-hardware .k-dltable tr:has-text("Score") td'
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
        })
      );
    }
  }

  const rearCamerasFromTables = await page.$$eval(
    'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks table',
    getCameras
  );
  const rearCamerasFromDls = await page.$$eval(
    'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks dl',
    getCameras
  );
  const rearCameras = [...rearCamerasFromTables, ...rearCamerasFromDls];
  const rearCameraFeatures = await page.$$eval(
    'section.container-sheet-camera table.k-dltable th:has-text("Features") + td li',
    getCameraFeatures
  );
  const frontCameras = await page.$$eval(
    'section.container-sheet-camera h3.k-h4:has-text("Selfie") + .k-column-blocks table',
    getCameras
  );
  const frontCameraFeatures = await page.$$eval(
    'section.container-sheet-camera dl.k-dl dt:has-text("Extra") + dd li',
    getCameraFeatures
  );

  const cameras = [...rearCameras, ...frontCameras].map(
    (c) => new SingleCameraData({ ...c, features: [] } as any)
  );
  const cameraFeatures = [...rearCameraFeatures, ...frontCameraFeatures];

  const nfcText = await extractText(
    'section.container-sheet-connectivity dl.k-dl dt:has-text("NFC") + dd'
  );
  const nfc = nfcText ? nfcText.includes("Yes") : null;

  const bluetoothText = await extractText(
    'section.container-sheet-connectivity h3.k-h4:has-text("Bluetooth") + .k-dltable tr:has-text("Version") td'
  );
  const bluetoothMatch = bluetoothText?.match(/Bluetooth\s([\d.]+)/i);
  const bluetooth = bluetoothMatch ? `Bluetooth ${bluetoothMatch[1]}` : null;

  const usbText = await extractText(
    'section.container-sheet-connectivity .k-dltable tr:has-text("Proprietary") td'
  );
  const usb: "USB-A" | "USB-C" | "Lightning" | null =
    usbText && usbText.includes("Yes") ? "Lightning" : "USB-C";

  const simText = await extractText(
    'section.container-sheet-connectivity h3.k-h4:has-text("SIM card") + .k-dltable tr:has-text("Type") td'
  );
  const simInfo = parseSim(simText);
  const sim = simInfo.simTypes;
  const simCount = simInfo.simCount;

  const headphoneJackText = await extractText(
    'section.container-sheet-connectivity .k-dltable tr:has-text("Audio Jack") td'
  );
  const headphoneJack = headphoneJackText === "Yes";

  const batteryCapacityText = await extractText(
    'section.container-sheet-battery .k-dltable tr:has-text("Capacity") td'
  );
  const batteryCapacity_mah = batteryCapacityText
    ? parseInt(batteryCapacityText)
    : null;

  const fastChargingText = await extractText(
    'section.container-sheet-battery .k-dltable tr:has-text("Fast charge") td'
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

  const osText = await extractText(
    'section.container-sheet-software .k-dltable tr:has-text("Operating System") td'
  );
  const software = getSoftware(osText);

  let scores: string | null = null;
  try {
    const prosConsItems = await page.$$eval(
      ".pros-and-cons-list li, .pros li, .cons li, .advantages li, .disadvantages li",
      (els) =>
        els.map((el) => el.textContent?.trim()).filter((t): t is string => Boolean(t))
    );
    if (prosConsItems.length > 0) {
      scores = prosConsItems.join("|");
    }
  } catch {
    // Not found
  }

  let others: string[] | null = null;
  try {
    const features: string[] = [];

    const stereoText = await extractText(
      'section.container-sheet-connectivity .k-dltable tr:has-text("Speakers") td'
    );
    if (stereoText?.toLowerCase().includes("stereo")) {
      features.push("Stereo speakers");
    }

    const videoText = await extractText(
      'section.container-sheet-camera .k-dltable tr:has-text("Video") td'
    );
    if (videoText) {
      if (videoText.includes("8K")) features.push("8K video");
      if (videoText.includes("4K")) {
        const fps = videoText.match(/4K\s*@?\s*(\d+)/i);
        features.push(fps ? `4K@${fps[1]}fps` : "4K video");
      }
      if (videoText.toLowerCase().includes("slow motion"))
        features.push("Slow motion");
    }

    const wirelessText = await extractText(
      'section.container-sheet-battery .k-dltable tr:has-text("Wireless") td'
    );
    if (wirelessText?.toLowerCase().includes("yes")) {
      features.push("Wireless charging");
    }

    const wifiText = await extractText(
      'section.container-sheet-connectivity .k-dltable tr:has-text("Wi-Fi") td'
    );
    if (wifiText) {
      const match = wifiText.match(/Wi-Fi\s*(\d+[a-z]*)/i);
      if (match) features.push(`WiFi ${match[1]}`);
    }

    if (features.length > 0) {
      others = features;
    }
  } catch {
    // Not found
  }

  const data: RawPhoneData = {
    slug,
    name,
    brand,
    aliases,
    releaseDate,
    images,
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
    cpuCoreClusters,
    gpu,
    sdSlot,
    skus,
    fingerprintPosition,
    benchmarks,
    nfc,
    bluetooth,
    sim,
    simCount,
    usb,
    headphoneJack,
    batteryCapacity_mah,
    batteryFastCharging,
    batteryWattage,
    cameras,
    cameraFeatures,
    os: software?.os ?? null,
    osSkin: software?.osSkin ?? null,
    scores,
    others,
  };

  return data;
};

export const extractPhoneData = (
  page: Page,
  slug: string
): Effect.Effect<ExtractionResult<RawPhoneData>, ExtractionError> =>
  Effect.gen(function* () {
    const issues: ExtractionIssue[] = [];
    const ctx: ExtractionContext = { page };

    const data = yield* Effect.tryPromise({
      try: () => extractPhoneDataAsync(page, slug),
      catch: (e) =>
        new ExtractionError(
          "name",
          "",
          "extractPhoneData",
          e instanceof Error ? e.message : String(e)
        ),
    });

    const imagesResult = yield* extractImages(ctx).pipe(
      Effect.catchAll(() => Effect.succeed({ value: null, issues: [] }))
    );
    issues.push(...imagesResult.issues);
    if (imagesResult.value && imagesResult.value.length > 0) {
      data.images = imagesResult.value;
    }

    const scoresResult = yield* extractScores(ctx).pipe(
      Effect.catchAll(() => Effect.succeed({ value: null, issues: [] }))
    );
    issues.push(...scoresResult.issues);
    if (scoresResult.value) {
      data.scores = scoresResult.value;
    }

    const othersResult = yield* extractOthers(ctx).pipe(
      Effect.catchAll(() => Effect.succeed({ value: null, issues: [] }))
    );
    issues.push(...othersResult.issues);
    if (othersResult.value && othersResult.value.length > 0) {
      data.others = othersResult.value;
    }

    return { data, issues };
  });
