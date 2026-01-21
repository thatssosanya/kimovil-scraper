# Pipeline Architecture Refactoring Plan

## 1) TL;DR

Unify everything behind a single **PipelineRunner** that owns the scrape lifecycle: **create scrape record → run stage handler(s) → persist outputs (HTML/raw/AI) → mark record done/error**. Make `bulk-job.ts` call the runner for all items (no "legacy vs pipeline" branching), and implement real `kimovil/specs` handlers that delegate to the existing Kimovil scraping code but **with a guaranteed `scrapeId`**. For Bright Data limits, stop reusing Kimovil browser sessions (use `createBrowserScoped` or a Kimovil-specific pool config with `maxUses≈1`).

**Effort**: L (1–2 days) to implement runner + Kimovil pipeline + bulk-job migration; XL if you also standardize yandex/price at the same time and add backfill tooling.

---

## 2) Target Architecture Overview

### Core Idea

A pipeline is the only entry point for all scraping work. A "scrape" is a durable, DB-tracked unit of work with an ID (`scrapeId`) that links HTML, raw extraction, and AI normalization.

### Components (Target State)

1. **Pipeline registry (already exists)**
   - `registerPipeline({ source, dataKind, stages })`
   - Only defines handlers. No orchestration logic.

2. **PipelineRunner (new)** — orchestration + invariants
   - Input: `{ jobId, source, dataKind, externalId, deviceId?, stage }`
   - Responsibilities:
     - Resolve pipeline + handler for the stage
     - Ensure a `scrapeId` exists for the scrape stage (and optionally for later stages)
     - Call `ScrapeRecordService.startScrape(scrapeId)` when beginning scrape stage
     - Run the stage handler with a `PipelineContext` that includes `scrapeId`
     - On success/failure: update scrape record (`done`/`error`)
     - Return `PipelineResult` mapping to `JobOutcome` for the queue

3. **Stage handlers (per source/dataKind)**
   - `scrape`: fetch HTML, save to `scrape_html` by `scrapeId` (always), optionally emit events/logs
   - `process_raw`: read HTML by `scrapeId` (or locate latest scrape), extract structured raw, save to `entity_data_raw`
   - `process_ai`: read raw, run AI normalization, save to `entity_data`

4. **Bulk job runner**
   - No scraping logic. It just claims queue items and calls `PipelineRunner.runStage(...)`.

5. **Browser strategy**
   - Browser pooling is *source-aware*:
     - Kimovil + Bright Data: **no session reuse** (or `maxUses = 1–2`)
     - Other sources can still reuse safely

### Data Flow (Single Item)

```
job_queue item 
  → PipelineRunner (stage=scrape) 
    → scrapes row created 
    → scrape_html saved 
  → PipelineRunner (stage=process_raw) 
    → entity_data_raw saved 
  → PipelineRunner (stage=process_ai) 
    → entity_data saved
```

---

## 3) Step-by-Step Migration Plan

### Phase 0 — Prep/Observability (S: <1h)

- Add log annotations consistently: `{ jobId, source, dataKind, externalId, scrapeId, stage }`
- Add a "pipeline enabled" feature flag (env/config) only if you need a rollback switch; otherwise migrate directly

### Phase 1 — Introduce PipelineRunner (M: 1–3h)

Create `apps/scraper/src/pipeline/runner.ts`:

**API**
```typescript
runStage(input): Effect<PipelineResult, PipelineError, Deps>
ensureScrapeRecord(ctx): Effect<PipelineContextWithScrapeId, ...>
// Optional: runToStage(input, targetStage) for chainable execution
```

**Key Invariant**
- If stage is `scrape`, runner must **create** the record and set `ctx.scrapeId`
- If stage is `process_raw`/`process_ai` and `scrapeId` is missing:
  - Look up latest done scrape: `ScrapeRecordService.getLatestScrape(source, externalId, dataKind)`
  - If none exists: return `{ outcome: "reschedule" | "error", message: "No scrape html available" }`

**Effect Idioms**
- Use `Effect.gen`, `Effect.catchAll`, `Effect.mapError`, `Effect.annotateLogs`
- Avoid `Effect.runPromise` inside pipeline logic; keep it pure and let the HTTP/job layer run it

### Phase 2 — Make Kimovil Pipeline Real (M: 1–3h)

Replace stubs in `apps/scraper/src/sources/kimovil/specs-pipeline.ts` with actual handlers.

#### 2.1 Scrape Stage (Kimovil)

Add a function in `apps/scraper/src/services/kimovil/scrape-service.ts`:

```typescript
scrapeKimovilSpecsToHtmlAndRaw: (input: { slug: string; scrapeId: number }) =>
  Effect.Effect<{ html: string; raw: RawPhoneData }, ScrapeError, BrowserService | HtmlCacheService | ...>
```

Then the stage handler:
- `yield* ScrapeRecordService.startScrape(scrapeId)`
- Perform fetch/extract
- `yield* HtmlCacheService.saveHtmlByScrapeId(scrapeId, html)` (no conditional)
- Optionally save raw immediately or leave it to `process_raw`

**Important:** Stop using the current "legacy" caching check that bypasses saving. In pipeline mode the scrape stage should always guarantee "HTML exists for this scrapeId".

#### 2.2 process_raw Stage (Kimovil)

- Input: `scrapeId` (preferred); fallback: latest scrape lookup
- `html <- HtmlCacheService.getHtmlByScrapeId(scrapeId)`; if null → outcome "reschedule" or "error"
- Use existing extractor (`extractPhoneData`, `parseFromCachedHtml`)
- Save to `EntityDataService.saveRawData({ deviceId, source:"kimovil", dataKind:"specs", data })`

#### 2.3 process_ai Stage (Kimovil)

- Read raw record for `{deviceId, source, dataKind}`
- Normalize with AI service and store into `entity_data`
- If AI is optional/expensive, stage should return "skipped"/"done" outcomes based on config

### Phase 3 — Convert bulk-job.ts to Pipeline-Only (M: 1–3h)

**Goal:** bulk-job never calls scraping implementation directly.

#### 3.1 Replace the Branching

- Delete the legacy path that calls `scrapeFast` directly
- Instead:
  - Determine `source`, `dataKind`, `stage` from the queue item
  - Call `PipelineRunner.runStage(...)`

#### 3.2 Ensure Scrape Records Always Exist

- For stage `scrape`: runner creates the scrape record
- For other stages: runner resolves scrapeId (explicit from queue item or latest scrape)
- Update queue item schema if needed

#### 3.3 Maintain Client-Facing Events

- Keep emitting `ScrapeEvent`/`ScrapeResult` inside pipeline stage handlers for WebSocket progress

### Phase 4 — Fix Browser/Bright Data Session Reuse (M: 1–3h)

**Simple fix (recommended): make Kimovil scrape stage not use the pool**

In the Kimovil scrape stage, use:
```typescript
Effect.scoped(deps.browserService.createBrowserScoped() … newPage … close)
```

Leave the pool for other sources that benefit from reuse.

### Phase 5 — Migrate Other Sources (L: 1–2d)

For `yandex_market` and `price_ru`, implement `sources/<source>/<dataKind>-pipeline.ts` with the same contract:
- scrape stage saves HTML by `scrapeId`
- process_raw parses HTML and stores raw data
- process_ai normalizes

Common helper library:
- `pipeline/helpers/ensureScrapeId.ts`
- `pipeline/helpers/readHtml.ts`
- `pipeline/helpers/outcomes.ts`

### Phase 6 — Delete Legacy APIs (M: 1–3h)

- Deprecate `ScrapeService.scrapeFast` for internal pipeline use
- Remove dead commented-out pipeline registrations
- Add guardrail test: bulk-job must never call `scrapeFast` directly

---

## 4) Code Structure Recommendations

### Suggested Directories

```
apps/scraper/src/pipeline/
  registry.ts (keep)
  runner.ts (new)
  types.ts (optional: shared PipelineContext/result helpers)
  outcomes.ts (map errors to JobOutcome consistently)

apps/scraper/src/sources/<source>/
  <dataKind>-pipeline.ts (handlers only)

apps/scraper/src/services/<source>/
  <source>-scraper.ts (pipeline-friendly entrypoints that accept scrapeId)
```

### Recommended Type Tweaks

Current `PipelineContext` has `scrapeId: number | null`. Enforce non-null in scrape stage:

```typescript
type ScrapeCtx = PipelineContext & { scrapeId: number };
```

Runner upgrades the context before calling the handler.

### Error + Outcome Normalization

Create one place to map errors to queue outcomes:
- bot-block → retry w/ backoff
- validation error → retry or mark corrupted + error
- parse error → error (non-retry) unless HTML structure drift expected

---

## 5) Transition Plan

### Keep Compatibility While Switching

1. Land `PipelineRunner` + Kimovil handlers
2. Change bulk-job to use runner, keep old `scrapeFast` implementation intact
3. Run canary job (single slug list) and verify:
   - `scrapes` row created
   - `scrape_html` row exists for that `scrapeId`
   - raw data row exists
   - WS/UI still gets progress events

### Rollback Strategy

Keep temporary config flag in bulk-job:
- `PIPELINE_MODE=on|off`
- Even in "off", still create scrape records + save HTML (to stop data loss)

### Data Consistency During Migration

For items scraped via legacy path (no scrape rows), process_raw won't find HTML:
1. Let them be re-scraped (simplest)
2. Write one-off backfill (only if legacy HTML exists somewhere)

---

## 6) Risks and Guardrails

| Risk | Guardrail |
|------|-----------|
| Changing ScrapeService API ripples across packages | Don't change domain `ScrapeService` contract. Add pipeline-specific Kimovil function with `{slug, scrapeId}` |
| `process_raw` without scrapeId ambiguous | Define single behavior: use latest done scrape; if none → reschedule/error |
| Bright Data cost/performance regressions | Start with "no pooling for Kimovil", add per-source concurrency limits if needed |
| Partial pipeline registrations | Runner fails fast if handler missing, returns clear outcome/message |

---

## 7) When to Consider Advanced Path

Only revisit with more complexity if:
- You need "automatic dependency execution" (e.g., process_raw auto-runs scrape if missing)
- You need per-stage persistence keyed by `scrapeId` for audit/replay
- You need distributed workers and idempotency across machines

### Optional Advanced Path (Outline)

Introduce generic "pipeline state machine" with `scrape_stages` table for per-stage status per scrape, enabling:
- Independent retry without re-running other stages
- Generic `runUntil(stage)` for prerequisites
- Exact reproducibility for AI reprocessing

Not needed to fix current architectural issues.
