import "dotenv/config";
import {
  getAutocompleteOptions,
  scrapeBySlug,
} from "./modules/scraping/playwright";
import { pickMatchingSlug } from "./modules/ai/openai";
import { initRMQ, onMessage } from "./modules/mq/rmq";

(async () => {
  await initRMQ();

  onMessage("getAutocompleteOptionsRequest", (payload) =>
    getAutocompleteOptions(payload.searchString)
  );

  onMessage("getMatchingSlugRequest", (payload) =>
    pickMatchingSlug(payload.searchString, payload.options)
  );

  onMessage("getKimovilDataRequest", (payload) => scrapeBySlug(payload.slug));

  console.log("Listening for RMQ messages.");
})();
