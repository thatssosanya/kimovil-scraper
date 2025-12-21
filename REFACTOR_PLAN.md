# Storage Architecture Refactoring Plan

## Overview

This document outlines the plan to refactor the 2075-line `storage.ts` monolith into a modular, testable service architecture that supports multi-source scraping.

**Epic:** `cod-bb8` - Refactor storage.ts into modular service architecture  
**Architecture Thread:** https://ampcode.com/threads/T-019b3cfd-8ef0-770e-8cb1-2293860be2fb

---

## Current State

### Problem

`apps/scraper/src/services/storage.ts` is a "god object" containing:

- HTML caching (raw_html table)
- Device CRUD (kimovil_devices table)
- Prefix crawling state (kimovil_prefix_state table)
- Job queue management (jobs, job_queue tables)
- Phone data storage (phone_data_raw, phone_data tables)
- HTML verification (scrape_verification table)

This creates:

- Hard to test individual concerns
- Impossible to mock specific functionality
- No clear ownership boundaries
- Blocks multi-source scraping architecture

### Current File Sizes

| File              | Lines | Bytes |
| ----------------- | ----: | ----: |
| storage.ts        | 2,075 |  69KB |
| scrape-kimovil.ts | 1,112 |  36KB |
| App.tsx           |   785 |  34KB |
| bulk-job.ts       |   603 |  18KB |

---

## Target Architecture

```
┌─────────────────────────────────────┐
│         Frontend (ws-web)           │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│         API Layer                    │
│    (WebSocket + REST Routes)         │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│      Orchestration Layer             │
│  BulkJobManager    SlugCrawler       │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│       Scraper Implementations        │
│  KimovilScraper   GSMArenaScraper    │
│  (future sources...)                 │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│       Data Processing                │
│  PhoneDataService   AI Normalizer    │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│       Data Layer (Effect Services)   │
│  HtmlCacheService  JobQueueService   │
│  DeviceService     PhoneDataService  │
└──────────────┬──────────────────────┘
               │
               ▼
          [ SQLite ]
```

---

## New Service Structure

After refactoring, the services directory will look like:

```
apps/scraper/src/services/
├── browser.ts              # Unchanged - Playwright lifecycle
├── bulk-job.ts             # Unchanged - Job orchestration
├── openai.ts               # Unchanged - AI normalization
├── search-kimovil.ts       # Unchanged - Autocomplete API
├── slug-crawler.ts         # Unchanged - Prefix crawling
│
├── html-cache.ts           # NEW - HTML storage + verification
├── job-queue.ts            # NEW - Jobs + queue CRUD
├── device.ts               # NEW - Devices + prefixes
├── phone-data.ts           # NEW - Raw + AI phone data
│
├── kimovil.ts              # REFACTORED - Scraper orchestration
├── kimovil-extractors.ts   # NEW - Data extraction functions
└── kimovil-validators.ts   # NEW - HTML validation functions
```

---

## Phase 1: Extract Data Layer Services

**Issues:** `cod-8np`, `cod-co8`, `cod-duf` (can run in parallel)

### 1.1 HtmlCacheService (`cod-8np`)

**File:** `services/html-cache.ts`

**Methods to move from storage.ts:**

- `saveRawHtml(slug, html, source?)` - Add source parameter
- `getRawHtml(slug, source?)`
- `getRawHtmlIfFresh(slug, maxAgeSeconds, source?)`
- `getRawHtmlWithAge(slug, source?)`
- `recordVerification(slug, isCorrupted, reason)`
- `verifyHtml(slug)`
- `getVerificationStatus(slug)`
- `getCorruptedSlugs()`
- `getValidSlugs()`
- `getScrapedSlugs()`

**Schema changes:**

```sql
-- Add source column to raw_html
ALTER TABLE raw_html ADD COLUMN source TEXT NOT NULL DEFAULT 'kimovil';

-- Update primary key to (slug, source)
-- Requires migration: create new table, copy data, drop old
```

**Interface:**

```typescript
export interface HtmlCacheService {
  readonly saveRawHtml: (
    slug: string,
    html: string,
    source?: string,
  ) => Effect.Effect<void, HtmlCacheError>;

  readonly getRawHtml: (
    slug: string,
    source?: string,
  ) => Effect.Effect<string | null, HtmlCacheError>;

  readonly getRawHtmlWithAge: (
    slug: string,
    source?: string,
  ) => Effect.Effect<RawHtmlCacheHit | null, HtmlCacheError>;

  // ... verification methods
}

export const HtmlCacheService =
  Context.GenericTag<HtmlCacheService>("HtmlCacheService");
```

### 1.2 JobQueueService (`cod-co8`)

**File:** `services/job-queue.ts`

**Methods to move:**

- `createJob(input)`
- `getJob(id)`
- `getAllJobs()`
- `updateJobStatus(id, status, error?)`
- `getJobStats(id)`
- `enqueueJobSlugs(jobId, jobType, mode, slugs, maxAttempts?)`
- `claimNextJobQueueItem(jobId, jobType?)`
- `completeQueueItem(id, error?)`
- `rescheduleQueueItem(id, nextAttemptAt, error, errorCode?)`
- `resetStuckQueueItems(jobId)`
- `resetErrorQueueItems(jobId)`
- `getErrorQueueItems(jobId, limit?)`
- `unclaimRunningItems(jobId)`
- `getTimeoutStats(jobId)`
- `updateJobBatchStatus(jobId, batchRequestId, batchStatus)`
- `getRunningBatchJobs()`

**Deprecated aliases to include:**

- `createBulkJob` → `createJob`
- `getBulkJob` → `getJob`
- `getAllBulkJobs` → `getAllJobs`
- `updateBulkJobStatus` → `updateJobStatus`
- `getBulkJobStats` → `getJobStats`
- `enqueueBulkSlugs` → `enqueueJobSlugs`
- `claimNextQueueItem` → `claimNextJobQueueItem`

### 1.3 DeviceService (`cod-duf`)

**File:** `services/device.ts`

**Methods to move:**

- `upsertDevice(device)`
- `getDevice(slug)`
- `getDeviceCount()`
- `getAllDevices()`
- `enqueuePrefix(prefix, depth)`
- `getNextPendingPrefix()`
- `markPrefixDone(prefix, resultCount)`
- `getPendingPrefixCount()`
- `seedInitialPrefixes()`
- `resetAllPrefixes()`

---

## Phase 2: Create PhoneDataService

**Issue:** `cod-rll` (blocked by Phase 1)

**File:** `services/phone-data.ts`

**Methods to move:**

- `savePhoneDataRaw(slug, data)`
- `getPhoneDataRaw(slug)`
- `hasPhoneDataRaw(slug)`
- `getPhoneDataRawCount()`
- `savePhoneData(slug, data)`
- `getPhoneData(slug)`
- `hasPhoneData(slug)`
- `getPhoneDataCount()`
- `getPhoneDataRawBulk(slugs)`
- `getSlugsNeedingExtraction()`
- `getSlugsNeedingAi()`
- `getRawDataSlugs()`
- `getAiDataSlugs()`

**Interface:**

```typescript
export interface PhoneDataService {
  // Raw data (selector extraction, no AI)
  readonly saveRaw: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;
  readonly getRaw: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;
  readonly hasRaw: (slug: string) => Effect.Effect<boolean, PhoneDataError>;
  readonly getRawCount: () => Effect.Effect<number, PhoneDataError>;
  readonly getRawBulk: (
    slugs: string[],
  ) => Effect.Effect<
    Array<{ slug: string; data: Record<string, unknown> }>,
    PhoneDataError
  >;

  // AI-normalized data
  readonly save: (
    slug: string,
    data: Record<string, unknown>,
  ) => Effect.Effect<void, PhoneDataError>;
  readonly get: (
    slug: string,
  ) => Effect.Effect<Record<string, unknown> | null, PhoneDataError>;
  readonly has: (slug: string) => Effect.Effect<boolean, PhoneDataError>;
  readonly getCount: () => Effect.Effect<number, PhoneDataError>;

  // Pipeline queries
  readonly getSlugsNeedingExtraction: () => Effect.Effect<
    string[],
    PhoneDataError
  >;
  readonly getSlugsNeedingAi: () => Effect.Effect<string[], PhoneDataError>;
}
```

---

## Phase 3: Refactor KimovilScraper

**Issue:** `cod-3qg` (blocked by Phase 1 HtmlCacheService)

Split `scrape-kimovil.ts` (1112 lines) into three files:

### 3.1 kimovil.ts (~300 lines)

**Responsibilities:**

- Implements `ScrapeService` from `@repo/scraper-domain`
- Orchestrates: fetch → cache → extract → normalize
- Retry logic with rate limiting
- Injects: `HtmlCacheService`, `BrowserService`, `OpenAIService`, `PhoneDataService`

```typescript
export const KimovilScraperLive = Layer.effect(
  ScrapeService,
  Effect.gen(function* () {
    const htmlCache = yield* HtmlCacheService;
    const browser = yield* BrowserService;
    const openai = yield* OpenAIService;
    const phoneData = yield* PhoneDataService;

    return {
      scrape: (slug) => // orchestrate full pipeline
      scrapeFast: (slug) => // HTML only, no AI
    };
  }),
);
```

### 3.2 kimovil-extractors.ts (~600 lines)

**Responsibilities:**

- Pure functions that extract data from HTML/Page
- No side effects, no service dependencies
- Easily unit testable

**Exports:**

```typescript
export const extractPhoneData: (
  page: Page,
  slug: string,
) => Promise<RawPhoneData>;
export const getCameras: (cameraTables: Element[]) => CameraData[];
export const getSpecs: (page: Page) => Promise<SpecData>;
export const getSKUs: (page: Page) => Promise<Sku[]>;
export const getBenchmarks: (page: Page) => Promise<Benchmark[]>;
// ... other extraction functions
```

### 3.3 kimovil-validators.ts (~100 lines)

**Responsibilities:**

- HTML validation functions
- Bot detection patterns
- Reusable by other scrapers

**Exports:**

```typescript
export const isBotProtectionPage: (html: string) => string | null;
export const getHtmlValidationError: (html: string) => string | null;
export const hasRequiredStructure: (html: string) => boolean;
```

---

## Phase 4: Update LiveLayer and Cleanup

**Issue:** `cod-x5r` (blocked by Phase 2 and Phase 3)

### 4.1 New layers/live.ts

```typescript
import { Layer } from "effect";
import { FetchHttpClient } from "@effect/platform";

// Data Layer (shared infrastructure)
import { HtmlCacheServiceLive } from "../services/html-cache";
import { JobQueueServiceLive } from "../services/job-queue";
import { DeviceServiceLive } from "../services/device";
import { PhoneDataServiceLive } from "../services/phone-data";

// Processing
import { OpenAIServiceLive } from "../services/openai";
import { BrowserServiceLive } from "../services/browser";

// Scrapers
import { KimovilScraperLive } from "../services/kimovil";
import { SearchServiceKimovil } from "../services/search-kimovil";

// Data layer (no dependencies between them)
const DataLayer = Layer.mergeAll(
  HtmlCacheServiceLive,
  JobQueueServiceLive,
  DeviceServiceLive,
  PhoneDataServiceLive,
);

// Search with HTTP client
const SearchLayer = SearchServiceKimovil.pipe(
  Layer.provide(FetchHttpClient.layer),
);

// Kimovil scraper with all dependencies
const KimovilLayer = KimovilScraperLive.pipe(
  Layer.provide(HtmlCacheServiceLive),
  Layer.provide(BrowserServiceLive),
  Layer.provide(OpenAIServiceLive),
  Layer.provide(PhoneDataServiceLive),
);

// Compose all services
export const LiveLayer = Layer.mergeAll(
  DataLayer,
  SearchLayer,
  KimovilLayer,
  BrowserServiceLive,
  OpenAIServiceLive,
);

export type LiveLayerType = typeof LiveLayer;
```

### 4.2 Cleanup storage.ts

After all phases complete:

1. Remove all migrated methods
2. Keep only shared DB utilities if needed:
   - `getDb()` - singleton database connection
   - `ensureColumn()` - migration helper
   - `tableExists()` - migration helper
3. Or delete entirely if utilities can be inlined

### 4.3 Update imports across codebase

Files to update:

- `routes/api.ts` - Use new services
- `routes/ws.ts` - Use new services
- `bulk-job.ts` - Use JobQueueService
- `slug-crawler.ts` - Use DeviceService

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │    cod-bb8      │
                    │     (Epic)      │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    cod-8np      │ │    cod-co8      │ │    cod-duf      │
│ HtmlCacheService│ │ JobQueueService │ │  DeviceService  │
│   (Phase 1)     │ │   (Phase 1)     │ │   (Phase 1)     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │                   ▼                   │
         │          ┌─────────────────┐          │
         ├─────────▶│    cod-rll      │◀─────────┤
         │          │ PhoneDataService│
         │          │   (Phase 2)     │
         │          └────────┬────────┘
         │                   │
         ▼                   │
┌─────────────────┐          │
│    cod-3qg      │          │
│ KimovilScraper  │          │
│   (Phase 3)     │          │
└────────┬────────┘          │
         │                   │
         └─────────┬─────────┘
                   ▼
          ┌─────────────────┐
          │    cod-x5r      │
          │ LiveLayer+Clean │
          │   (Phase 4)     │
          └─────────────────┘
```

---

## Estimated Effort

| Phase   | Issues  | Estimated Lines                        | Complexity |
| ------- | ------- | -------------------------------------- | ---------- |
| Phase 1 | 3 tasks | ~800 new, ~800 removed from storage.ts | Medium     |
| Phase 2 | 1 task  | ~300 new, ~300 removed from storage.ts | Low        |
| Phase 3 | 1 task  | ~100 new (split existing 1112)         | Medium     |
| Phase 4 | 1 task  | ~50 new (live.ts rewrite)              | Low        |

**Total:** 6 tasks under 1 epic

---

## Verification Checklist

After each phase:

- [x] `npm run build` passes
- [x] `npm run check-types` passes
- [x] `npm run lint` passes
- [ ] Server starts: `npm run dev --filter=scraper`
- [ ] Manual test: scrape a phone, verify data flows correctly

After all phases:

- [x] storage.ts deleted or minimal (~50 lines)
- [x] All services have single responsibility
- [x] Easy to add new scraper source (GSMArena ready)
- [x] Each service independently testable

**Status: COMPLETED** (2025-12-20) - All 5 phases done, net -1,060 lines

---

## Future: Adding a New Scraper

With this architecture, adding GSMArena support:

1. Create `services/gsmarena.ts` - scraper orchestration
2. Create `services/gsmarena-extractors.ts` - GSMArena-specific selectors
3. Use shared `HtmlCacheService` with `source: 'gsmarena'`
4. Use shared `PhoneDataService` for storage
5. Add to `LiveLayer`

No changes needed to existing services!

---

## Phase 5: Introduce DatabaseService Layer

**Issue:** `cod-fzn` (blocked by Phase 4)

After the main refactor, upgrade from singleton `getDb()` to proper Effect pattern:

**Current (works but not idiomatic):**

```typescript
// Each service has its own getDb() copy
import { getDb } from "./db";
const db = getDb();
```

**Target (idiomatic Effect):**

```typescript
// db.ts
export interface DatabaseService {
  readonly db: Database.Database;
}
export const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService");

export const DatabaseServiceLive = Layer.sync(DatabaseService, () => {
  const db = new Database(DB_PATH);
  initSchema(db);
  return { db };
});

// job-queue.ts - proper dependency injection
export const JobQueueServiceLive = Layer.effect(
  JobQueueService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    return JobQueueService.of({ ... });
  }),
);
```

**Benefits:**

- Single DB connection guaranteed by Effect layer system
- Testable with mock DatabaseService
- Proper dependency graph
- Schema init happens once before any service

---

## Commands Reference

```bash
# View all issues
bd list

# View epic and children
bd show cod-bb8
bd dep tree cod-bb8

# Start work on Phase 1
bd update cod-8np --status in_progress

# Check what's ready to work on
bd ready

# After completing a task
bd close cod-8np --reason "HtmlCacheService extracted and tested"
```

---

# Epic 2: Idiomatic Effect Migration

**Epic:** `cod-???` (to be created)

## Overview

The storage refactoring (Epic 1) introduced proper service boundaries but the code still escapes Effect context frequently. This epic upgrades to fully idiomatic Effect patterns.

---

## Current Anti-Patterns

| Issue                           | Severity | Count | Impact                             |
| ------------------------------- | -------- | ----- | ---------------------------------- |
| `Effect.runPromise` mid-flow    | Critical | 20+   | Breaks composition, untyped errors |
| `async/await` in services       | Critical | 15+   | Should be `Effect.gen` + `yield*`  |
| `console.log`                   | Medium   | 30+   | No structured logging              |
| No `acquireRelease` for Browser | Critical | 1     | Browser leaks on errors            |
| `try/catch` blocks              | Medium   | 10+   | Hides typed errors                 |
| `AsyncGenerator` for streaming  | Medium   | 3     | Should be `Effect.Stream`          |
| Ambiguous service tag imports   | Low      | All   | Confusing naming                   |

---

## Phase 1: Class-Based Service Tags

Convert from `Context.GenericTag` to class-based tags for clarity.

**Before:**

```typescript
export interface DeviceService { ... }
export const DeviceService = Context.GenericTag<DeviceService>("DeviceService");
```

**After:**

```typescript
export class DeviceService extends Context.Tag("DeviceService")<
  DeviceService,
  {
    readonly getAllDevices: () => Effect.Effect<KimovilDevice[], DeviceError>;
    // ...
  }
>() {}
```

**Benefits:**

- Class name IS the tag - no ambiguity
- Better IDE support
- Modern Effect 3.x idiom

---

## Phase 2: Eliminate Effect.runPromise Escapes

Convert services to stay in Effect context.

**Before (scrape-kimovil.ts):**

```typescript
const scrapePhoneData = async (...) => {
  const browser = await Effect.runPromise(browserService.createBrowser());
  try {
    const page = await browser.newPage();
    // ...
  } finally {
    await browser.close();
  }
};
```

**After:**

```typescript
const scrapePhoneData = Effect.gen(function* () {
  yield* Effect.acquireRelease(browserService.createBrowser(), (browser) =>
    Effect.promise(() => browser.close()),
  ).pipe(
    Effect.flatMap((browser) =>
      Effect.gen(function* () {
        const page = yield* Effect.promise(() => browser.newPage());
        // ...
      }),
    ),
  );
});
```

---

## Phase 3: Resource Management with Scope

Introduce `Effect.acquireRelease` for all resources.

**Resources requiring cleanup:**

- Browser instances (Playwright)
- Database connections (if pooling added later)
- File handles (if any)

**Pattern:**

```typescript
export const BrowserService = {
  scoped: Effect.acquireRelease(
    Effect.tryPromise(() => chromium.launch()),
    (browser) => Effect.promise(() => browser.close()),
  ),
};

// Usage - browser automatically closed when scope ends
Effect.scoped(
  Effect.gen(function* () {
    const browser = yield* BrowserService.scoped;
    // use browser...
  }), // <- browser.close() called here
);
```

---

## Phase 4: Structured Logging

Replace `console.log` with `Effect.log*`.

**Before:**

```typescript
console.log(`[HtmlCache] Saved raw HTML for slug: ${slug}`);
```

**After:**

```typescript
yield *
  Effect.logInfo("Saved raw HTML").pipe(
    Effect.annotateLogs({ service: "HtmlCache", slug }),
  );
```

**Benefits:**

- Log levels (debug, info, warn, error)
- Structured metadata
- Configurable at runtime
- Testable (can capture logs)

---

## Phase 5: Effect.Stream for WebSocket Progress

Convert `AsyncGenerator` to `Effect.Stream`.

**Before:**

```typescript
async function* runScrape(): AsyncGenerator<ScrapeEvent> {
  yield { type: "progress", stage: "browser", progress: 0 };
  // ...
}
```

**After:**

```typescript
const runScrape: Stream.Stream<ScrapeEvent, ScrapeError, ScrapeService> =
  Stream.gen(function* () {
    yield* Stream.emit({ type: "progress", stage: "browser", progress: 0 });
    // ...
  });
```

**Benefits:**

- Backpressure handling
- Cancellation via Fiber interruption
- Composable with other streams
- Error typing

---

## Naming Conventions

### Services

```
{Name}Service       - The class/tag (e.g., DeviceService)
{Name}ServiceLive   - Production layer (e.g., DeviceServiceLive)
{Name}ServiceTest   - Test layer if needed
```

### Errors

```
{Name}Error         - Tagged error class (e.g., DeviceError)
```

### Effects

```
{verb}{Noun}        - e.g., getAllDevices, saveRawHtml
```

---

## Migration Order

1. **Phase 1** - Service tags (low risk, high clarity gain)
2. **Phase 2** - runPromise elimination in scrape-kimovil.ts (high risk, high value)
3. **Phase 3** - Browser resource management (critical for reliability)
4. **Phase 4** - Logging (low risk, can be gradual)
5. **Phase 5** - Streams (can defer, WebSocket still works)

---

## Estimated Effort

| Phase                   | Tasks      | Risk   | Priority |
| ----------------------- | ---------- | ------ | -------- |
| Phase 1: Class tags     | 8 services | Low    | P2       |
| Phase 2: No runPromise  | 3 files    | High   | P1       |
| Phase 3: acquireRelease | 1 service  | Medium | P1       |
| Phase 4: Logging        | All files  | Low    | P3       |
| Phase 5: Streams        | 2 files    | Medium | P3       |

---

## Verification

After migration:

- [ ] Zero `Effect.runPromise` inside service implementations
- [ ] Zero `async/await` in services (except in `Effect.tryPromise`)
- [ ] All resources use `acquireRelease`
- [ ] No browser leaks under error conditions
- [ ] Logs are structured JSON (when configured)
- [ ] WebSocket streaming uses backpressure
