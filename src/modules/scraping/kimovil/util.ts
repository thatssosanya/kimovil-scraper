import { chromium, Page } from "playwright";
import { debugLog } from "../../../utils/logging.js";
import {
  EXCLUDED_RESOURCE_TYPES,
  PLAYWRIGHT_TIMEOUT,
} from "../../../utils/consts.js";

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

export const abortExtraResources = async (page: Page) => {
  await page.route("**/*", (route) => {
    return EXCLUDED_RESOURCE_TYPES.has(route.request().resourceType())
      ? route.abort()
      : route.continue();
  });
};

export const getCpuCores = (input: string | null) => {
  if (!input) {
    return null;
  }

  const parts = input.split(/ ?[,+] ?/);

  const result = [];
  for (const part of parts) {
    const trimmedPart = part.replace(" ", "").toLowerCase();
    if (!trimmedPart) continue;

    const match = trimmedPart.match(
      /(?:(\d) ?x).*?(?:(\d{4,}) ?mhz|([\d\.,]{3,}) ?ghz)/i
    );

    if (!match || match.length < 2) {
      continue;
    }

    const count = parseInt(match[1] || "1", 10);
    const frequency = parseFloat(match[2] || match[3].replace(",", "."));
    const frequencyInMhz = trimmedPart.includes("ghz")
      ? frequency * 1000
      : frequency;

    result.push(`${count}x${frequencyInMhz}`);
  }

  return result;
};
