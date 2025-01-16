import "dotenv/config";
import {
  getAutocompleteOptions,
  scrapeMissingSlugs,
  scrapeBySlug,
} from "./modules/scraping/playwright.js";
import { pickMatchingSlug } from "./modules/ai/openai.js";
import { initRMQ, onMessage } from "./modules/mq/rmq.js";

if (!process.env.COD_URL) {
  throw new Error("COD_URL is not available in env.");
}

(async () => {
  await Promise.resolve((r: () => void) => setTimeout(r, 5000));

  await initRMQ();

  onMessage("getAutocompleteOptionsRequest", (payload) =>
    getAutocompleteOptions(payload.searchString)
  );

  onMessage("getMatchingSlugRequest", (payload) =>
    pickMatchingSlug(payload.searchString, payload.options)
  );

  onMessage("getKimovilDataRequest", (payload) => scrapeBySlug(payload.slug));

  console.log("Listening for RMQ messages.");

  await scrapeMissingSlugs([]);
})();
