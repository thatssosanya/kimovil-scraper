import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "@effect/platform";

import "../sources/kimovil";

import { SearchServiceKimovil } from "../services/search-kimovil";
import { BrowserServiceLive } from "../services/browser";
import { OpenAIServiceLive } from "../services/openai";
import { ScrapeServiceKimovil } from "../services/scrape-kimovil";
import { HtmlCacheServiceLive } from "../services/html-cache";
import { JobQueueServiceLive } from "../services/job-queue";
import { DeviceServiceLive } from "../services/device";
import { PhoneDataServiceLive } from "../services/phone-data";
import { DeviceRegistryServiceLive } from "../services/device-registry";
import { EntityDataServiceLive } from "../services/entity-data";
import { ScrapeRecordServiceLive } from "../services/scrape-record";
import { SqlClientLive, SchemaLive } from "../sql";

const SearchServiceLayer = SearchServiceKimovil.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const SqlLayer = SchemaLive.pipe(Layer.provideMerge(SqlClientLive));

// Base services that don't depend on each other
const BaseDataLayer = Layer.mergeAll(
  HtmlCacheServiceLive,
  JobQueueServiceLive,
  DeviceServiceLive,
  DeviceRegistryServiceLive,
  EntityDataServiceLive,
  ScrapeRecordServiceLive,
).pipe(Layer.provide(SqlLayer));

// PhoneDataService depends on DeviceRegistry + EntityData, so layer it on top
const DataLayer = BaseDataLayer.pipe(
  Layer.provideMerge(PhoneDataServiceLive.pipe(Layer.provide(BaseDataLayer), Layer.provide(SqlLayer))),
);

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
