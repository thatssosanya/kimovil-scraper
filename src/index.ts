import "dotenv/config";
import { scrapeBySlug } from "./modules/scraping/kimovil/getSingleData.js";
import { pickMatchingSlug } from "./modules/ai/openai.js";
import { initRMQ, onMessage } from "./modules/mq/rmq.js";
import { scrapeMissingSlugs } from "./modules/scraping/kimovil/getMissingSlugs.js";
import { getAutocompleteOptions } from "./modules/scraping/kimovil/getAutocompleteOptions.js";
import { errorLog } from "./utils/logging.js";

if (!process.env.COD_URL) {
  throw new Error("COD_URL is not available in env.");
}

(async () => {
  await Promise.resolve((r: () => void) => setTimeout(r, 10000));

  try {
    await initRMQ();
  } catch (error) {
    errorLog("Failed to connect to RMQ.");
    process.exit(1);
  }

  if (process.env.WORKER_TYPE !== "slug-scraper") {
    onMessage("getAutocompleteOptionsRequest", (payload) =>
      getAutocompleteOptions(payload.searchString)
    );

    onMessage("getMatchingSlugRequest", (payload) =>
      pickMatchingSlug(payload.searchString, payload.options)
    );

    onMessage("getKimovilDataRequest", (payload) => scrapeBySlug(payload.slug));
    onMessage("getKimovilDataRequest.auto", (payload) =>
      scrapeBySlug(payload.slug)
    );
  }

  if (process.env.WORKER_TYPE !== "data-scraper") {
    onMessage("getMissingSlugsRequest.auto", (payload) =>
      scrapeMissingSlugs(payload)
    );
  }

  console.log("Listening for RMQ messages.");
})();
