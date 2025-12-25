# price.ru Integration Plan

## Overview

Add price.ru as a second price source alongside Yandex Market, using existing bulk job architecture.

## API Summary

| Field | Value |
|-------|-------|
| Base URL | `https://price.ru/v4` |
| Partner ID | `631191034` |
| Region ID | `1` (Moscow) |
| Category ID | `2801` (mobile phones) |

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/search/offers` | POST | Search products, returns offers with `model_id` |
| `/models/{id}` | GET | Get model details + aggregated `price_info` (min/max/avg) |
| `/regions` | GET | List available regions |

### Key Concepts

- **`model_id`** — Stable identifier per variant (color + storage combo)
  - Example: `8137690` = "Galaxy S24 Ultra 12/512GB Gray"
- **`click_url`** — Affiliate link with short TTL (must fetch on-demand)
- **`/models/{id}`** — Returns `price_info: { min, max, avg }` without offers — ideal for scheduled updates

---

## Architecture

### Data Flow

**Bulk Auto-Link (job_type: `link_priceru`):**
```
For each device in selection:
  → Search price.ru with device.name
  → Match model_ids by parsing variant (storage/color)
  → Save to device_sources (source='price_ru', external_id=model_id)
  → If no match → save with status='not_found'
```

**Bulk Price Update (job_type: `scrape`, source: `price_ru`):**
```
For each device_sources where source='price_ru' AND status='active':
  → GET /models/{external_id} → price_info { min, max, avg }
  → Save to entity_data_raw (for debugging/replay)
  → Save to price_quotes as synthetic offer
  → Update price_summary
```

### Storage Model

**device_sources:**
```
| device_id | source   | external_id | status    | metadata                                    |
|-----------|----------|-------------|-----------|---------------------------------------------|
| dev_abc   | price_ru | 8137690     | active    | {"variant_key":"12/512","name":"..."}       |
| dev_abc   | price_ru | 8137684     | active    | {"variant_key":"12/256","name":"..."}       |
| dev_xyz   | price_ru | NULL        | not_found | {"searched":"Obscure Phone X","at":1234}    |
```

**price_quotes:**
```
| device_id | source   | external_id | seller                  | price  | variant_key |
|-----------|----------|-------------|-------------------------|--------|-------------|
| dev_abc   | price_ru | 8137690     | price.ru (aggregated)   | 7149000| 12/512      |
```

---

## Implementation Phases

### Phase 1: PriceRuClient Service (~180 lines)

**Files:**
- `apps/scraper/src/sources/price_ru/client.ts`
- `apps/scraper/src/sources/price_ru/errors.ts`
- `apps/scraper/src/sources/price_ru/types.ts`

**types.ts:**
```typescript
export interface PriceRuConfig {
  partnerId: string;
  regionId: number;
  categoryId: string;
}

export interface PriceRuOffer {
  id: number;
  name: string;
  modelId: number;
  price: number;
  shopName: string;
  availability: string;
  redirectTarget: "to_merchant" | "to_price";
}

export interface PriceRuModel {
  id: number;
  name: string;
  priceInfo: { min: number; max: number; avg: number };
  offerCount: number;
}

export interface SearchResult {
  items: PriceRuOffer[];
  total: number;
}

// Raw API response types (for type-safe parsing)
export interface PriceRuSearchResponse {
  items: Array<{
    id: number;
    name: string;
    model_id: number;
    price: number;
    shop_info?: { name?: string };
    availability?: string;
    redirect_target?: "to_merchant" | "to_price";
  }>;
  total: number;
}
```

**errors.ts:**
```typescript
import { Data } from "effect";

export class PriceRuApiError extends Data.TaggedError("PriceRuApiError")<{
  status: number;
  message: string;
  endpoint: string;
}> {}

export class PriceRuNetworkError extends Data.TaggedError("PriceRuNetworkError")<{
  message: string;
  cause?: unknown;
}> {}

export type PriceRuError = PriceRuApiError | PriceRuNetworkError;
```

**client.ts:**
```typescript
import { Effect, Context, Layer, Schedule } from "effect";
import { PriceRuApiError, PriceRuNetworkError, type PriceRuError } from "./errors";
import type { PriceRuConfig, PriceRuModel, SearchResult, PriceRuSearchResponse } from "./types";

const BASE_URL = "https://price.ru/v4";

export interface PriceRuClient {
  readonly searchOffers: (query: string, perPage?: number) => Effect.Effect<SearchResult, PriceRuError>;
  readonly getModel: (modelId: number) => Effect.Effect<PriceRuModel | null, PriceRuError>;
}

export const PriceRuClient = Context.GenericTag<PriceRuClient>("PriceRuClient");

// Retry only on network errors, not API errors (4xx/5xx are permanent for that request)
const retrySchedule = Schedule.exponential("500 millis").pipe(
  Schedule.intersect(Schedule.recurs(3)),
  Schedule.whileInput((e: PriceRuError) => e._tag === "PriceRuNetworkError"),
);

export const PriceRuClientLive = Layer.effect(
  PriceRuClient,
  Effect.gen(function* () {
    const config: PriceRuConfig = {
      partnerId: process.env.PRICERU_PARTNER_ID ?? "631191034",
      regionId: 1,
      categoryId: "2801",
    };

    const request = <T>(endpoint: string, options?: RequestInit): Effect.Effect<T, PriceRuError> =>
      Effect.gen(function* () {
        const res = yield* Effect.tryPromise({
          try: () =>
            fetch(`${BASE_URL}${endpoint}`, {
              ...options,
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            }),
          catch: (e) => new PriceRuNetworkError({ message: String(e), cause: e }),
        });

        if (!res.ok) {
          return yield* Effect.fail(
            new PriceRuApiError({
              status: res.status,
              message: `HTTP ${res.status}`,
              endpoint,
            }),
          );
        }

        return yield* Effect.tryPromise({
          try: () => res.json() as Promise<T>,
          catch: (e) => new PriceRuNetworkError({ message: String(e), cause: e }),
        });
      }).pipe(Effect.retry(retrySchedule));

    return PriceRuClient.of({
      searchOffers: (query, perPage = 10) =>
        request<PriceRuSearchResponse>(
          `/search/offers?region_id=${config.regionId}&category_id=${config.categoryId}&per_page=${perPage}&partner_pad_id=${config.partnerId}&ref=1`,
          { method: "POST", body: JSON.stringify({ query }) },
        ).pipe(
          Effect.map((data) => ({
            items: (data.items ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              modelId: item.model_id,
              price: item.price,
              shopName: item.shop_info?.name ?? "Unknown",
              availability: item.availability ?? "unknown",
              redirectTarget: item.redirect_target ?? "to_merchant",
            })),
            total: data.total ?? 0,
          })),
        ),

      getModel: (modelId) =>
        request<{ id?: number; name?: string; price_info?: { min?: number; max?: number; avg?: number }; offer_count?: number }>(
          `/models/${modelId}?region_id=${config.regionId}&partner_pad_id=${config.partnerId}&ref=1`,
        ).pipe(
          Effect.map((data): PriceRuModel | null =>
            data?.id
              ? {
                  id: data.id,
                  name: data.name ?? "",
                  priceInfo: {
                    min: data.price_info?.min ?? 0,
                    max: data.price_info?.max ?? 0,
                    avg: data.price_info?.avg ?? 0,
                  },
                  offerCount: data.offer_count ?? 0,
                }
              : null,
          ),
          // Only treat 404/410 as "model not found", let other errors propagate
          Effect.catchTag("PriceRuApiError", (e) =>
            e.status === 404 || e.status === 410
              ? Effect.succeed<PriceRuModel | null>(null)
              : Effect.fail(e),
          ),
        ),
    });
  }),
);
```

---

### Phase 2: Schema & DeviceRegistry Updates (~60 lines)

**apps/scraper/src/sql/schema.ts:**
```typescript
// Add metadata column
yield* ensureColumn(sql, "device_sources", "metadata", "TEXT");

// Extend job_type CHECK constraint (requires table rebuild or new migration)
// Add 'link_priceru' to allowed values
```

**packages/scraper-domain/src/models/device.ts:**
```typescript
// Extend SourceStatus
export type SourceStatus = "active" | "missing" | "deleted" | "conflict" | "not_found";

// Extend DataKind
export type DataKind = "specs" | "prices" | "reviews" | "availability" | "price_links";

// Extend JobType
export type JobType = "scrape" | "process_raw" | "process_ai" | "clear_html" | "clear_raw" | "clear_processed" | "link_priceru";
```

**apps/scraper/src/pipeline/registry.ts:**
```typescript
// Add metadata field to PipelineContext
export interface PipelineContext {
  jobId: string;
  deviceId: string | null;
  source: string;
  dataKind: DataKind;
  externalId: string;
  scrapeId: number | null;
  metadata?: Record<string, unknown>; // Optional metadata from device_sources
}
```

**apps/scraper/src/services/device-registry.ts:**
```typescript
// Update DeviceSourceLink interface
export interface DeviceSourceLink {
  deviceId: string;
  source: string;
  externalId: string;
  url: string | null;
  status: SourceStatus;
  metadata: Record<string, unknown> | null; // NEW: optional metadata JSON
  firstSeen: number;
  lastSeen: number;
}

// Update linkDeviceToSource input to accept status and metadata
readonly linkDeviceToSource: (input: {
  deviceId: string;
  source: string;
  externalId: string;
  url?: string | null;
  status?: SourceStatus;  // NEW: defaults to 'active'
  metadata?: Record<string, unknown> | null;  // NEW: optional metadata
}) => Effect.Effect<void, DeviceRegistryError>;

// NEW: Get sources for a device filtered by source type
readonly getSourcesByDeviceAndSource: (
  deviceId: string,
  source: string,
) => Effect.Effect<DeviceSourceLink[], DeviceRegistryError>;

// NEW: Mark a device as not found on a source
readonly markSourceNotFound: (input: {
  deviceId: string;
  source: string;
  searchedQuery: string;
}) => Effect.Effect<void, DeviceRegistryError>;
```

**packages/scraper-protocol/src/messages.ts:**
```typescript
// Update JobTypeSchema to include link_priceru
export const JobTypeSchema = Schema.Literal(
  "scrape", "process_raw", "process_ai", 
  "clear_html", "clear_raw", "clear_processed",
  "link_priceru"  // NEW
);
```

---

### Phase 3: Pipelines (~180 lines)

**apps/scraper/src/sources/price_ru/variant-utils.ts (~40 lines):**
```typescript
export const extractVariantKey = (name: string): string | null => {
  // "Samsung Galaxy S24 Ultra 12/512Gb" → "12/512"
  // "iPhone 15 Pro 256GB" → "256" (no RAM shown)
  const ramStorageMatch = name.match(/(\d+)\s*[\/\\]\s*(\d+)\s*[GgТт][Bbб]/i);
  if (ramStorageMatch) {
    return `${ramStorageMatch[1]}/${ramStorageMatch[2]}`;
  }
  
  const storageOnlyMatch = name.match(/(\d+)\s*[GgТт][Bbб]/i);
  if (storageOnlyMatch) {
    return storageOnlyMatch[1];
  }
  
  return null;
};

export const normalizeVariantKey = (key: string): string => {
  // Normalize to consistent format: "8/256" or "256"
  return key.replace(/\s+/g, "").toLowerCase();
};
```

**apps/scraper/src/sources/price_ru/link-pipeline.ts (~70 lines):**
```typescript
import { Effect } from "effect";
import { registerPipeline, PipelineContext } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { DeviceRegistryService } from "../../services/device-registry";
import { extractVariantKey } from "./variant-utils";

const MAX_VARIANTS_PER_DEVICE = 5;

const linkHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const registry = yield* DeviceRegistryService;

    const device = yield* registry.getDeviceById(ctx.deviceId);
    if (!device) {
      yield* Effect.logWarning("Device not found").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId })
      );
      return;
    }

    const results = yield* client.searchOffers(device.name, 20);

    if (results.items.length === 0) {
      yield* registry.markSourceNotFound({
        deviceId: ctx.deviceId,
        source: "price_ru",
        searchedQuery: device.name,
      });
      yield* Effect.logInfo("No price.ru match found").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId, name: device.name })
      );
      return;
    }

    // Deduplicate by model_id
    const seenModels = new Set<number>();
    const uniqueOffers = results.items.filter((o) => {
      if (seenModels.has(o.modelId)) return false;
      seenModels.add(o.modelId);
      return true;
    });

    // Link each unique model (up to MAX_VARIANTS_PER_DEVICE)
    for (const offer of uniqueOffers.slice(0, MAX_VARIANTS_PER_DEVICE)) {
      const variantKey = extractVariantKey(offer.name);
      yield* registry.linkDeviceToSource({
        deviceId: ctx.deviceId,
        source: "price_ru",
        externalId: String(offer.modelId),
        status: "active",
        metadata: {
          variant_key: variantKey,
          name: offer.name,
          linked_at: Date.now(),
        },
      });
    }

    yield* Effect.logInfo("Linked to price.ru").pipe(
      Effect.annotateLogs({ deviceId: ctx.deviceId, count: Math.min(uniqueOffers.length, MAX_VARIANTS_PER_DEVICE) })
    );
  });

registerPipeline({
  source: "price_ru",
  dataKind: "price_links",
  stages: { scrape: linkHandler },
});
```

**apps/scraper/src/sources/price_ru/prices-pipeline.ts (~70 lines):**
```typescript
import { Effect } from "effect";
import { registerPipeline, PipelineContext } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { PriceService } from "../../services/price";
import { EntityDataService } from "../../services/entity-data";

const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const priceService = yield* PriceService;
    const entityData = yield* EntityDataService;

    if (!ctx.externalId || !ctx.deviceId) {
      return;
    }

    const modelId = parseInt(ctx.externalId, 10);
    if (isNaN(modelId)) {
      yield* Effect.logWarning("Invalid model ID").pipe(
        Effect.annotateLogs({ externalId: ctx.externalId })
      );
      return;
    }

    const model = yield* client.getModel(modelId);

    if (!model || model.offerCount === 0) {
      yield* Effect.logWarning("No price data from price.ru").pipe(
        Effect.annotateLogs({ modelId })
      );
      return;
    }

    // Save raw data for debugging/replay
    yield* entityData.saveRawData({
      deviceId: ctx.deviceId,
      source: "price_ru",
      dataKind: "prices",
      data: { model, fetchedAt: Date.now() },
    });

    // Save aggregated price as synthetic offer
    yield* priceService.savePriceQuotes({
      deviceId: ctx.deviceId,
      source: "price_ru",
      externalId: ctx.externalId,
      offers: [
        {
          seller: "price.ru (aggregated)",
          priceMinorUnits: model.priceInfo.min * 100,
          currency: "RUB",
          isAvailable: true,
          variantKey: ctx.metadata?.variant_key as string | undefined,
        },
      ],
    });

    yield* priceService.updatePriceSummary(ctx.deviceId);

    yield* Effect.logInfo("Saved price.ru prices").pipe(
      Effect.annotateLogs({ 
        modelId, 
        min: model.priceInfo.min, 
        max: model.priceInfo.max,
        offerCount: model.offerCount,
      })
    );
  });

registerPipeline({
  source: "price_ru",
  dataKind: "prices",
  stages: { scrape: scrapeHandler },
});
```

---

### Phase 4: Layer Integration (~15 lines)

**apps/scraper/src/sources/price_ru/index.ts:**
```typescript
import "./link-pipeline";
import "./prices-pipeline";

export { PriceRuClient, PriceRuClientLive } from "./client";
export * from "./types";
export * from "./errors";
export * from "./variant-utils";
```

**apps/scraper/src/layers/live.ts:**
```typescript
import "../sources/price_ru";
import { PriceRuClientLive } from "../sources/price_ru";

// Add to layer composition
const PriceRuLayer = PriceRuClientLive;

export const LiveLayer = Layer.mergeAll(
  // ... existing layers
  PriceRuLayer,
);
```

---

### Phase 5: Frontend Integration (~60 lines)

**Bulk action in DevicesTable or SelectionBar:**
```typescript
// Add to bulk actions dropdown
<DropdownItem
  onClick={() => {
    const deviceIds = selectedDeviceIds();
    ws.send(JSON.stringify({
      id: crypto.randomUUID(),
      method: "bulk.start",
      params: {
        jobType: "link_priceru",
        source: "price_ru",
        dataKind: "price_links",
        mode: "fast",
        deviceIds,
      },
    }));
  }}
>
  Find price.ru matches
</DropdownItem>

<DropdownItem
  onClick={() => {
    ws.send(JSON.stringify({
      id: crypto.randomUUID(),
      method: "bulk.start",
      params: {
        jobType: "scrape",
        source: "price_ru",
        dataKind: "prices",
        mode: "fast",
        filter: "has_priceru_link",  // only devices with active price_ru links
      },
    }));
  }}
>
  Update price.ru prices
</DropdownItem>
```

---

## Summary

| Phase | Description | Lines |
|-------|-------------|-------|
| 1 | PriceRuClient service (idiomatic Effect patterns) | ~180 |
| 2 | Schema + DeviceRegistry + Domain + Protocol updates | ~80 |
| 3 | Pipelines (link + prices + utils) + PipelineContext | ~190 |
| 4 | Layer integration | ~15 |
| 5 | Frontend | ~60 |
| **Total** | | **~525 lines** |

### Required Domain/Protocol Changes

| Package | File | Change |
|---------|------|--------|
| `scraper-domain` | `models/device.ts` | Add `"not_found"` to `SourceStatus`, `"price_links"` to `DataKind`, `"link_priceru"` to `JobType` |
| `scraper-protocol` | `messages.ts` | Add `"link_priceru"` to `JobTypeSchema` |
| `scraper` | `pipeline/registry.ts` | Add `metadata?: Record<string, unknown>` to `PipelineContext` |
| `scraper` | `sql/schema.ts` | Update CHECK constraints for `job_type` and `status`, add `metadata` column to `device_sources` |
| `scraper` | `services/device-registry.ts` | Add `metadata` field, extend `linkDeviceToSource`, add `getSourcesByDeviceAndSource` |

---

## Job Flow Diagrams

### Link Job Flow
```
User selects 50 devices → Click "Find price.ru matches"
  ↓
bulk.start({ jobType: 'link_priceru', source: 'price_ru', dataKind: 'price_links', deviceIds })
  ↓
Creates jobs row + 50 job_queue items
  ↓
Worker processes each:
  → Search price.ru API with device.name
  → Parse results, extract model_ids
  → Create device_sources rows (active or not_found)
  ↓
WebSocket pushes progress → UI shows ₽ icons appearing
  ↓
Job complete → Stats: "Linked: 45 | Not found: 5"
```

### Price Update Job Flow
```
Scheduler triggers daily OR user clicks "Update price.ru prices"
  ↓
bulk.start({ jobType: 'scrape', source: 'price_ru', dataKind: 'prices' })
  ↓
Query device_sources WHERE source='price_ru' AND status='active'
  ↓
Creates job_queue items for each link
  ↓
Worker processes each:
  → GET /models/{model_id}
  → Save raw response to entity_data_raw
  → Save min price to price_quotes
  → Update price_summary
  ↓
Job complete → Prices updated
```

---

## Oracle Review Notes

1. ✅ Architecture fits existing patterns (services, pipelines, bulk jobs)
2. ✅ Use proper `status='not_found'` instead of sentinel externalId
3. ✅ Add new `dataKind='price_links'` for link jobs
4. ✅ Save raw API responses to `entity_data_raw` for debugging
5. ✅ Extract shared variant normalization utility
6. ✅ Store aggregated prices as synthetic offer with `seller="price.ru (aggregated)"`
7. ⚠️ Consider rate limiting if API limits become an issue
8. ⚠️ May need to extend `SourceStatus` enum in domain package
