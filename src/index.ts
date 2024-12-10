import "dotenv/config";
import { chromium, Browser } from "playwright";
import {
  getAutocompleteOptions,
  scrapeBySlug,
} from "./modules/scraping/playwright";
import { pickMatchingSlug, adaptScrapedData } from "./modules/ai/openai";
import OpenAI from "openai";
import { PhoneData } from "./types";
import { debugLog } from "./utils/logging";
import { PLAYWRIGHT_TIMEOUT } from "./utils/consts";

export async function scrapeByUnqualifiedName(
  name: string
): Promise<PhoneData> {
  const wsEndpoint = process.env.BRD_WSENDPOINT;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (process.env.ENV !== "development" && !wsEndpoint) {
    throw new Error("BRD_WSENDPOINT is not available in env.");
  }
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not available in env.");
  }

  let browser: Browser | null = null;
  let openaiClient: OpenAI | null = null;

  try {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
    debugLog(`Initialized OpenAI client.`);

    if (process.env.ENV === "development") {
      browser = await chromium.launch({ headless: false });
      debugLog(`Initialized local headful Chromium.`);
    } else {
      browser = await chromium.connect(wsEndpoint!, {
        timeout: PLAYWRIGHT_TIMEOUT,
      });
      debugLog(`Initialized Bright Data browser.`);
    }

    const page = await browser.newPage();
    await page.goto("https://www.kimovil.com/en/", {
      waitUntil: "networkidle",
    });

    debugLog(`Navigated to kimovil.com.`);

    if (1 === 1) {
      throw new Error("all good");
    }

    const autocompleteOptions = await getAutocompleteOptions(page, name);

    debugLog(`Gathered autocomplete options:`, autocompleteOptions);

    if (1 === 1) {
      throw new Error("");
    }

    const slug = await pickMatchingSlug(
      name,
      autocompleteOptions,
      openaiClient
    );

    debugLog(`Picked slug:`, slug);

    const scrapedData = await scrapeBySlug(page, slug);

    debugLog(`Scraped data:`, scrapedData);

    const adaptedData = await adaptScrapedData(
      scrapedData.parsed,
      openaiClient
    );

    await page.close();

    return adaptedData;
  } catch (error) {
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

(async () => {
  const inputName = "iphone 14";
  try {
    debugLog("Scraping by unqualified name:", inputName);
    const result = await scrapeByUnqualifiedName(inputName);
    console.log("Final result:", result);
  } catch (error) {
    console.error("Scraping failed:", error);
  }
})();
