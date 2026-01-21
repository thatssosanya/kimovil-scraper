import { Layer, ManagedRuntime } from "effect";

import "../sources/kimovil";
import "../sources/yandex_market";
import "../sources/price_ru";

import { SearchServiceKimovil } from "../services/search-kimovil";
import { BrowserServiceLive } from "../services/browser";
import { RobotServiceLive } from "../services/robot";
import { ScrapeServiceKimovil } from "../services/kimovil";
import { HtmlCacheServiceLive } from "../services/html-cache";
import { JobQueueServiceLive } from "../services/job-queue";
import { DeviceDiscoveryServiceLive } from "../services/device-discovery";

import { DeviceRegistryServiceLive } from "../services/device-registry";
import { CategoryServiceLive } from "../services/category";
import { EntityDataServiceLive } from "../services/entity-data";
import { ScrapeRecordServiceLive } from "../services/scrape-record";
import { PriceServiceLive } from "../services/price";
import { DeviceImageServiceLive } from "../services/device-image";
import { SchedulerServiceLive } from "../services/scheduler";
import { WidgetDataServiceLive } from "../services/widget-data";
import { WidgetServiceLive } from "../services/widget";
import { WidgetMappingServiceLive } from "../services/widget-mapping";
import { WordPressSyncServiceLive } from "../services/wordpress-sync";
import { SqlClientLive, SchemaLive } from "../sql";
import { PriceRuClientLive } from "../sources/price_ru";
import { CatalogueSqlClientLive } from "../sql/catalogue";
import { LinkResolverServiceLive } from "../services/link-resolver";
import { CatalogueLinkServiceLive } from "../services/catalogue-link";
import { YandexAffiliateServiceLive } from "../services/yandex-affiliate";
import { StorageServiceLive } from "../services/storage";
import { PriceUrlRefreshServiceLive } from "../services/price-url-refresh";

const SearchServiceLayer = SearchServiceKimovil.pipe(
  Layer.provide(BrowserServiceLive),
);

const SqlLayer = SchemaLive.pipe(Layer.provideMerge(SqlClientLive));

// ScrapeRecordService is a base service (no deps beyond SQL)
const ScrapeRecordLayer = ScrapeRecordServiceLive.pipe(Layer.provide(SqlLayer));

// JobQueueService depends on ScrapeRecordService
const JobQueueLayer = JobQueueServiceLive.pipe(
  Layer.provide(ScrapeRecordLayer),
  Layer.provide(SqlLayer),
);

// Base services that don't depend on each other (except JobQueue -> ScrapeRecord)
const BaseDataLayer = Layer.mergeAll(
  HtmlCacheServiceLive,
  DeviceDiscoveryServiceLive,
  DeviceRegistryServiceLive,
  CategoryServiceLive,
  EntityDataServiceLive,
  PriceServiceLive,
  DeviceImageServiceLive,
).pipe(
  Layer.provide(SqlLayer),
  Layer.provideMerge(JobQueueLayer),
  Layer.provideMerge(ScrapeRecordLayer),
);

// SchedulerService depends on JobQueueService, so layer it on top
const SchedulerLayer = SchedulerServiceLive.pipe(
  Layer.provide(BaseDataLayer),
  Layer.provide(SqlLayer),
);

// WidgetDataService depends only on SQL
const WidgetDataLayer = WidgetDataServiceLive.pipe(Layer.provide(SqlLayer));

// YandexAffiliateService depends only on SQL
const YandexAffiliateLayer = YandexAffiliateServiceLive.pipe(Layer.provide(SqlLayer));

// PriceUrlRefreshService depends on PriceService and PriceRuClient
const PriceUrlRefreshLayer = PriceUrlRefreshServiceLive.pipe(
  Layer.provide(BaseDataLayer), // provides PriceService
  Layer.provide(PriceRuClientLive),
);

// WidgetService depends on WidgetDataService, SqlClient, YandexAffiliateService, and PriceUrlRefreshService
const WidgetLayer = WidgetServiceLive.pipe(
  Layer.provide(WidgetDataLayer),
  Layer.provide(YandexAffiliateLayer),
  Layer.provide(PriceUrlRefreshLayer),
  Layer.provide(SqlLayer),
);

// WordPressSyncService depends only on SQL
const WordPressSyncLayer = WordPressSyncServiceLive.pipe(Layer.provide(SqlLayer));

// WidgetMappingService depends only on SQL
const WidgetMappingLayer = WidgetMappingServiceLive.pipe(Layer.provide(SqlLayer));

// LinkResolver has no deps
const LinkResolverLayer = LinkResolverServiceLive;

// CatalogueSqlClient is independent
const CatalogueSqlLayer = CatalogueSqlClientLive;

// CatalogueLinkService depends on CatalogueSqlClient, SqlClient, and LinkResolver
const CatalogueLinkLayer = CatalogueLinkServiceLive.pipe(
  Layer.provide(CatalogueSqlLayer),
  Layer.provide(LinkResolverLayer),
  Layer.provide(SqlLayer),
);

// DataLayer is just BaseDataLayer now (PhoneDataService removed)
const DataLayer = BaseDataLayer;

const ScrapeServiceLayer = ScrapeServiceKimovil.pipe(
  Layer.provide(BrowserServiceLive),
  Layer.provide(DataLayer),
  Layer.provide(RobotServiceLive),
);

export const LiveLayer = Layer.mergeAll(
  SearchServiceLayer,
  ScrapeServiceLayer,
  BrowserServiceLive,
  RobotServiceLive,
  DataLayer,
  SchedulerLayer,
  WidgetLayer,
  WidgetMappingLayer,
  WordPressSyncLayer,
  SqlLayer,
  PriceRuClientLive,
  CatalogueLinkLayer,
  LinkResolverLayer,
  YandexAffiliateLayer,
  StorageServiceLive,
);

export type LiveLayerType = typeof LiveLayer;

// Memoized runtime - use this instead of Effect.provide(LiveLayer) for shared state
export const LiveRuntime = ManagedRuntime.make(LiveLayer);

export type LiveRuntimeType = typeof LiveRuntime;
