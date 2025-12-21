# Development Guide

## Commands
- **Build**: `npm run build` (all apps) or `npm run build --filter=<app-name>`
- **Dev**: `npm run dev` (all apps) or `npm run dev --filter=ws-web` / `npm run dev --filter=scraper`
- **Lint**: `npm run lint`
- **Type Check**: `npm run check-types`
- **Format**: `npm run format` (Prettier on ts/tsx/md files)
- **Test**: `cd apps/scraper && bun test` (single test: `bun test <file>`)

## Running Locally
```bash
# Terminal 1 — Scraper backend (logs appear here)
cd apps/scraper && npm run dev

# Terminal 2 — Web UI
cd apps/ws-web && npm run dev
```
- Scraper WebSocket: `ws://localhost:1488/ws`
- Web UI: `http://localhost:5173`

## Architecture
- **Monorepo**: Turborepo, workspaces in `apps/*` and `packages/*`
- **Apps**: `scraper` (Elysia + native http.Server + Effect backend), `ws-web` (SolidJS + Vite + Tailwind v4 frontend)
- **Packages**: `@repo/scraper-protocol` (Effect Schema msgs), `@repo/scraper-domain` (services + domain models), `@repo/typescript-config`
- **Stack**: TypeScript 5.9, Effect 3.x, @effect/sql, ESLint v9, Prettier

## Database Layer
- **@effect/sql**: All DB access via `SqlClient` from `apps/scraper/src/sql/`
- **Schema**: `apps/scraper/src/sql/schema.ts` — auto-migrates on startup
- **Quarantine**: Corrupted data goes to `quarantine` table instead of crashing
- **Tables**: `jobs`, `job_queue`, `raw_html`, `scrape_verification`, `phone_data_raw`, `phone_data`, `kimovil_devices`, `kimovil_prefix_state`
- **Multi-source ready**: `raw_html` and `scrape_verification` support `source` column (default: `"kimovil"`)

## Effect Patterns
- **ManagedRuntime**: `LiveRuntime` in `apps/scraper/src/layers/live.ts` — memoized, single instance
- **Layer composition**: Services composed via `Layer.provide()` / `Layer.mergeAll()`
- **Typed errors**: Each service has its own error class with `cause` for stack preservation
- **Resource safety**: Browser uses `Effect.acquireRelease` for cleanup on errors
- **Transactions**: Multi-step DB ops wrapped in `sql.withTransaction()`

## Scraper Services
- **SearchService**: Kimovil autocomplete API search
- **ScrapeService**: Full phone data scraping via Playwright + Bright Data (or local browser)
- **OpenAIService**: Data normalization/translation using **gemini-3-flash-preview** (~25s per phone)
- **HtmlCacheService**: SQLite cache for raw HTML with verification status
- **PhoneDataService**: Raw + AI-normalized phone data storage with quarantine fallback
- **JobQueueService**: Job and queue item management with transactions and race guards
- **DeviceService**: Kimovil device registry and prefix crawler state
- **BrowserService**: Playwright browser lifecycle with `acquireRelease`

## Scraping Pipeline
1. **Browser** launches (local or Bright Data) — ~1-2s
2. **Navigate** to Kimovil phone page — ~1-2s  
3. **Extract** structured data from HTML (cameras, specs, SKUs) — instant
4. **Cache** raw HTML to SQLite — instant
5. **Normalize** via Gemini (translate to Russian, clean features) — **~25s with Gemini 3 Flash**
6. **Return** PhoneData to frontend

## Job Types
- `scrape`: Full scrape (HTML + raw extraction + AI normalization)
- `process_raw`: Extract raw data from cached HTML
- `process_ai`: Run AI normalization on raw data

## Fast Scrape (No AI)
- Uses `scrapeFast` to fetch and save raw HTML only (no Gemini).
- Validates HTML before saving (bot placeholders and missing structure are rejected).

## Bulk Scraping
- **WebSocket methods**: `bulk.start`, `bulk.subscribe`, `bulk.pause`, `bulk.resume`, `bulk.setWorkers`
- **Queue**: job-scoped items in `job_queue` with retry/backoff fields
- **Tables**: `jobs` (job metadata) + `job_queue` (individual items with attempt tracking)
- **Max attempts**: Enforced in `rescheduleQueueItem` — items marked `error` when exhausted
- **Race guards**: `claimNextQueueItem` uses transactions + `changes()` check

## Gemini Integration
- **Model**: `gemini-3-flash-preview` via Vercel AI SDK (@ai-sdk/google)
- **Input**: Only fields needing AI processing (~500 tokens): displayFeatures, cameraFeatures, materials, colors, cpu, camera types
- **Output**: Translated/normalized JSON via structured output (generateObject)
- **Retries**: Exponential backoff (1s, 2s, 4s) on failure

## Environment Variables (scraper)
Create `apps/scraper/.env`:
```
GOOGLE_API_KEY=...
LOCAL_PLAYWRIGHT=true
BRD_WSENDPOINT=wss://...  # Optional: Bright Data endpoint
BULK_CONCURRENCY=2
BULK_RATE_LIMIT_MS=1500
BULK_RETRY_BASE_MS=2000
BULK_RETRY_MAX_MS=900000
```

## Phone Data API
- `GET /api/phone-data/raw/:slug` — Raw extracted data (before AI)
- `GET /api/phone-data/:slug` — AI-processed/normalized data
- `GET /api/scrape/status?slugs=...` — Returns `hasHtml`, `hasRawData`, `hasAiData`, corruption status
- Stats endpoint includes `rawData` and `aiData` counts

## Phone Data Storage
- **Tables**: `phone_data_raw` (extracted), `phone_data` (AI-normalized)
- **Format**: JSON stored as TEXT, decoded via Effect Schema on read
- **Quarantine**: Malformed JSON or schema failures quarantined instead of throwing

## WebSocket Server
- **Implementation**: Native `ws` package attached to http.Server (not Elysia adapter)
- **Reason**: Elysia's node adapter conflicts with ws upgrade handling
- **Path**: `/ws` on port 1488

## Web UI Features
- Real-time progress streaming via WebSocket
- Animated progress bar during AI processing (simulates 20%→95% over ~25s)
- Timing breakdown shown on completion (browser, scrape, AI, total)

## Phone Data Modal (PhoneDataModal.tsx)
- **Tabs**: HTML | Raw Data | AI Data | Compare (side-by-side)
- **Lazy loading**: Data fetched only when tab clicked, cached in signals
- **JsonViewer**: Shiki syntax highlighting (`github-dark` theme), copy button
- **TabBar**: Color-coded tabs with availability dots (gray=missing, colored=available)

## DevicesTable
- **Columns**: Checkbox | Device (name+slug) | Brand | Data | Queue | Actions
- **DataStatusIcons**: HTML (slate), Raw (cyan), AI (violet), Verified (green/red)
- **Dense layout**: Reduced padding, smaller fonts, hover-reveal actions

## StatsPanel
- 6 stat cards: Devices, HTML, Raw Data, AI Data, Valid, Corrupted
- **Clickable filters**: Each card filters the table (all, scraped, has_raw, has_ai, valid, corrupted)
- Active filter shows ring highlight and glow effect
- Responsive grid: 2 cols → 3 cols → 6 cols

## DevicesTable Limit Selector
- Dropdown button to control table limit: 10, 100, 500, 1000, 10000
- Amber color when filtered count exceeds limit
- Backend `/api/slugs?limit=N` supports dynamic limits (max 10000)

## Code Style
- **TypeScript**: Strict mode, explicit types preferred
- **Effect**: Use `Effect.gen` with `yield*`, typed errors, Layer composition
- **Errors**: Always include `cause` when wrapping errors
- **SQL**: Use `@effect/sql` template literals, wrap multi-step ops in transactions
- **Imports**: Named imports from libraries (e.g., `import { createSignal } from "solid-js"`)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: Use Prettier (runs on save); ESLint for linting
- **Components**: SolidJS functional components with TypeScript; Tailwind for styling

## Multi-Source Architecture

### Core Concepts
- **Device**: Canonical device registry (source-agnostic)
- **DeviceSource**: Links devices to external sources (kimovil, gsmarena, etc.)
- **Scrape**: Individual scrape attempts with lifecycle tracking
- **EntityData**: Source-specific raw data + normalized final data
- **Pipeline**: (source, dataKind) → stage handlers

### Tables
| Table | Purpose |
|-------|---------|
| `devices` | Canonical device registry |
| `device_sources` | Links to external sources |
| `scrapes` | Scrape attempt tracking |
| `entity_data_raw` | Source-specific extracted data |
| `entity_data` | Normalized/merged data |
| `price_quotes` | Price data (multi-row per device) |

### Services
| Service | Responsibility |
|---------|---------------|
| `DeviceRegistryService` | Device + source link management |
| `EntityDataService` | Raw + final data storage |
| `ScrapeRecordService` | Scrape lifecycle |
| `JobQueueService` | Extended with source/dataKind |

### Pipeline Registry
Register pipelines in `src/sources/{source}/specs-pipeline.ts`:
```typescript
registerPipeline({
  source: "kimovil",
  dataKind: "specs",
  stages: {
    scrape: scrapeHandler,
    process_raw: processRawHandler,
    process_ai: processAiHandler,
  },
});
```

### Adding a New Source
1. Create `src/sources/{source}/` folder
2. Implement stage handlers for each pipeline stage
3. Register pipeline in `specs-pipeline.ts` (or similar)
4. Import in `src/sources/{source}/index.ts`
5. The import in `layers/live.ts` triggers registration

## Known Limitations (Future Work)
- **Postgres**: SQLite-specific SQL (PRAGMA, INSERT OR REPLACE, last_insert_rowid) needs conversion
- **Scheduled jobs**: No cron/scheduler; jobs are manually triggered
- **Pipe-delimited fields**: Some domain fields still use `|`-separated strings instead of arrays
