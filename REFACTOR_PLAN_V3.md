# Refactor Plan V3: Multi-Source Device Data Platform

## Overview

Evolve from "Kimovil scraper" to "multi-source device data platform" by:

- Making **devices** central and source-agnostic
- Treating **scrapes** as first-class entities; HTML belongs to scrapes, scrapes belong to devices
- Letting each **data kind** (specs, prices, reviews, …) define its own schema and domain, but reusing the **same infrastructure** for jobs, HTML cache, and pipelines
- Making **source + dataKind + stage** the universal key for workers and jobs

**Estimated effort**: 2-3 weeks + 3-5 days per new source

---

## 1. Schema Redesign

### 1.1 Devices & Source Links

Create a **source-agnostic device registry** and explicit links to each source.

```sql
-- Canonical device registry
CREATE TABLE devices (
  id TEXT PRIMARY KEY,              -- platform-wide device id (16-char sha256 slug)
  slug TEXT UNIQUE NOT NULL,        -- canonical slug (initially Kimovil slug)
  name TEXT NOT NULL,
  brand TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Links devices to external sources
CREATE TABLE device_sources (
  device_id TEXT NOT NULL REFERENCES devices(id),
  source TEXT NOT NULL,             -- 'kimovil' | 'gsmarena' | 'yandex' | ...
  external_id TEXT NOT NULL,        -- source-specific key (slug, product ID)
  url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','missing','deleted','conflict')),
  first_seen INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source, external_id),
  UNIQUE (device_id, source)
);
```

**Migration**: `kimovil_devices` becomes a Kimovil discovery index. Each row maps to `devices` + `device_sources` with `source='kimovil'`.

### 1.2 Scrapes & HTML

Apply the key insight: **HTMLs belong to scrapes, scrapes link to devices**.

```sql
-- Individual scrape attempts
CREATE TABLE scrapes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT REFERENCES devices(id),  -- nullable if discovered before mapping
  source TEXT NOT NULL,
  data_kind TEXT NOT NULL,                -- 'specs' | 'prices' | 'reviews' | 'availability'
  external_id TEXT NOT NULL,              -- usually matches device_sources.external_id
  url TEXT,
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  error_message TEXT
);
CREATE INDEX idx_scrapes_device ON scrapes(device_id);
CREATE INDEX idx_scrapes_source_ext ON scrapes(source, external_id);
```

**HTML Cache changes**:
- Add `scrape_id INTEGER REFERENCES scrapes(id)` to `raw_html` and `scrape_verification`
- Keep `(slug, source)` key for backward compatibility initially

### 1.3 Entity Data (Generic Raw + Normalized)

Generalize `phone_data_raw` and `phone_data` to support multiple sources and data kinds:

```sql
-- Source-specific extracted data
CREATE TABLE entity_data_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(id),
  source TEXT NOT NULL,
  data_kind TEXT NOT NULL,            -- 'specs' | 'prices' | 'reviews' | ...
  scrape_id INTEGER REFERENCES scrapes(id),
  data TEXT NOT NULL,                 -- JSON (RawPhoneKimovil, RawPhoneGsmarena, RawPriceList, etc.)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(device_id, source, data_kind)
);

-- Normalized/merged data (one per device + data_kind)
CREATE TABLE entity_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(id),
  data_kind TEXT NOT NULL,            -- 'specs' | 'prices' | 'reviews' | ...
  data TEXT NOT NULL,                 -- normalized model JSON (Phone, PriceSummary, etc.)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(device_id, data_kind)
);
```

### 1.4 Price Data (Dedicated Table)

Prices are multi-row per device (per seller/offer/time), so they get a dedicated table:

```sql
CREATE TABLE price_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(id),
  source TEXT NOT NULL,               -- 'yandex_market', etc.
  seller TEXT,
  price_minor_units INTEGER NOT NULL, -- cents/kopeks
  currency TEXT NOT NULL,
  url TEXT,
  scraped_at INTEGER NOT NULL,
  scrape_id INTEGER REFERENCES scrapes(id),
  is_available INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_price_quotes_device ON price_quotes(device_id, source, scraped_at);

-- Optional aggregated summary
CREATE TABLE price_summary (
  device_id TEXT PRIMARY KEY REFERENCES devices(id),
  min_price_minor_units INTEGER,
  max_price_minor_units INTEGER,
  currency TEXT,
  updated_at INTEGER
);
```

### 1.5 Jobs & Queue (Source + DataKind Aware)

Extend existing tables with new columns:

```sql
-- Add to jobs table
ALTER TABLE jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'kimovil';
ALTER TABLE jobs ADD COLUMN data_kind TEXT NOT NULL DEFAULT 'specs';

-- Add to job_queue table
ALTER TABLE job_queue ADD COLUMN source TEXT NOT NULL DEFAULT 'kimovil';
ALTER TABLE job_queue ADD COLUMN data_kind TEXT NOT NULL DEFAULT 'specs';
ALTER TABLE job_queue ADD COLUMN scrape_id INTEGER REFERENCES scrapes(id);
```

**job_type** stays as "stage": `'scrape'`, `'process_raw'`, `'process_ai'`

---

## 2. Domain Models

### 2.1 Core Domain

```typescript
// src/domain/device.ts
export class Device extends Schema.Class<Device>("Device")({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  brand: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

export class DeviceSourceLink extends Schema.Class<DeviceSourceLink>("DeviceSourceLink")({
  deviceId: Schema.String,
  source: Schema.String,
  externalId: Schema.String,
  url: Schema.NullOr(Schema.String),
  status: Schema.Literal("active", "missing", "deleted", "conflict"),
  firstSeen: Schema.Number,
  lastSeen: Schema.Number,
}) {}
```

### 2.2 Specs (existing Phone model)

- Keep `RawPhone` and `Phone` as `dataKind='specs'` models
- Add source-specific variants if needed: `RawPhoneKimovil`, `RawPhoneGsmarena`

### 2.3 Prices (new)

```typescript
// src/domain/price.ts
export class PriceQuote extends Schema.Class<PriceQuote>("PriceQuote")({
  source: Schema.String,
  deviceId: Schema.String,
  seller: Schema.NullOr(Schema.String),
  priceMinorUnits: Schema.Number,
  currency: Schema.String,
  url: Schema.NullOr(Schema.String),
  scrapedAt: Schema.Number,
  isAvailable: Schema.Boolean,
}) {}
```

### 2.4 Pattern for New DataKinds

1. Define `RawXSource` → raw scraped structure
2. Define `X` (normalized) → platform-wide structure
3. Persist raw in `entity_data_raw(device_id, source, data_kind)`
4. Persist normalized in `entity_data(device_id, data_kind)`

---

## 3. Service Architecture

### 3.1 Core Services (Generic)

| Service | Responsibility |
|---------|---------------|
| `DeviceRegistryService` | Manage `devices` + `device_sources`, lookup/create devices |
| `EntityDataService` | Abstract `entity_data_raw` + `entity_data` |
| `HtmlCacheService` | Extended to work with scrapes |
| `JobQueueService` | Extended with `source` + `dataKind` |
| `ScrapeService` | Generic scrape lifecycle |

### 3.2 Source-Specific Services

Per `(source, dataKind)` combination:

- `ScrapeServiceKimovilSpecs` — current Kimovil pipeline
- `ScrapeServiceGsmarenaSpecs` — GSMArena phone specs
- `ScrapeServiceYandexPrices` — Yandex.Market prices

Each implements the same stage pattern:
1. `scrape` — fetch HTML, create scrape record
2. `process_raw` — parse HTML to raw structured data
3. `process_ai` — normalize/merge (if applicable)

---

## 4. Pipeline System

### 4.1 Pipeline Registry

```typescript
type DataKind = "specs" | "prices" | "reviews" | "availability";
type PipelineStage = "scrape" | "process_raw" | "process_ai";

interface PipelineContext {
  job: JobQueueItem;
  deviceId: string;
  source: string;
  dataKind: DataKind;
  externalId: string;
}

type StageHandler = (ctx: PipelineContext) => Effect.Effect<void, Error>;

interface PipelineDefinition {
  source: string;
  dataKind: DataKind;
  stages: Record<PipelineStage, StageHandler>;
}
```

### 4.2 Worker Flow

1. Claim next `job_queue` row
2. Lookup `source + dataKind + jobType` in pipeline registry
3. Build `PipelineContext`
4. Execute stage handler

---

## 5. Code Organization

```
src/
├── domain/
│   ├── device.ts          # Device, DeviceSourceLink
│   ├── phone.ts           # RawPhone, Phone (specs)
│   ├── price.ts           # PriceQuote
│   └── common.ts          # DataKind, shared types
├── services/core/
│   ├── html-cache.ts      # Generic, scrape-aware
│   ├── job-queue.ts       # Generic, source+dataKind aware
│   ├── device-registry.ts # devices + device_sources
│   ├── entity-data.ts     # entity_data_raw + entity_data
│   └── scrape.ts          # scrapes table management
├── sources/
│   ├── kimovil/
│   │   ├── search.ts
│   │   ├── scrape-specs.ts
│   │   └── device-index.ts    # prefix discovery
│   ├── gsmarena/
│   │   ├── search.ts
│   │   └── scrape-specs.ts
│   └── yandex/
│       └── scrape-prices.ts
├── sql/
│   ├── client.ts
│   ├── schema.ts          # All table definitions
│   └── quarantine.ts
└── layers/
    └── live.ts            # Compose all layers
```

**Adding a new source**:
1. Create `src/sources/{source}/` folder
2. Implement search/scrape/parse modules
3. Register pipeline definition
4. Wire one Layer into `LiveLayer`

---

## 6. Migration Strategy

### Phase 1: Schema Extensions (1-2 days)
- Add `source`, `data_kind` columns to `jobs` and `job_queue` with defaults
- Add `scrape_id` to `raw_html` and `scrape_verification`
- Create new tables: `devices`, `device_sources`, `scrapes`, `entity_data_raw`, `entity_data`, `price_quotes`

### Phase 2: Backfill Devices (0.5 day)
- Populate `devices` from `kimovil_devices`
- Populate `device_sources` with `source='kimovil'`

### Phase 3: EntityData + Scrapes (3-4 days)
- Implement `DeviceRegistryService`
- Implement `EntityDataService`
- Wire scrape lifecycle into HTML saving

### Phase 4: Job Queue Extensions (2-3 days)
- Extend `JobQueueItem`/`Job` types with `source`, `dataKind`
- Add new queue methods
- Update workers to use pipeline registry

### Phase 5: Migrate Kimovil Pipeline (3-5 days)
- Move from `phone_data_*` to `entity_data_*`
- Keep `PhoneDataService` as facade for API compatibility

### Phase 6: Cleanup (2-3 days)
- Remove legacy code paths
- Update documentation

**Total: ~2-3 weeks**

---

## 7. Effort for New Sources (After Refactor)

| Source | DataKind | Effort |
|--------|----------|--------|
| GSMArena | specs | 3-5 days |
| Yandex.Market | prices | 3-5 days |
| Other | varies | 2-5 days |

---

## 8. Key Benefits

1. **Easy to add sources**: Just add folder + register pipeline
2. **Heterogeneous data**: Each dataKind has appropriate schema
3. **Device as aggregate root**: Easy queries for "all data about device X"
4. **Shared infrastructure**: Jobs, HTML cache, browser service reused
5. **Postgres ready**: Generic schema patterns, no SQLite-specific hacks in new code
