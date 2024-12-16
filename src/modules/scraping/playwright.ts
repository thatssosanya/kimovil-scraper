import { Browser, chromium, Page } from "playwright";
import {
  AutocompleteOption,
  SingleCameraData,
  DirtyMarket,
  DirtySku,
  PhoneData,
  Sim,
  Sku,
} from "../../types";
import { PLAYWRIGHT_TIMEOUT, SIM_TYPES } from "../../utils/consts";
import { debugLog } from "../../utils/logging";

export const createBrightDataBrowser = async (tag?: string) => {
  if (process.env.LOCAL_PLAYWRIGHT) {
    const browser = await chromium.launch({ headless: false });
    debugLog("Launched local headful Chromium.");
    return browser;
  }
  const wsEndpoint = process.env.BRD_WSENDPOINT;
  if (!wsEndpoint) {
    throw new Error("BRD_WSENDPOINT is not available in env.");
  }

  const browser = await chromium.connectOverCDP(wsEndpoint!, {
    timeout: PLAYWRIGHT_TIMEOUT,
  });

  debugLog(
    `${tag ? "[" + tag + "] " : ""}Connected to Bright Data scraping browser.`
  );

  return browser;
};

export async function scrapeBySlug(
  slug: string
): Promise<{ raw: string; parsed: PhoneData }> {
  let browser: Browser | null = null;
  try {
    browser = await createBrightDataBrowser("scrapeBySlug");
    const page = await browser.newPage();
    const url =
      process.env.ENV === "development" && process.env.LOCAL_PLAYWRIGHT
        ? `http://127.0.0.1:8080/Apple%20iPhone%2014_%20Price%20(from%20566.31%24)%20and%20specifications%20%5BDecember%202024%5D.html`
        : `https://www.kimovil.com/en/where-to-buy-${slug}`;
    await page.goto(url, { waitUntil: "load" });
    debugLog(`Navigated to ${url}.`);

    const raw = await page.content();

    const nameText = await page.$eval(
      "header .title-group #sec-start",
      getTrimmedText
    );
    const fullName = nameText
      .replace("Price and specifications on", "")
      .trim()
      .split(" ");
    const name = fullName.slice(1).join(" ");
    const brand = fullName[0];

    const aliasesText = await page.$eval(
      'section.container-sheet-intro .k-dltable tr:has-text("Aliases") td',
      getTrimmedText
    );
    const aliases = aliasesText
      ? aliasesText
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    const releaseDateText = await page.$eval(
      'section.container-sheet-intro .k-dltable tr:has-text("Release date") td',
      getTrimmedText
    );
    const releaseDate = releaseDateText
      ? releaseDateText.split(",")[0].trim()
      : "";

    const dimensionsText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Size") td',
      getTrimmedText
    );
    let height: number | null = null;
    let width: number | null = null;
    let thickness: number | null = null;
    if (dimensionsText) {
      const mmMatches = dimensionsText.match(/\b(\d+\.?\d*)\b/g);
      // assuming height > width > thickness
      if (mmMatches && mmMatches.length === 3) {
        const values = mmMatches
          .map((m) => parseFloat(m))
          .sort((a, b) => b - a);
        height = values[0] || null;
        width = values[1] || null;
        thickness = values[2] || null;
      }
    }

    const weightText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Weight") td',
      getTrimmedText
    );
    let weight: number | null = null;
    const weightMatch = weightText.match(/([\d.]+)\s*g/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]);
    }

    const materialsText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Materials") td',
      getTrimmedText
    );
    const materials = materialsText
      ? materialsText
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
      : [];

    const ipText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Resistance certificates") td',
      getTrimmedText
    );
    const ipRating = ipText || null;

    const colors = await page.$$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Colors") td .color-sep',
      (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
    );

    const displaySizeText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Diagonal") td',
      getTrimmedText
    );
    let displaySize: number | null = null;
    const displaySizeMatch = displaySizeText.match(/([\d.]+)"/);
    if (displaySizeMatch) {
      displaySize = parseFloat(displaySizeMatch[1]);
    }

    const displayType = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Type") td',
      getTrimmedText
    );

    const displayResolutionText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Resolution") td',
      getTrimmedText
    );
    const resolutionMatch = displayResolutionText.match(/(\d+\s*x\s*\d+)/i);
    let displayResolution: string | null = null;
    if (resolutionMatch) {
      displayResolution = resolutionMatch[1];
    }

    const displayPpiText = await page.$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Density") td',
      getTrimmedText
    );
    const ppiMatch = displayPpiText.match(/(\d+)\s*ppi/i);
    let displayPpi = ppiMatch ? parseInt(ppiMatch[1], 10) : null;

    const displayFeatures = await page.$$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Others") td li',
      (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
    );

    const cpu = await page.$eval(
      'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("Model") td',
      getTrimmedText
    );

    const gpu = await page.$eval(
      'section.container-sheet-hardware .k-dltable tr:has-text("GPU") td',
      getTrimmedText
    );

    const skusDataJson = await page.$eval(
      "header .grouped-versions-list",
      (e) => e.getAttribute("data-versions")
    );
    const skusData = JSON.parse(skusDataJson!);
    const marketsData = Object.values(skusData) as DirtyMarket[];
    const foundSkusHashes = [] as string[];
    const skus = marketsData.reduce((acc, market) => {
      const devices = Object.values(market.devices) as DirtySku[];

      const cleanSkus = devices.map((device) => ({
        marketId: market.mkid,
        ram_gb: device.ram / 1024,
        storage_gb: device.rom / 1024,
      }));

      cleanSkus.forEach((sku) => {
        const skuHash = `${sku.marketId}/${sku.ram_gb}/${sku.storage_gb}`;
        if (!foundSkusHashes.includes(skuHash)) {
          foundSkusHashes.push(skuHash);
          acc.push(sku);
        }
      });

      return acc;
    }, [] as Sku[]);

    const sdSlotText = await page.$eval(
      'section.container-sheet-hardware .k-dltable tr:has-text("SD Slot") td',
      getTrimmedText
    );
    const sdSlot = sdSlotText ? sdSlotText.includes("Yes") : null;

    const rearCamerasFromTables: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks table',
      getCameras
    );
    const rearCamerasFromDls: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks dl',
      getCameras
    );
    const rearCameras = [...rearCamerasFromTables, ...rearCamerasFromDls];
    const rearCamerasFeatures: string[] = await page.$$eval(
      'section.container-sheet-camera table.k-dltable th:has-text("Features") + td li',
      getCamerasFeatures
    );
    const frontCameras: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3.k-h4:has-text("Selfie") + .k-column-blocks table',
      getCameras
    );
    const frontCamerasFeatures: string[] = await page.$$eval(
      'section.container-sheet-camera dl.k-dl dt:has-text("Extra") + dd li',
      getCamerasFeatures
    );

    const nfcText = await page.$eval(
      'section.container-sheet-connectivity dl.k-dl dt:has-text("NFC") + dd',
      getTrimmedText
    );
    const nfc = nfcText ? nfcText.includes("Yes") : null;

    const bluetoothText = await page.$eval(
      'section.container-sheet-connectivity h3.k-h4:has-text("Bluetooth") + .k-dltable tr:has-text("Version") td',
      getTrimmedText
    );
    const bluetoothMatch = bluetoothText.match(/Bluetooth\s([\d.]+)/i);
    const bluetooth = bluetoothMatch ? `Bluetooth ${bluetoothMatch[1]}` : "";

    const usbText = await page.$eval(
      'section.container-sheet-connectivity .k-dltable tr:has-text("Proprietary") td',
      getTrimmedText
    );
    const usb = !usbText
      ? null
      : usbText.includes("Yes")
      ? "Lightning"
      : "USB-C";

    const simText = await page.$eval(
      'section.container-sheet-connectivity h3.k-h4:has-text("SIM card") + .k-dltable tr:has-text("Type") td',
      getTrimmedText
    );
    let trimmedText = simText.slice(
      simText.indexOf("("),
      simText.indexOf(")") + 1
    );
    let sim: Sim[] = [];
    for (const simType of SIM_TYPES) {
      const i = trimmedText.indexOf(simType);
      if (i !== -1) {
        sim.push(simType);
        trimmedText =
          trimmedText.slice(0, i) + trimmedText.slice(i + simType.length);
      }
    }

    const batteryCapacityText = await page.$eval(
      'section.container-sheet-battery .k-dltable tr:has-text("Capacity") td',
      getTrimmedText
    );
    const batteryCapacity = parseInt(batteryCapacityText);
    const fastChargingText = await page.$eval(
      'section.container-sheet-battery .k-dltable tr:has-text("Fast charge") td',
      getTrimmedText
    );
    const fastCharging = fastChargingText
      ? fastChargingText.includes("Yes")
      : null;

    const parsed: PhoneData = {
      name,
      brand,
      aliases,
      releaseDate,
      design: {
        dimensions_mm:
          height && width && thickness
            ? {
                height,
                width,
                thickness,
              }
            : null,
        weight_g: weight,
        materials,
        ipRating,
        colors,
      },
      display: {
        size_in: displaySize,
        type: displayType,
        resolution: displayResolution,
        ppi: displayPpi,
        features: displayFeatures,
      },
      hardware: {
        skus,
        cpu,
        gpu,
        sdSlot,
      },
      camera: {
        rear: { cameras: rearCameras, features: rearCamerasFeatures },
        front: { cameras: frontCameras, features: frontCamerasFeatures },
      },
      connectivity: {
        nfc,
        bluetooth,
        usb,
        sim,
        headphoneJack: false,
      },
      battery: {
        capacity_mah: batteryCapacity,
        fastCharging,
      },
    };

    return { raw, parsed };
  } catch (e) {
    throw e;
  } finally {
    browser?.close();
  }
}

export async function getAutocompleteOptions(
  name: string
): Promise<AutocompleteOption[]> {
  let browser: Browser | null = null;
  try {
    browser = await createBrightDataBrowser("getAutocompleteOptions");
    const page = await browser.newPage();

    await page.goto(
      "https://www.kimovil.com/_json/autocomplete_devicemodels_joined.json?device_type=0&name=" +
        encodeURIComponent(name)
    );

    const dirtyJson = await page.content();
    const json = dirtyJson.slice(
      dirtyJson.indexOf("{"),
      dirtyJson.lastIndexOf("}") + 1
    );

    const response = JSON.parse(json) as {
      results: { full_name: string; url: string }[];
    };

    return response.results.map(({ full_name: name, url: slug }) => ({
      name,
      slug,
    }));
  } catch (e) {
    throw e;
  } finally {
    browser?.close();
  }
}

const getTrimmedText = (e: HTMLElement) => e.textContent?.trim() || "";

const getCameras = (cameraTables: Element[]): SingleCameraData[] => {
  return cameraTables
    .map((el) => {
      const specMap: Record<string, string> = {};

      // some cameras may be presented in tables, some in dls
      if (el.tagName === "TABLE") {
        el.querySelectorAll("tr").forEach((row) => {
          const th = row.querySelector("th")?.textContent?.trim();
          const td = row.querySelector("td")?.textContent?.trim();
          if (th && td) {
            specMap[th] = td;
          }
        });
      } else if (el.tagName === "DL") {
        let currentKey = "";
        el.querySelectorAll("dt, dd").forEach((item) => {
          if (item.tagName === "DT") {
            currentKey = item.textContent?.trim() || "";
          } else if (item.tagName === "DD" && currentKey) {
            const value = item.textContent?.trim() || "";
            specMap[currentKey] = value;
          }
        });
      }

      const resolutionText = specMap["Resolution"] || "";
      const resolutionMatch = resolutionText.match(/\b(\d+\.?\d*)\b/);
      const resolution_mp = resolutionMatch
        ? parseFloat(resolutionMatch[1])
        : null;

      const apertureText = specMap["Aperture"] || "";
      const aperture_fstop = apertureText.replace("ƒ/", "").trim() || null;

      const sensorText = specMap["Sensor"];
      const sensor = sensorText === "--" ? null : sensorText;

      return resolution_mp !== null
        ? { resolution_mp, aperture_fstop, sensor }
        : null;
    })
    .filter(Boolean) as SingleCameraData[];
};

const getCamerasFeatures = (features: Element[]): string[] => {
  return features.map((el) => el.textContent?.trim() || "").filter(Boolean);
};
