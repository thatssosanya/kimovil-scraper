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
import { debugLog, withDebugLog } from "../../utils/logging";

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

export const scrapeBySlug = withDebugLog(async (slug: string) => {
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

    const extractText = getTextExtractor(page);

    const nameText = await extractText("header .title-group #sec-start");
    const fullName = nameText
      ?.replace("Price and specifications on", "")
      .trim()
      .split(" ");
    const name = fullName ? fullName.slice(1).join(" ") : null;
    const brand = fullName ? fullName[0] : null;

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
    const releaseDate = releaseDateText
      ? releaseDateText.split(",")[0].trim()
      : "";

    const dimensionsText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Size") td'
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

    const weightText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Weight") td'
    );
    let weight: number | null = null;
    const weightMatch = weightText?.match(/([\d.]+)\s*g/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]);
    }

    const materialsText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Materials") td'
    );
    const materials = materialsText
      ? materialsText
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

    const displaySizeText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Diagonal") td'
    );
    let displaySize: number | null = null;
    const displaySizeMatch = displaySizeText?.match(/([\d.]+)"/);
    if (displaySizeMatch) {
      displaySize = parseFloat(displaySizeMatch[1]);
    }

    const displayType = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Type") td'
    );

    const displayResolutionText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Resolution") td'
    );
    const resolutionMatch = displayResolutionText?.match(/(\d+\s*x\s*\d+)/i);
    let displayResolution: string | null = null;
    if (resolutionMatch) {
      displayResolution = resolutionMatch[1];
    }

    const displayPpiText = await extractText(
      'section.container-sheet-design .k-dltable tr:has-text("Density") td'
    );
    const ppiMatch = displayPpiText?.match(/(\d+)\s*ppi/i);
    let displayPpi = ppiMatch ? parseInt(ppiMatch[1], 10) : null;

    const displayFeatures = await page.$$eval(
      'section.container-sheet-design .k-dltable tr:has-text("Others") td li',
      (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
    );

    const cpu = await extractText(
      'section.container-sheet-hardware h3:has-text("Processor") + .k-dltable tr:has-text("Model") td'
    );

    const gpu = await extractText(
      'section.container-sheet-hardware .k-dltable tr:has-text("GPU") td'
    );

    const skusDataJson = await page.$eval(
      "header .grouped-versions-list",
      (e) => e.getAttribute("data-versions")
    );
    const skusData = JSON.parse(skusDataJson!);
    const marketsData = Object.values(skusData) as DirtyMarket[];
    const foundSkusHashes = [] as string[];
    const skus = marketsData.reduce((acc, market) => {
      const dirtySkus = Object.values(market.devices) as DirtySku[];

      const cleanSkus = dirtySkus.map((sku) => ({
        marketId: market.mkid,
        ram_gb: sku.ram / 1024,
        storage_gb: sku.rom / 1024,
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

    const sdSlotText = await extractText(
      'section.container-sheet-hardware .k-dltable tr:has-text("SD Slot") td'
    );
    const sdSlot = sdSlotText ? sdSlotText.includes("Yes") : null;

    const rearCamerasFromTables: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks table',
      getCameraExtractor, false
    );
    const rearCamerasFromDls: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3:has-text("rear camera") + .k-column-blocks dl',
      getCameraExtractor, false
    );
    const rearCameras = [...rearCamerasFromTables, ...rearCamerasFromDls];
    const rearCameraFeatures: string[] = await page.$$eval(
      'section.container-sheet-camera table.k-dltable th:has-text("Features") + td li',
      getCameraFeatures
    );
    const frontCameras: SingleCameraData[] = await page.$$eval(
      'section.container-sheet-camera h3.k-h4:has-text("Selfie") + .k-column-blocks table',
      getCameraExtractor, true
    );
    const frontCameraFeatures: string[] = await page.$$eval(
      'section.container-sheet-camera dl.k-dl dt:has-text("Extra") + dd li',
      getCameraFeatures
    );

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
    const usb = !usbText
      ? null
      : usbText.includes("Yes")
      ? "Lightning"
      : "USB-C";

    const simText = await extractText(
      'section.container-sheet-connectivity h3.k-h4:has-text("SIM card") + .k-dltable tr:has-text("Type") td'
    );
    let sim: Sim[] = [];
    if (simText) {
      let trimmedSimText = simText.slice(
        simText.indexOf("("),
        simText.indexOf(")") + 1
      );
      for (const simType of SIM_TYPES) {
        const i = trimmedSimText.indexOf(simType);
        if (i !== -1 && trimmedSimText) {
          sim.push(simType);
          trimmedSimText =
            trimmedSimText.slice(0, i) +
            trimmedSimText.slice(i + simType.length);
        }
      }
    }

    const batteryCapacityText = await extractText(
      'section.container-sheet-battery .k-dltable tr:has-text("Capacity") td'
    );
    const batteryCapacity = batteryCapacityText
      ? parseInt(batteryCapacityText)
      : null;
    const fastChargingText = await extractText(
      'section.container-sheet-battery .k-dltable tr:has-text("Fast charge") td'
    );
    const fastCharging = fastChargingText
      ? fastChargingText.includes("Yes")
      : null;

    const data: PhoneData = {
      name: name!,
      brand: brand!,
      aliases: aliases.join("|"),
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      height_mm: height,
      width_mm: width,
      thickness_mm: thickness,
      weight_g: weight,
      materials: materials.join("|"),
      ipRating,
      colors: colors.join("|"),
      size_in: displaySize,
      displayType,
      resolution: displayResolution,
      ppi: displayPpi,
      displayFeatures: displayFeatures.join("|"),
      skus,
      cpu,
      gpu,
      sdSlot,
      nfc,
      bluetooth,
      sim: sim.join("|"),
      usb,
      headphoneJack: false,
      batteryCapacity_mah: batteryCapacity,
      batteryFastCharging: fastCharging,
      cameras: [...rearCameras, ...frontCameras],
      rearCameraFeatures: rearCameraFeatures.join("|"),
      frontCameraFeatures: frontCameraFeatures.join("|"),
      raw,
    };

    return data;
  } catch (e) {
    throw e;
  } finally {
    browser?.close();
  }
});

export const getAutocompleteOptions = withDebugLog(
  async (name: string): Promise<AutocompleteOption[]> => {
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
);

const getTextExtractor =
  (page: Page) =>
  async (selector: string): Promise<string | null> => {
    try {
      return await page.$eval(selector, getTrimmedText);
    } catch (error) {
      return null;
    }
  };

const getTrimmedText = (e: HTMLElement) => e.textContent?.trim() || "";

const getCameraExtractor  = 
  (cameraTables: Element[], front: boolean): SingleCameraData[] => {
    return cameraTables
      .map((el) => {
        const cameraData: Record<string, string> = {};

        // some cameras may be presented in tables, some in dls
        if (el.tagName === "TABLE") {
          el.querySelectorAll("tr").forEach((row) => {
            const th = row.querySelector("th")?.textContent?.trim();
            const td = row.querySelector("td")?.textContent?.trim();
            if (th && td) {
              cameraData[th] = td;
            }
          });
        } else if (el.tagName === "DL") {
          let currentKey = "";
          el.querySelectorAll("dt, dd").forEach((item) => {
            if (item.tagName === "DT") {
              currentKey = item.textContent?.trim() || "";
            } else if (item.tagName === "DD" && currentKey) {
              const value = item.textContent?.trim() || "";
              cameraData[currentKey] = value;
            }
          });
        }

        const resolutionText = cameraData["Resolution"] || "";
        const resolutionMatch = resolutionText.match(/\b(\d+\.?\d*)\b/);
        const resolution_mp = resolutionMatch
          ? parseFloat(resolutionMatch[1])
          : null;

        const apertureText = cameraData["Aperture"] || "";
        const aperture_fstop = apertureText.replace("ƒ/", "").trim() || null;

        const sensorText = cameraData["Sensor"];
        const sensor = sensorText === "--" ? null : sensorText;

        return resolution_mp !== null
          ? { resolution_mp, aperture_fstop, sensor, front }
          : null;
      })
      .filter(Boolean) as SingleCameraData[];
  }


const getCameraFeatures = (features: Element[]): string[] => {
  return features.map((el) => el.textContent?.trim() || "").filter(Boolean);
};
