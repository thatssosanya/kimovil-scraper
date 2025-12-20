import { Layer } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { SearchServiceKimovil } from "../services/search-kimovil";
import { BrowserServiceLive } from "../services/browser";
import { StorageServiceLive } from "../services/storage";
import { OpenAIServiceLive } from "../services/openai";
import { ScrapeServiceKimovil } from "../services/scrape-kimovil";

// Search service with HTTP client
const SearchServiceLayer = SearchServiceKimovil.pipe(
  Layer.provide(FetchHttpClient.layer),
);

// Scrape service depends on Browser, Storage, and OpenAI services
const ScrapeServiceLayer = ScrapeServiceKimovil.pipe(
  Layer.provide(BrowserServiceLive),
  Layer.provide(StorageServiceLive),
  Layer.provide(OpenAIServiceLive),
);

// Compose all service layers - include all services at top level for direct access
export const LiveLayer = Layer.mergeAll(
  SearchServiceLayer,
  ScrapeServiceLayer,
  StorageServiceLive,
  BrowserServiceLive,
  OpenAIServiceLive,
);
