import { chromium, Page } from "playwright";
import { debugLog } from "../../../utils/logging.js";
import {
  EXCLUDED_RESOURCE_TYPES,
  PLAYWRIGHT_TIMEOUT,
} from "../../../utils/consts.js";

export const createBrightDataBrowser = async (tag?: string) => {
  const useLocal = (process.env.LOCAL_PLAYWRIGHT ?? "").toLowerCase() === "true";
  if (useLocal) {
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

export const abortExtraResources = async (page: Page, abortAll = true) => {
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    const shouldAbort =
      resourceType !== "document" &&
      (abortAll || EXCLUDED_RESOURCE_TYPES.has(route.request().resourceType()));
    return shouldAbort ? route.abort() : route.continue();
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

export const slugifyName = (name: string): string | null => {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/[\(\)]/g, "")
    .replace(/\+/g, " plus")
    .replace(/\s+/g, "-");
};

export const parseReleaseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const cleanDateString = dateString.trim().toLowerCase();

  const match = cleanDateString.match(/([a-z]+)\s+(\d{4})/i);
  if (!match) return null;

  const monthName = match[1];
  const year = parseInt(match[2], 10);

  const monthIndex = monthMap[monthName];
  if (monthIndex === undefined) return null;

  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
};
const monthMap: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const scoreTitleToKey = (title: string): string => {
  const cleanTitle = title.trim().toLowerCase();
  if (cleanTitle.startsWith("ki cost")) return "ki";
  if (cleanTitle.startsWith("design")) return "design";
  if (cleanTitle.startsWith("performance")) return "performance";
  if (cleanTitle.startsWith("camera")) return "camera";
  if (cleanTitle.startsWith("connectivity")) return "connectivity";
  if (cleanTitle.startsWith("battery")) return "battery";
  return "";
};
