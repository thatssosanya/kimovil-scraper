import { Page } from "playwright";
import { AutocompleteOption, CameraData, PhoneData, SIM } from "../../types";
import { PLAYWRIGHT_TIMEOUT, SIM_TYPES } from "../../utils/consts";

const getTrimmedText = (e: HTMLElement) => e.textContent?.trim() || "";

export async function scrapeBySlug(
  page: Page,
  slug: string
): Promise<{ raw: string; parsed: PhoneData }> {
  const url = `https://www.kimovil.com/en/where-to-buy-${slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const raw = await page.content();

  const nameText = await page.$eval(
    "section.container-sheet-intro .title-group #sec-start",
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
    'section.container-sheet-intro .k-dltable tr:has-text("Aliases") td',
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
    const mmMatches = dimensionsText.match(/\b([\d.]+)\s*mm\b/g);
    // assuming height > width > thickness
    if (mmMatches && mmMatches.length === 3) {
      const values = mmMatches.map((m) => parseFloat(m)).sort((a, b) => b - a);
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
    'section.container-sheet-design .k-dltable tr:has-text("Colors") td .color-sep',
    (els) => els.map((e) => e.textContent?.trim() || "").filter(Boolean)
  );

  const cpu = await page.$eval(
    'section.container-sheet-hardware h3.k-h4:has-text("Processor") + .k-dltable tr:has-text("Model") td',
    getTrimmedText
  );

  const gpu = await page.$eval(
    'section.container-sheet-hardware .k-dltable tr:has-text("GPU") td',
    getTrimmedText
  );

  // TODO: switch to scraping all options from head
  const ramText = await page.$eval(
    'section.container-sheet-hardware .k-dltable tr:has-text("RAM") td',
    getTrimmedText
  );
  let ram: number | null = null;
  if (ramText) {
    const ramMatch = ramText.match(/(\d+)GB/i);
    if (ramMatch) ram = parseInt(ramMatch[1], 10);
  }

  // TODO: switch to scraping all options from head
  const storageText = await page.$eval(
    'section.container-sheet-hardware h3.k-h4:has-text("Storage") + .k-dltable tr:has-text("Capacity") td',
    getTrimmedText
  );
  let storageOptions: number[] = [];
  if (storageText) {
    storageOptions = storageText
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter(Boolean);
  }

  const sdSlotText = await page.$eval(
    'section.container-sheet-hardware .k-dltable tr:has-text("SD Slot") td',
    getTrimmedText
  );
  const sdSlot = sdSlotText ? sdSlotText === "Yes" : null;

  // TODO: parse cameras
  const rearCameras: CameraData[] = [];
  const frontCameras: CameraData[] = [];

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
  const usb = !usbText ? null : usbText.includes("Yes") ? "Lightning" : "USB-C";

  const simText = await page.$eval(
    'section.container-sheet-connectivity h3.k-h4:has-text("SIM card") + .k-dltable tr:has-text("Type") td',
    getTrimmedText
  );
  let trimmedText = simText;
  let sim: SIM[] = [];
  for (const simType of SIM_TYPES) {
    const i = trimmedText.indexOf(simType);
    if (i !== -1) {
      sim.push(simType);
      trimmedText =
        trimmedText.slice(0, i) + trimmedText.slice(i + simType.length);
    }
  }

  const batteryCapacityText = await page.$eval(
    'section.container-sheet-battery .k-dltable tr:has-text("Type") td',
    getTrimmedText
  );
  const batteryCapacity = parseInt(batteryCapacityText);
  const fastChargingText = await page.$eval(
    'section.container-sheet-battery .k-dltable dt:has-text("Fast charge") td',
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
      cpu,
      gpu,
      ramOptions_gb: [ram!],
      storageOptions_gb: storageOptions,
      sdSlot,
    },
    camera: {
      rear: rearCameras,
      front: frontCameras,
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
}

// expects page to be on kimovil.com
export async function getAutocompleteOptions(
  page: Page,
  name: string
): Promise<AutocompleteOption[]> {
  await page.click("#header-nav .panel-search-trigger");
  await page.waitForLoadState("networkidle", {
    timeout: PLAYWRIGHT_TIMEOUT,
  });
  // await page.waitForSelector("#js_panel-search #js_panel-search-input", {
  //   timeout: PLAYWRIGHT_TIMEOUT,
  // });

  await page.fill("#js_panel-search #js_panel-search-input", name);

  await page.waitForSelector(
    "#js_panel-search .search-results-list-smartphones a",
    { timeout: PLAYWRIGHT_TIMEOUT }
  );

  const results = await page.$$eval(
    "#js_panel-search .search-results-list-smartphones a",
    (els) => {
      return els.map((el) => {
        const href = el.getAttribute("href") || "";
        const dirtySlug = href.split("/").pop() || "";
        const slug = dirtySlug.replace("where-to-buy-", "");

        const image = el.querySelector<HTMLImageElement>(".image img");
        const name = image?.getAttribute("alt")?.trim() || "";

        return {
          name,
          slug,
        };
      });
    }
  );

  return results;
}
