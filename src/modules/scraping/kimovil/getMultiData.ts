import { Page } from "playwright";
import { Browser } from "playwright";
import { debugLog, withDebugLog } from "../../../utils/logging.js";
import { abortExtraResources, getCpuCores } from "./util.js";
import { withMock } from "../../mocks/util.js";
import { createBrightDataBrowser } from "./util.js";
import { PLAYWRIGHT_TIMEOUT } from "../../../utils/consts.js";
import { adaptScrapedData } from "../../ai/openai.js";
import { PhoneData, SingleCameraData } from "../../../types/index.js";
import { transpose, zip } from "../../../utils/index.js";

export const scrapeBySlugs = withMock(
  undefined,
  withDebugLog(async (requestedSlugs: string[]) => {
    let browser: Browser | null = null;
    try {
      const slugs = requestedSlugs.slice(0, 4);
      browser = await createBrightDataBrowser("scrapeBySlugs");
      const page = await browser.newPage();
      await abortExtraResources(page);
      const url =
        process.env.ENV === "development" && process.env.LOCAL_PLAYWRIGHT
          ? `http://127.0.0.1:8080/Apple%20iPhone%2016e%20vs%20Google%20Pixel%209%20vs%20OnePlus%2013%20vs%20Samsung%20Galaxy%20S23_%20Comparison`
          : `https://www.kimovil.com/en/compare/${slugs.join(",")}`;
      await page.goto(url, { waitUntil: "load", timeout: PLAYWRIGHT_TIMEOUT });
      debugLog(`Navigated to ${url}.`);

      const raw = await page.content();

      // columns are not guaranteed to be in the same order as the slugs in the url
      // additionally some slugs may not have a matching column
      const hrefValues = await page.$$eval(
        ".device-intro-images .more",
        (els) => els.map((e) => e.getAttribute("href")).filter(Boolean)
      );
      let hrefs = [...hrefValues];
      // sort slugs by length to match the longest slugs first
      const sortedSlugsByLength = [...slugs].sort(
        (a, b) => b.length - a.length
      );
      let includedSlugs = [];
      for (const slug of sortedSlugsByLength) {
        const index = hrefs.findIndex((href) => href?.includes(slug));
        if (index !== -1) {
          hrefs.splice(index, 1);
          includedSlugs.push(slug);
        }
      }
      // sorted in the order of columns on the page
      const sortedSlugs = [...includedSlugs].sort((a, b) => {
        const aIndex = hrefValues.findIndex((href) => href?.includes(a));
        const bIndex = hrefValues.findIndex((href) => href?.includes(b));
        return aIndex - bIndex;
      });

      const extractMultiText = getMultiTextExtractor(page);

      const fullNames = await extractMultiText(".device-intro-images .k-h3");
      const namesWithBrands = fullNames.map((fullName) => {
        const fullNameArr = fullName.split(" ");
        const name = fullNameArr.slice(1).join(" ");
        const brand = fullNameArr[0];
        return { name, brand };
      });
      const names = namesWithBrands.map(({ name }) => name);
      const brands = namesWithBrands.map(({ brand }) => brand);

      const aliasesTexts = await extractMultiText(
        'tr:has(th:has-text("Aliases")) td'
      );
      const aliases = aliasesTexts
        ? aliasesTexts.map((aliasesText) =>
            aliasesText
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          )
        : [];

      const releaseDateText = await extractMultiText(
        'tr:has(th:has-text("Release date")) td'
      );
      const releaseDate = releaseDateText
        ? releaseDateText.map((date) => date.split(",")[0].trim())
        : [];

      const dimensionsTexts = await page.$$eval(
        'tr:has(th:has-text("Size")) td .kiui-units[data-unit="mm"]',
        (els) =>
          els.map(
            (el) => parseFloat(el.getAttribute("data-value") || "0") || null
          )
      );
      const dimensions = dimensionsTexts.reduce((acc, curr, i) => {
        const j = Math.floor(i / 3);
        if (i % 3 === 0) {
          acc.push({ width: curr, height: null, thickness: null });
        } else if (i % 3 === 1) {
          acc[j].height = curr;
        } else if (i % 3 === 2) {
          acc[j].thickness = curr;
        }
        return acc;
      }, [] as { width: number | null; height: number | null; thickness: number | null }[]);

      const weightTexts = await extractMultiText(
        'tr:has(th:has-text("Weight")) td'
      );
      const weights = weightTexts.map((weight) => {
        const weightMatch = weight.match(/([\d.]+)\s*g/);
        return weightMatch ? parseFloat(weightMatch[1]) : null;
      });

      const materialsTexts = await extractMultiText(
        'tr:has(th:has-text("Materials")) td'
      );
      const materials = materialsTexts.map((material) => {
        return material
          .replace(/\s+/g, " ")
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
      });

      const ipRatings = await extractMultiText(
        'tr:has(th:has-text("Resistance")) td'
      );

      const colors = await page.$$eval(
        'tr:has(th:has-text("Colors")) td',
        (els) =>
          els.map((e) =>
            Array.from(e.querySelectorAll(".color-sep"))
              .map((c) => c.textContent?.trim() || "")
              .filter(Boolean)
          )
      );

      const aspectRatios = await extractMultiText(
        'tr:has(th:has-text("Aspect Ratio")) td'
      );

      const displaySizeTexts = await extractMultiText(
        'tr:has(th:has-text("Diagonal")) td'
      );
      const displaySizes = displaySizeTexts.map((size) => {
        const sizeMatch = size.match(/([\d.]+)"/);
        return sizeMatch ? parseFloat(sizeMatch[1]) : null;
      });

      const displayTypes = await extractMultiText(
        'table:has(h4:has-text("Screen")) tr:has(th:has-text("Type")) td'
      );

      const displayResolutionTexts = await extractMultiText(
        'tr:has(th:has-text("Resolution")) td'
      );
      const displayResolutions = displayResolutionTexts.map((resolution) => {
        const resolutionMatch = resolution.match(/(\d+\s*x\s*\d+)/i);
        return resolutionMatch ? resolutionMatch[1] : null;
      });

      const displayPpiTexts = await extractMultiText(
        'tr:has(th:has-text("Density")) td'
      );
      const displayPpis = displayPpiTexts.map((ppi) => {
        const ppiMatch = ppi.match(/(\d+)\s*Pixels per inch/i);
        return ppiMatch ? parseInt(ppiMatch[1]) : null;
      });

      const displayFeatures = await page.$$eval(
        '.device-comparison-table-wrap:has(h4:has-text("Screen")) + .device-comparison-table-wrap:has(h4:has-text("Others")) tr:has(th:has-text("Others")) td ul',
        (els) =>
          els.map((e) =>
            Array.from(e.querySelectorAll("li"))
              .map((li) => li.textContent?.trim() || "")
              .filter(Boolean)
          )
      );

      const cpuTexts = await extractMultiText(
        '.device-comparison-table-wrap:has(h4:has-text("Processor")) tr:has(th:has-text("Model")) td'
      );
      const cpus = cpuTexts.map((cpu) => {
        const [cpuManufacturer, ...cpuArr] = !cpu
          ? [null, null]
          : cpu.split(" ");
        return { cpuManufacturer, cpu: cpuArr?.join(" ") ?? null };
      });

      const cpuCoresTexts = await extractMultiText(
        '.device-comparison-table-wrap:has(h4:has-text("Processor")) tr:has(th:has-text("CPU")) td'
      );
      const cpuCores = cpuCoresTexts.map((cpuCores) => getCpuCores(cpuCores));

      const gpuTexts = await extractMultiText('tr:has(th:has-text("GPU")) td');

      const sdSlotTexts = await extractMultiText(
        'tr:has(th:has-text("SD Slot")) td'
      );
      const sdSlots = sdSlotTexts.map((sdSlot) =>
        sdSlot.includes("Yes") ? true : sdSlot.includes("No") ? false : null
      );

      const fingerprintPositionTexts = await extractMultiText(
        'tr:has(th:has-text("Fingerprint")) td'
      );
      const fingerprintPositions = fingerprintPositionTexts.map(
        (fingerprintPosition) =>
          fingerprintPosition.includes("screen")
            ? "screen"
            : fingerprintPosition.includes("side")
            ? "side"
            : fingerprintPosition.includes("back")
            ? "back"
            : null
      );

      const antutuTexts = await extractMultiText(
        'tr:has(.f-th:has-text("AnTuTu")) td:not(:first-child)'
      );
      const benchmarks = antutuTexts.map((antutu) => {
        const [antutuScore, antutuVersion] = antutu
          .split("\n")
          .map((part) => part.replace(/[•\.,]/, "").trim());
        return [
          {
            name: antutuVersion,
            score: parseFloat(antutuScore),
          },
        ];
      });

      const rearCameras = await page.$$eval(
        '.big-wrapper:has(h2:has-text("Camera")) ' +
          '.device-comparison-table-wrap:has-text("Camera type"):not(:has-text("SELF"))',
        getMultiCameras
      );
      const rearCameraFeatures: string[] = await page.$$eval(
        'section.container-sheet-camera table.k-dltable th:has-text("Features") + td li',
        getMultiCameraFeatures
      );
      const frontCameras = await page.$$eval(
        '.big-wrapper:has(h2:has-text("Camera")) ' +
          '.device-comparison-table-wrap:has-text("Camera type"):has-text("SELF")',
        getMultiCameras
      );

      const bluetoothTexts = await extractMultiText(
        'section.container-sheet-connectivity h3.k-h4:has-text("Bluetooth") + .k-dltable tr:has-text("Version") td'
      );
      const bluetooths = bluetoothTexts.map((bluetooth) => {
        const bluetoothMatch = bluetooth.match(/Bluetooth\s([\d.]+)/i);
        return bluetoothMatch ? `Bluetooth ${bluetoothMatch[1]}` : null;
      });

      const usbFeatures = await page.$$eval(
        '.device-comparison-table-wrap:has(h4:has-text("USB")) tr:has(th:has-text("USB")) ul',
        (els) =>
          els.map((e) =>
            Array.from(e.querySelectorAll("li"))
              .map((li) => li.textContent?.trim() || "")
              .filter(Boolean)
          )
      );
      const usbs = usbFeatures.map((usb) => {
        return usb.includes("Proprietary")
          ? "Lightning"
          : usb.includes("USB Type C")
          ? "USB-C"
          : "USB-A";
      });

      const dualSimTexts = await extractMultiText(
        '.device-comparison-table-wrap:has(h4:has-text("SIM card")) tr:has(th:has-text("Dual SIM")) td'
      );
      const simTypes = await page.$$eval(
        '.device-comparison-table-wrap:has(h4:has-text("SIM card")) tr:has(th:has-text("Type")) ul',
        (els) =>
          els.map((e) =>
            Array.from(e.querySelectorAll("li"))
              .map((li) => li.textContent?.trim() || "")
              .filter(Boolean)
          )
      );

      const batteryCapacityText = await extractMultiText(
        'tr:has(.f-th:has-text("Battery")) td:not(:first-child)'
      );
      const batteryCapacities = batteryCapacityText.map((batteryCapacity) => {
        return parseInt(batteryCapacity);
      });

      const fastChargingTexts = await extractMultiText(
        '.device-comparison-table-wrap:has(h4:has-text("USB")) tr:has(th:has-text("USB")) ul'
      );
      const fastChargings = fastChargingTexts.map((fastCharging) => {
        return fastCharging.includes("Yes")
          ? true
          : fastCharging.includes("No")
          ? false
          : null;
      });
      const batteryWattages = fastChargingTexts.map((fastCharging) => {
        const batteryWattageMatch = fastCharging
          ?.toLowerCase()
          ?.match(/(\d*(?:\.\d+)?)w/i);
        return batteryWattageMatch ? parseFloat(batteryWattageMatch[1]) : null;
      });

      const osTexts = await page.$$eval(
        'tr:has(.f-th:has-text("Operating System")) ul li:first-child',
        (els) => els.map((e) => e.childNodes[0].textContent?.trim() || "")
      );
      const software = osTexts.map(getSoftware);

      const otherLists = await page.$$eval(
        '.device-comparison-table-wrap:has(h4:has-text("Others")) tr:has(th:has-text("Others")) ul',
        (els) =>
          els.map((e) =>
            Array.from(e.querySelectorAll("li"))
              .map((li) => li.textContent?.trim() || "")
              .filter(Boolean)
          )
      );
      let others = otherLists.map((otherList) => [...otherList]);
      let nfcs = [];
      let jacks = [];
      for (let i = 0; i < others.length; i++) {
        const other = others[i];
        const nfcIndex = other.findIndex((o) => o.includes("NFC"));
        const jackIndex = other.findIndex((o) => o.includes("Jack"));
        nfcs.push(nfcIndex !== -1);
        jacks.push(jackIndex !== -1);
        if (nfcIndex !== -1) {
          others[i] = others[i].splice(nfcIndex, 1);
        }
        if (jackIndex !== -1) {
          others[i] = others[i].splice(jackIndex, 1);
        }
      }

      // TODO: skus (in getMissingSlugs?)
      // scores
      // other schema
      // dual sim schema

      const datas = [];
      for (let i = 0; i < sortedSlugs.length; i++) {
        const slug = sortedSlugs[i];
        const data: PhoneData = {
          slug,
          name: names[i],
          brand: brands[i],
          aliases: aliases[i]?.join("|") ?? null,
          releaseDate: releaseDate[i] ? new Date(releaseDate[i]) : null,
          height_mm: dimensions[i].height,
          width_mm: dimensions[i].width,
          thickness_mm: dimensions[i].thickness,
          weight_g: weights[i],
          materials: materials[i]?.join("|") ?? null,
          ipRating: ipRatings[i],
          colors: colors[i]?.join("|") ?? null,
          aspectRatio: aspectRatios[i],
          size_in: displaySizes[i],
          displayType: displayTypes[i],
          resolution: displayResolutions[i],
          ppi: displayPpis[i],
          displayFeatures: displayFeatures[i]?.join("|") ?? null,
          skus: [],
          cpu: cpus[i].cpu,
          cpuManufacturer: cpus[i].cpuManufacturer,
          cpuCores: cpuCores[i]?.join("|") ?? null,
          gpu: gpuTexts[i],
          sdSlot: sdSlots[i],
          fingerprintPosition: fingerprintPositions[i],
          benchmarks: benchmarks[i],
          nfc: nfcs[i],
          bluetooth: bluetooths[i],
          sim: simTypes[i]?.join("|") ?? null,
          simCount: simTypes[i].length,
          usb: usbs[i] ?? null,
          headphoneJack: jacks[i],
          batteryCapacity_mah: batteryCapacities[i],
          batteryFastCharging: fastChargings[i],
          batteryWattage: batteryWattages[i],
          cameras: [...rearCameras[i], ...frontCameras[i]],
          cameraFeatures: rearCameraFeatures?.join("|") ?? null,
          os: software[i]?.os ?? null,
          osSkin: software[i]?.osSkin ?? null,
          raw: raw.slice(
            // FIXME
            raw.indexOf(">", raw.indexOf("<main")) + 1,
            raw.indexOf("</main")
          ),
        };
        // TODO
        // debugLog(`Trying to adapt data with OpenAI gpt-4o-mini.`);
        // const adaptedData = await adaptScrapedData(data);
        const adaptedData = data;
        if (adaptedData) {
          adaptedData.raw = data.raw;
          datas.push(adaptedData);
        } else {
          datas.push(data);
        }
      }

      return datas;
    } catch (e) {
      throw e;
    } finally {
      browser?.close();
    }
  }, "scrapeBySlug")
);

const getTrimmedMultiText = (elements: HTMLElement[]): string[] => {
  return elements.map((e: HTMLElement) => e.textContent?.trim() || "");
};
const getMultiTextExtractor =
  (page: Page) =>
  async (selector: string): Promise<string[]> => {
    try {
      return await page.$$eval(selector, getTrimmedMultiText);
    } catch (error) {
      return [];
    }
  };

const getMultiCameras = (cameraTables: Element[]): SingleCameraData[][] => {
  const camerasByIndex = cameraTables.map((cameraTable) => {
    // ith table contains data for the ith camera of each device
    const cameraDatas: (Record<string, string> | null)[] = [];

    // x and .f-x are equivalent. only one type is present in any given table
    const rows = cameraTable.querySelectorAll("tr:not(.k-sep), .f-tr");
    rowLoop: for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const headerText = row
        .querySelector("th, .f-th")
        ?.textContent?.replace(/\d+/g, "")
        .trim();
      if (!headerText) {
        continue;
      }
      const tds = row.querySelectorAll("td, .f-td");
      let values = Array.from(tds).map((td) => td.textContent?.trim() || "");
      if (headerText.includes("SELF")) {
        values = values.map(() => "Selfie");
      }
      const key = headerText.replace("SELF", "").trim();
      for (let j = 0; j < values.length; j++) {
        const value = values[j];
        if (cameraDatas.length <= j) {
          if (key === "Camera type" && value === "--") {
            cameraDatas.push(null);
            break rowLoop;
          } else {
            cameraDatas.push({});
          }
        }
        const cameraData = cameraDatas[j];
        if (cameraData) {
          cameraData[key] = value;
        }
      }
    }

    const cameras = cameraDatas.map((cameraData) => {
      if (!cameraData) {
        return null;
      }
      const resolutionText = cameraData["Resolution"] || "";
      const resolutionMatch = resolutionText.match(/\b(\d+\.?\d*)\b/);
      const resolution_mp = resolutionMatch
        ? parseFloat(resolutionMatch[1])
        : null;

      const apertureText = cameraData["Aperture"] || "";
      let aperture_fstop = apertureText.replace("ƒ/", "").trim() || null;
      if (aperture_fstop === "Unknown") {
        aperture_fstop = null;
      }

      const sensorText = cameraData["Sensor"];
      const sensor = sensorText === "--" ? null : sensorText;

      return resolution_mp !== null
        ? ({
            resolution_mp,
            aperture_fstop,
            sensor,
            type: cameraData["Camera type"] || "",
            features: "",
          } as SingleCameraData)
        : null;
    });

    return cameras;
  });

  const camerasByPhone = transpose(camerasByIndex);

  return camerasByPhone.map(
    (cameras) => cameras.filter(Boolean) as SingleCameraData[]
  );
};

const getMultiCameraFeatures = (features: Element[]): string[] => {
  return features.map((el) => el.textContent?.trim() || "").filter(Boolean);
};

const getSoftware = (input: string | null) => {
  if (!input) {
    return null;
  }

  // string with parens means `skin (OS)`
  const parenthesesMatch = input.match(/(.+)\s*\((.+)\)/);
  if (parenthesesMatch) {
    const osSkin = parenthesesMatch[1].trim();
    const os = parenthesesMatch[2].trim();
    return { os, osSkin };
  }

  const osMatch = input.match(/(?:iOS|Android)\s+\d+[\.,]?\d*/);
  if (osMatch) {
    return { os: osMatch[0], osSkin: null };
  }

  return { os: input, osSkin: null };
};
