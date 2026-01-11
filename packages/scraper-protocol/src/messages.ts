import { Schema } from "@effect/schema";
import {
  CpuCoreCluster,
  Sku,
  Benchmark,
  UsbTypeSchema,
  FingerprintPositionSchema,
} from "@repo/scraper-domain";

export class Request extends Schema.Class<Request>("Request")({
  id: Schema.String,
  method: Schema.String,
  params: Schema.Unknown,
}) {}

export class Response extends Schema.Class<Response>("Response")({
  id: Schema.String,
  result: Schema.Unknown,
}) {}

export class HealthCheckParams extends Schema.Class<HealthCheckParams>(
  "HealthCheckParams",
)({}) {}

export class HealthCheckResult extends Schema.Class<HealthCheckResult>(
  "HealthCheckResult",
)({
  ok: Schema.Boolean,
  version: Schema.String,
}) {}

export class SearchParams extends Schema.Class<SearchParams>("SearchParams")({
  query: Schema.String,
}) {}

export class SearchOption extends Schema.Class<SearchOption>("SearchOption")({
  name: Schema.String,
  slug: Schema.String,
  url: Schema.String,
}) {}

export class SearchResult extends Schema.Class<SearchResult>("SearchResult")({
  options: Schema.Array(SearchOption),
}) {}

export class ErrorResponse extends Schema.Class<ErrorResponse>("ErrorResponse")(
  {
    id: Schema.String,
    error: Schema.Struct({
      code: Schema.String,
      message: Schema.String,
      details: Schema.optional(Schema.Unknown),
    }),
  },
) {}

export class StreamEvent extends Schema.Class<StreamEvent>("StreamEvent")({
  id: Schema.String,
  event: Schema.Union(
    Schema.Struct({
      type: Schema.Literal("log"),
      level: Schema.Literal("info", "warn", "error"),
      message: Schema.String,
    }),
    Schema.Struct({
      type: Schema.Literal("progress"),
      stage: Schema.String,
      percent: Schema.optional(Schema.Number),
      durationMs: Schema.optional(Schema.Number),
    }),
    Schema.Struct({
      type: Schema.Literal("retry"),
      attempt: Schema.Number,
      maxAttempts: Schema.Number,
      delay: Schema.Number,
      reason: Schema.String,
    }),
    Schema.Struct({
      type: Schema.Literal("bulk.progress"),
      jobId: Schema.String,
      stats: Schema.Struct({
        total: Schema.Number,
        pending: Schema.Number,
        running: Schema.Number,
        done: Schema.Number,
        error: Schema.Number,
        timeout: Schema.optional(
          Schema.Struct({
            count: Schema.Number,
            nextRetryAt: Schema.NullOr(Schema.Number),
            nextRetryExternalId: Schema.NullOr(Schema.String),
          }),
        ),
      }),
      lastCompleted: Schema.optional(
        Schema.Struct({
          slug: Schema.String,
          success: Schema.Boolean,
          error: Schema.NullOr(Schema.String),
        }),
      ),
    }),
    Schema.Struct({
      type: Schema.Literal("bulk.done"),
      jobId: Schema.String,
      status: Schema.Literal("done", "error"),
      stats: Schema.Struct({
        total: Schema.Number,
        pending: Schema.Number,
        running: Schema.Number,
        done: Schema.Number,
        error: Schema.Number,
        timeout: Schema.optional(
          Schema.Struct({
            count: Schema.Number,
            nextRetryAt: Schema.NullOr(Schema.Number),
            nextRetryExternalId: Schema.NullOr(Schema.String),
          }),
        ),
      }),
    }),
    Schema.Struct({
      type: Schema.Literal("bulk.jobUpdate"),
      job: Schema.Struct({
        id: Schema.String,
        jobType: Schema.optional(Schema.Literal("scrape", "process_raw", "process_ai", "clear_html", "clear_raw", "clear_processed")),
        status: Schema.Literal("pending", "running", "pausing", "paused", "done", "error"),
        workerCount: Schema.optional(Schema.Number),
        batchStatus: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      stats: Schema.optional(
        Schema.Struct({
          total: Schema.Number,
          pending: Schema.Number,
          running: Schema.Number,
          done: Schema.Number,
          error: Schema.Number,
          timeout: Schema.optional(
            Schema.Struct({
              count: Schema.Number,
              nextRetryAt: Schema.NullOr(Schema.Number),
              nextRetryExternalId: Schema.NullOr(Schema.String),
            }),
          ),
        }),
      ),
    }),
  ),
}) {}

// Phone data scraping schemas

export class SingleCameraData extends Schema.Class<SingleCameraData>(
  "SingleCameraData",
)({
  resolution_mp: Schema.Number,
  aperture_fstop: Schema.NullOr(Schema.String),
  sensor: Schema.NullOr(Schema.String),
  type: Schema.String,
  features: Schema.Array(Schema.String),
}) {}

export class PhoneData extends Schema.Class<PhoneData>("PhoneData")({
  // essentials
  slug: Schema.String,
  name: Schema.String,
  brand: Schema.String,
  aliases: Schema.Array(Schema.String),
  releaseDate: Schema.NullOr(Schema.String), // ISO date string
  images: Schema.NullOr(Schema.Array(Schema.String)),

  // design
  height_mm: Schema.NullOr(Schema.Number),
  width_mm: Schema.NullOr(Schema.Number),
  thickness_mm: Schema.NullOr(Schema.Number),
  weight_g: Schema.NullOr(Schema.Number),
  materials: Schema.Array(Schema.String),
  ipRating: Schema.NullOr(Schema.String),
  colors: Schema.Array(Schema.String),

  // display
  size_in: Schema.NullOr(Schema.Number),
  displayType: Schema.NullOr(Schema.String),
  resolution: Schema.NullOr(Schema.String),
  aspectRatio: Schema.NullOr(Schema.String),
  ppi: Schema.NullOr(Schema.Number),
  displayFeatures: Schema.Array(Schema.String),

  // hardware
  cpu: Schema.NullOr(Schema.String),
  cpuManufacturer: Schema.NullOr(Schema.String),
  cpuCores: Schema.NullOr(Schema.Array(Schema.String)),
  cpuCoreClusters: Schema.NullOr(Schema.Array(CpuCoreCluster)),
  gpu: Schema.NullOr(Schema.String),
  sdSlot: Schema.NullOr(Schema.Boolean),
  skus: Schema.Array(Sku),
  fingerprintPosition: Schema.NullOr(FingerprintPositionSchema),
  benchmarks: Schema.Array(Benchmark),

  // connectivity
  nfc: Schema.NullOr(Schema.Boolean),
  bluetooth: Schema.NullOr(Schema.String),
  sim: Schema.Array(Schema.String),
  simCount: Schema.Number,
  usb: Schema.NullOr(UsbTypeSchema),
  headphoneJack: Schema.NullOr(Schema.Boolean),

  // battery
  batteryCapacity_mah: Schema.NullOr(Schema.Number),
  batteryFastCharging: Schema.NullOr(Schema.Boolean),
  batteryWattage: Schema.NullOr(Schema.Number),

  // cameras
  cameras: Schema.Array(SingleCameraData),
  cameraFeatures: Schema.Array(Schema.String),

  // software
  os: Schema.NullOr(Schema.String),
  osSkin: Schema.NullOr(Schema.String),

  // extras
  scores: Schema.NullOr(Schema.String), // pipe-delimited key=value (kept as string)
  others: Schema.NullOr(Schema.Array(Schema.String)),
}) {}

export class ScrapeParams extends Schema.Class<ScrapeParams>("ScrapeParams")({
  slug: Schema.String,
}) {}

export class ScrapeResult extends Schema.Class<ScrapeResult>("ScrapeResult")({
  data: PhoneData,
}) {}

// Job type schemas
export const JobTypeSchema = Schema.Literal("scrape", "process_raw", "process_ai", "clear_html", "clear_raw", "clear_processed", "link_priceru");
export type JobType = typeof JobTypeSchema.Type;

export const AiModeSchema = Schema.Literal("realtime", "batch");
export type AiMode = typeof AiModeSchema.Type;

// Bulk/Job schemas

export class BulkStartParams extends Schema.Class<BulkStartParams>(
  "BulkStartParams",
)({
  jobType: Schema.optional(JobTypeSchema), // defaults to 'scrape' for backwards compat
  mode: Schema.optional(Schema.Literal("fast")), // for scrape jobs
  aiMode: Schema.optional(AiModeSchema), // for process_ai jobs
  filter: Schema.optional(Schema.String), // 'all', 'unscraped', 'needs_extraction', 'needs_ai'
  slugs: Schema.optional(Schema.Array(Schema.String)),
  source: Schema.optional(Schema.String), // 'kimovil', 'price_ru', etc.
  dataKind: Schema.optional(Schema.String), // 'specs', 'prices', 'price_links', etc.
}) {}

export class BulkSubscribeParams extends Schema.Class<BulkSubscribeParams>(
  "BulkSubscribeParams",
)({
  jobId: Schema.String,
}) {}

export class BulkTimeoutStats extends Schema.Class<BulkTimeoutStats>(
  "BulkTimeoutStats",
)({
  count: Schema.Number,
  nextRetryAt: Schema.NullOr(Schema.Number),
  nextRetryExternalId: Schema.NullOr(Schema.String),
}) {}

export class BulkJobStats extends Schema.Class<BulkJobStats>("BulkJobStats")({
  total: Schema.Number,
  pending: Schema.Number,
  running: Schema.Number,
  done: Schema.Number,
  error: Schema.Number,
  timeout: Schema.optional(BulkTimeoutStats),
}) {}

export class BulkJobInfo extends Schema.Class<BulkJobInfo>("BulkJobInfo")({
  id: Schema.String,
  jobType: Schema.optional(JobTypeSchema), // defaults to 'scrape' for backwards compat
  mode: Schema.NullOr(Schema.Literal("fast", "complex")),
  aiMode: Schema.optional(Schema.NullOr(AiModeSchema)),
  status: Schema.Literal("pending", "running", "pausing", "paused", "done", "error"),
  filter: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
  startedAt: Schema.NullOr(Schema.Number),
  completedAt: Schema.NullOr(Schema.Number),
  errorMessage: Schema.NullOr(Schema.String),
  totalCount: Schema.NullOr(Schema.Number),
  queuedCount: Schema.NullOr(Schema.Number),
  workerCount: Schema.optional(Schema.Number),
  batchRequestId: Schema.optional(Schema.NullOr(Schema.String)),
  batchStatus: Schema.optional(Schema.NullOr(Schema.String)),
}) {}

export class BulkResult extends Schema.Class<BulkResult>("BulkResult")({
  job: BulkJobInfo,
  stats: BulkJobStats,
}) {}

export class BulkJobWithStats extends Schema.Class<BulkJobWithStats>(
  "BulkJobWithStats",
)({
  job: BulkJobInfo,
  stats: BulkJobStats,
}) {}

export class BulkListResult extends Schema.Class<BulkListResult>(
  "BulkListResult",
)({
  jobs: Schema.Array(BulkJobWithStats),
}) {}

export class BulkPauseParams extends Schema.Class<BulkPauseParams>(
  "BulkPauseParams",
)({
  jobId: Schema.String,
}) {}

export class BulkResumeParams extends Schema.Class<BulkResumeParams>(
  "BulkResumeParams",
)({
  jobId: Schema.String,
}) {}

export class BulkSetWorkersParams extends Schema.Class<BulkSetWorkersParams>(
  "BulkSetWorkersParams",
)({
  jobId: Schema.String,
  workerCount: Schema.Number,
}) {}

export class BulkControlResult extends Schema.Class<BulkControlResult>(
  "BulkControlResult",
)({
  success: Schema.Boolean,
  job: Schema.optional(BulkJobInfo),
}) {}

// Yandex price scraping schemas

export class YandexScrapeParams extends Schema.Class<YandexScrapeParams>(
  "YandexScrapeParams",
)({
  url: Schema.String,
  deviceId: Schema.optional(Schema.String),
}) {}

export class YandexScrapeResult extends Schema.Class<YandexScrapeResult>(
  "YandexScrapeResult",
)({
  success: Schema.Boolean,
  priceCount: Schema.optional(Schema.Number),
  minPrice: Schema.optional(Schema.Number),
  maxPrice: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
}) {}

export class YandexLinkParams extends Schema.Class<YandexLinkParams>(
  "YandexLinkParams",
)({
  deviceId: Schema.String,
  url: Schema.String,
}) {}

export class YandexLinkResult extends Schema.Class<YandexLinkResult>(
  "YandexLinkResult",
)({
  success: Schema.Boolean,
  externalId: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
}) {}

export class YandexPreviewParams extends Schema.Class<YandexPreviewParams>(
  "YandexPreviewParams",
)({
  url: Schema.String,
}) {}

export class YandexPreviewResult extends Schema.Class<YandexPreviewResult>(
  "YandexPreviewResult",
)({
  success: Schema.Boolean,
  error: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  brand: Schema.optional(Schema.String),
  suggestedSlug: Schema.optional(Schema.String),
  imageUrls: Schema.optional(Schema.Array(Schema.String)),
  specsCount: Schema.optional(Schema.Number),
  priceCount: Schema.optional(Schema.Number),
  minPrice: Schema.optional(Schema.Number),
  maxPrice: Schema.optional(Schema.Number),
  externalId: Schema.optional(Schema.String),
}) {}

export class YandexCreateDeviceParams extends Schema.Class<YandexCreateDeviceParams>(
  "YandexCreateDeviceParams",
)({
  url: Schema.String,
  name: Schema.String,
  brand: Schema.String,
  slug: Schema.String,
  categoryId: Schema.optional(Schema.Number),
  selectedImageUrls: Schema.Array(Schema.String),
  widgetMappingId: Schema.optional(Schema.Number),
}) {}

export class YandexCreateDeviceResult extends Schema.Class<YandexCreateDeviceResult>(
  "YandexCreateDeviceResult",
)({
  success: Schema.Boolean,
  error: Schema.optional(Schema.String),
  deviceId: Schema.optional(Schema.String),
  deviceSlug: Schema.optional(Schema.String),
  imagesUploaded: Schema.optional(Schema.Number),
  pricesSaved: Schema.optional(Schema.Number),
}) {}
