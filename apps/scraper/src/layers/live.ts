import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { SearchServiceKimovil } from "../services/search-kimovil";
import { BrowserServiceLive } from "../services/browser";
import { OpenAIServiceLive } from "../services/openai";
import { ScrapeServiceKimovil } from "../services/scrape-kimovil";
import { HtmlCacheServiceLive } from "../services/html-cache";
import { JobQueueServiceLive } from "../services/job-queue";
import { DeviceServiceLive } from "../services/device";
import { PhoneDataServiceLive } from "../services/phone-data";
import { SqlClientLive, SchemaLive } from "../sql";

const SearchServiceLayer = SearchServiceKimovil.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const SqlLayer = SchemaLive.pipe(Layer.provideMerge(SqlClientLive));

const DataLayer = Layer.mergeAll(
  HtmlCacheServiceLive,
  JobQueueServiceLive,
  PhoneDataServiceLive,
  DeviceServiceLive,
).pipe(Layer.provide(SqlLayer));

const ScrapeServiceLayer = ScrapeServiceKimovil.pipe(
  Layer.provide(BrowserServiceLive),
  Layer.provide(DataLayer),
  Layer.provide(OpenAIServiceLive),
);

export const LiveLayer = Layer.mergeAll(
  SearchServiceLayer,
  ScrapeServiceLayer,
  BrowserServiceLive,
  OpenAIServiceLive,
  DataLayer,
  SqlLayer,
);

export type LiveLayerType = typeof LiveLayer;

// Memoized runtime - use this instead of Effect.provide(LiveLayer) for shared state
export const LiveRuntime = ManagedRuntime.make(LiveLayer);

export type LiveRuntimeType = typeof LiveRuntime;
