# Job Outcomes & UX Improvements Plan

## Problem Statement

When jobs complete "successfully" but produce no useful result (e.g., price.ru search finds nothing), users see:
- Green checkmark in job details (looks like success)
- "1 link · No prices yet" in Prices tab (no explanation why)
- No way to understand what actually happened

## Goals

1. **Distinguish technical success from business outcome** — job completed vs. what it found
2. **Show meaningful messages in UI** — user understands exactly what happened
3. **Fix missing data bugs** — price.ru URLs not being saved

---

## Part 1: Backend — Outcome Tracking

### 1.1 Schema Change

Add `outcome` column to `job_queue` table:

```sql
ALTER TABLE job_queue ADD COLUMN outcome TEXT;
-- Values: 'success' | 'not_found' | 'no_offers' | 'no_data' | 'skipped' | NULL
```

Add `outcome_message` for human-readable context:

```sql
ALTER TABLE job_queue ADD COLUMN outcome_message TEXT;
-- e.g., "Searched 'Oppo Find X9' — no matches on price.ru"
```

**File:** `apps/scraper/src/sql/schema.ts`

### 1.2 Service Layer

Update `JobQueueService.completeQueueItem` signature:

```typescript
completeQueueItem(
  id: number, 
  errorMessage?: string,
  outcome?: JobOutcome,
  outcomeMessage?: string
): Effect.Effect<void, SqlError>
```

Add types:

```typescript
type JobOutcome = 'success' | 'not_found' | 'no_offers' | 'no_data' | 'skipped';
```

**File:** `apps/scraper/src/services/job-queue.ts`

### 1.3 Pipeline Handlers Return Outcomes

Update `PipelineContext` or handler return type to include outcome:

```typescript
interface PipelineResult {
  outcome: JobOutcome;
  message?: string;
}
```

Update handlers:

| Pipeline | Handler | Returns |
|----------|---------|---------|
| `price_ru:price_links` | `scrapeHandler` | `success` (linked) or `not_found` (no matches) |
| `price_ru:prices` | `scrapeHandler` | `success` (quotes saved) or `no_offers` (0 results) |
| `kimovil:specs` | `scrape/process_raw/process_ai` | `success` or `no_data` |

**Files:**
- `apps/scraper/src/sources/price_ru/link-pipeline.ts`
- `apps/scraper/src/sources/price_ru/prices-pipeline.ts`
- `apps/scraper/src/services/bulk-job.ts` (pass outcome to completeQueueItem)

### 1.4 API Response

Update `/api/jobs/:jobId/summary` to include outcome fields:

```typescript
items: [{
  id, deviceName, deviceSlug, status,
  outcome: "not_found",           // NEW
  outcomeMessage: "Searched 'Oppo Find X9' — no matches"  // NEW
}]
```

Add outcome breakdown to stats:

```typescript
stats: {
  total, pending, running, done, error,
  outcomes: { success: 20, not_found: 8, skipped: 2 }  // NEW
}
```

**File:** `apps/scraper/src/routes/api.ts`

---

## Part 2: Bug Fix — price.ru URLs

### 2.1 Extract `click_url` from API

The API returns `click_url` but we don't save it.

Update types:

```typescript
// types.ts
export interface PriceRuOffer {
  // ... existing fields
  clickUrl: string | null;  // ADD
}

export interface PriceRuSearchResponse {
  items: Array<{
    // ... existing fields
    click_url?: string;  // ADD
  }>;
}
```

Update client mapping:

```typescript
// client.ts
items: (data.items ?? []).map((item) => ({
  // ... existing fields
  clickUrl: item.click_url ? `https://price.ru${item.click_url}` : null,
})),
```

Update pipeline to pass URL:

```typescript
// prices-pipeline.ts
offers: offers.map((o) => ({
  // ... existing fields
  url: o.clickUrl ?? undefined,  // WAS: undefined
})),
```

**Files:**
- `apps/scraper/src/sources/price_ru/types.ts`
- `apps/scraper/src/sources/price_ru/client.ts`
- `apps/scraper/src/sources/price_ru/prices-pipeline.ts`

---

## Part 3: Frontend — Job Detail Modal

### 3.1 Outcome Icons

Replace single "done = green check" with outcome-specific icons:

| Outcome | Icon | Color | Label |
|---------|------|-------|-------|
| `success` | ✓ checkmark | Green | "Completed" |
| `not_found` | 🔍✗ search-off | Amber | "Not found" |
| `no_offers` | 📦✗ empty-box | Amber | "No offers available" |
| `no_data` | ⚠ warning | Amber | "No data extracted" |
| `skipped` | ⏭ skip | Gray | "Skipped" |
| `error` | ✗ x-mark | Red | "Failed" |

### 3.2 Outcome Message Display

Under device name, show outcome context:

```
Samsung Galaxy S24
price.ru · Not found (searched "Samsung Galaxy S24" on Dec 26)
```

### 3.3 Stats Breakdown

In the stats cards section, show outcome breakdown for "Done":

```
Done: 30
├─ 20 success
├─ 8 not found  
└─ 2 skipped
```

**File:** `apps/ws-web/src/pages/slugs/components/jobs/JobDetailModal.tsx`

---

## Part 4: Frontend — Prices Tab

### 4.1 Show "Not Found" Sources

Currently `deriveLinks()` ignores `not_found` sources. Update to include them with status:

```typescript
// PricesTab.tsx
status: source.status === "active" ? "active" 
      : source.status === "not_found" ? "not_found"
      : "stale",
```

### 4.2 Update Summary Message

Replace generic "1 link · No prices yet" with contextual message:

| Scenario | Message |
|----------|---------|
| Has active link, no quotes yet | "1 link · Refresh to get prices" |
| Has not_found source | "Searched price.ru for 'Device Name' on Dec 26 — no results" |
| Mixed (some links, some not_found) | Show price range + note about not_found |

### 4.3 Not Found Section

In "By Link" view, show a separate section:

```
── Searched but not found ──
price.ru
Searched "Oppo Find X9" on Dec 26 — no matches
[Retry Search]
```

### 4.4 DeviceSource API Enhancement

Include `metadata` in API response to get search query and timestamp:

```typescript
// Current
{ deviceId, source, externalId, url, status }

// Enhanced  
{ deviceId, source, externalId, url, status, metadata: { searched, at } }
```

**Files:**
- `apps/ws-web/src/pages/slugs/components/prices/PricesTab.tsx`
- `apps/ws-web/src/pages/slugs/components/prices/PricesLinksList.tsx`
- `apps/ws-web/src/pages/slugs/types.ts`
- `apps/scraper/src/routes/api.ts` (device sources endpoint)

---

## Implementation Order

1. **Schema + Service** — Add outcome columns and update completeQueueItem
2. **price.ru URL fix** — Quick win, standalone
3. **Pipeline handlers** — Return outcomes from link/prices pipelines
4. **bulk-job.ts** — Wire outcomes through to completeQueueItem
5. **API** — Include outcomes in job summary response
6. **JobDetailModal** — Outcome icons, messages, stats breakdown
7. **PricesTab** — Not found display, contextual messages

---

## User-Facing Messages (Copy)

### Job Detail Modal

| Outcome | Primary | Secondary (with context) |
|---------|---------|--------------------------|
| success | "Linked successfully" | "Linked to price.ru" |
| success (prices) | "Prices updated" | "Found 12 offers" |
| not_found | "Not found" | "Searched 'Device Name' — no matches on price.ru" |
| no_offers | "No offers" | "price.ru returned 0 offers (may be temporary)" |
| no_data | "No data" | "Page loaded but no extractable data found" |
| skipped | "Skipped" | "Already linked" / "Nothing to process" |

### Prices Tab

| State | Message |
|-------|---------|
| No sources at all | "No price sources linked yet" |
| Has link, no quotes | "Linked to price.ru · Refresh to fetch prices" |
| not_found | "Searched price.ru for 'Device' — no results found (Dec 26)" |
| Has quotes | "₽45,990 – ₽52,000 · 8 offers from 3 sellers" |

---

## Related Tasks

- **cod-on0**: Migrate Kimovil jobs to pipeline architecture (low priority, deferred)
