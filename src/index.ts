import "dotenv/config";
import {
  getAutocompleteOptions,
  scrapeBySlug,
} from "./modules/scraping/playwright";
import { pickMatchingSlug, adaptScrapedData } from "./modules/ai/openai";
import { PhoneData } from "./types";
import { debugLog } from "./utils/logging";

export async function scrapeByUnqualifiedName(
  name: string
): Promise<PhoneData> {
  try {
    if (process.env.ENV === "development" && process.env.LOCAL_PLAYWRIGHT) {
      return (await scrapeBySlug("")).parsed;
    }
    const autocompleteOptions = await getAutocompleteOptions(name);
    debugLog(`Gathered autocomplete options:`, autocompleteOptions);

    const slug = await pickMatchingSlug(name, autocompleteOptions);
    debugLog(`Picked slug:`, slug);

    const scrapedData = await scrapeBySlug(slug);
    debugLog(`Scraped data:`, scrapedData);

    const adaptedData = await adaptScrapedData(scrapedData.parsed);

    return adaptedData;
  } catch (error) {
    throw error;
  }
}

(async () => {
  const inputName = "iphone 14";
  try {
    debugLog("Scraping by unqualified name:", inputName);
    const result = await scrapeByUnqualifiedName(inputName);
    console.log("Final result:", JSON.stringify(result));
  } catch (error) {
    console.error("Scraping failed:", error);
  }
})();
