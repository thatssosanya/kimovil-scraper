# Development Guide

## Commands
- **Build**: `npm run build` (all apps) or `npm run build --filter=<app-name>`
- **Dev**: `npm run dev` (all apps) or `npm run dev --filter=ws-web` / `npm run dev --filter=scraper`
- **Lint**: `npm run lint`
- **Type Check**: `npm run check-types`
- **Format**: `npm run format` (Prettier on ts/tsx/md files)
- **Test**: `cd apps/scraper && npm test` (single test: `npm test -- <file>`)

## Production Deployment

Production server: `cod-prod` (130.193.45.37, user: cod, SSH alias: cod-prod)
API URL: https://api.click-or-die.ru

**Code changes (via git):**
```bash
git add -A && git commit -m "description" && git push
ssh cod-prod 'cd ~/apps/cod && git pull && pm2 restart scraper'
```

**Database sync (via rsync):**
```bash
# Sync SQLite database + journal files (WAL/SHM), then restart
rsync -avz apps/scraper/scraper-cache.sqlite apps/scraper/scraper-cache.sqlite-wal apps/scraper/scraper-cache.sqlite-shm cod-prod:~/apps/cod/apps/scraper/
ssh cod-prod 'cd ~/apps/cod && pm2 restart scraper'
```

### Analytics Deployment

Analytics URL: https://analytics.click-or-die.ru (port 1489 internally)

**First-time setup:**
```bash
ssh cod-prod 'cd ~/apps/cod && ./scripts/setup-analytics-prod.sh'
```

**Code changes:**
```bash
git add -A && git commit -m "description" && git push
ssh cod-prod 'cd ~/apps/cod && git pull && cd apps/analytics && npm run build:analytics && pm2 restart analytics'
```

**Components:**
- ClickHouse: Podman container on 127.0.0.1:8123 (never exposed publicly)
- Analytics service: PM2 managed, port 1489
- Nginx: Reverse proxy with rate limiting (10 req/s on /v1/events)

**Useful commands:**
```bash
# Check ClickHouse
ssh cod-prod 'curl http://localhost:8123/ping'
ssh cod-prod 'podman logs clickhouse'

# Check analytics service
ssh cod-prod 'pm2 logs analytics'
ssh cod-prod 'curl http://localhost:1489/health'

# Test with API key
curl -H 'Authorization: Bearer YOUR_API_KEY' 'https://analytics.click-or-die.ru/v1/stats/total?from=2025-01-01&to=2025-01-31'
```

## Running Locally
```bash
# Terminal 1 — Scraper backend (logs appear here)
cd apps/scraper && npm run dev

# Terminal 2 — Web UI
cd apps/ws-web && npm run dev
```
- Scraper WebSocket: `ws://localhost:1488/ws`
- Web UI: `http://localhost:5173`

## Debug Eval Tool (IMPORTANT)

**Always use this tool first when debugging app state, job issues, or service behavior.**

The `debug-eval` CLI lets you query live app state by executing JS code against the running Effect runtime. Located at `apps/scraper/scripts/debug-eval.ts`.

### Quick Commands
```bash
cd apps/scraper

# Get overall stats (devices, jobs, active count)
npx tsx scripts/debug-eval.ts stats

# List all jobs
npx tsx scripts/debug-eval.ts jobs

# Filter jobs by status
npx tsx scripts/debug-eval.ts jobs --status paused
npx tsx scripts/debug-eval.ts jobs --status running

# Get device count
npx tsx scripts/debug-eval.ts devices

# Get queue items for a specific job
npx tsx scripts/debug-eval.ts queue <jobId>

# Check cached HTML for a slug
npx tsx scripts/debug-eval.ts html <slug>
```

### Custom Queries
For arbitrary queries, pass raw JS code that returns a value:
```bash
# Count devices with raw entity data
npx tsx scripts/debug-eval.ts 'return await LiveRuntime.runPromise(EntityDataService.pipe(Effect.flatMap(s => s.getRawDataCount("kimovil", "specs"))))'

# Get error queue items
npx tsx scripts/debug-eval.ts 'return await LiveRuntime.runPromise(JobQueueService.pipe(Effect.flatMap(s => s.getErrorQueueItems())))'
```

### Using with jq
Pipe output to `jq` for filtering/formatting:
```bash
npx tsx scripts/debug-eval.ts jobs | jq '.result | length'
npx tsx scripts/debug-eval.ts jobs --status paused | jq '.result[0].id'
npx tsx scripts/debug-eval.ts stats | jq '.result'
```

### Available Services in Eval Context
- `Effect`, `LiveRuntime` — Effect runtime
- `JobQueueService` — Jobs and queue management
- `DeviceDiscoveryService` — Device discovery and prefix crawling
- `DeviceRegistryService` — Canonical device registry + source linking
- `HtmlCacheService` — HTML cache via scrapes + scrape_html
- `EntityDataService` — Raw + final entity data storage
- `ScrapeRecordService` — Scrape lifecycle tracking
- `PriceService` — Price quotes

### Options
- `--show-code` — Print generated code before running
- `--raw` — Output only the result (no `{success, result}` wrapper)

### HTTP Endpoint
The CLI wraps `POST /debug/eval` (dev-only, disabled in production):
```bash
curl -s -X POST http://localhost:1488/debug/eval \
  -H "Content-Type: application/json" \
  -d '{"code": "return 1 + 1"}' | jq
```

## Architecture
- **Monorepo**: Turborepo, workspaces in `apps/*` and `packages/*`
- **Apps**: `scraper` (Elysia + native http.Server + Effect backend), `ws-web` (SolidJS + Vite + Tailwind v4 frontend)
- **Packages**: `@repo/scraper-protocol` (Effect Schema msgs), `@repo/scraper-domain` (services + domain models), `@repo/typescript-config`
- **Stack**: TypeScript 5.9, Effect 3.x, @effect/sql, ESLint v9, Prettier

## Database Layer
- **@effect/sql**: All DB access via `SqlClient` from `apps/scraper/src/sql/`
- **Schema**: `apps/scraper/src/sql/schema.ts` — auto-migrates on startup
- **Quarantine**: Corrupted data goes to `quarantine` table instead of crashing
- **Tables**: `devices`, `device_sources`, `scrapes`, `scrape_html`, `scrape_verification`, `entity_data_raw`, `entity_data`, `jobs`, `job_queue`, `job_schedules`, `discovery_queue`, `price_quotes`, `price_summary`, `quarantine`
- **Multi-source ready**: All tables use `source` and `data_kind` columns for multi-source architecture

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
- **EntityDataService**: Raw + AI-normalized data storage with quarantine fallback
- **JobQueueService**: Job and queue item management with transactions and race guards
- **DeviceDiscoveryService**: Device discovery and prefix crawler state
- **DeviceRegistryService**: Canonical device registry + source linking
- **BrowserService**: Playwright browser lifecycle with `acquireRelease`

## Scraping Pipeline
1. **Browser** launches (local or Bright Data) — ~1-2s
2. **Navigate** to Kimovil phone page — ~1-2s  
3. **Extract** structured data from HTML (cameras, specs, SKUs) — instant
4. **Cache** raw HTML to `scrape_html` (keyed by scrape_id) — instant
5. **Normalize** via Gemini (translate to Russian, clean features) — **~25s with Gemini 3 Flash**
6. **Return** PhoneData to frontend

## Job Types
- `scrape`: Full scrape (HTML + raw extraction + AI normalization)
- `process_raw`: Extract raw data from cached HTML
- `process_ai`: Run AI normalization on raw data

## Scheduler

### Overview
The scheduler enables automated, recurring job execution using cron expressions. Jobs are stored in `job_schedules` table and processed by `SchedulerService`.

### Database Table: `job_schedules`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Human-readable schedule name |
| `source` | TEXT | Data source (kimovil, yandex_market, etc.) |
| `data_kind` | TEXT | Data type (specs, prices) |
| `cron_expression` | TEXT | Standard 5-field cron expression |
| `job_type` | TEXT | scrape, process_raw, process_ai |
| `mode` | TEXT | fast, full (optional) |
| `enabled` | INTEGER | 0=disabled, 1=enabled |
| `next_run_at` | TEXT | ISO timestamp for next execution |
| `last_run_at` | TEXT | ISO timestamp of last execution |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Last update timestamp |

### SchedulerService
- **Tick loop**: Runs every 60 seconds via `Effect.repeat(Schedule.fixed("60 seconds"))`
- **Due check**: Queries schedules where `enabled=1 AND next_run_at <= NOW()`
- **Execution**: Creates a job via `JobQueueService`, populates queue items
- **Next run**: Calculates next execution from cron expression after job starts

### Crash Recovery
On startup, the scheduler:
1. Finds enabled schedules with `next_run_at` in the past
2. Triggers them immediately (catch-up)
3. Recalculates `next_run_at` for future runs

### Cron Expression Format
Standard 5-field cron (minute-level granularity):
```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 0 * * *` — Daily at midnight
- `0 */6 * * *` — Every 6 hours
- `30 2 * * 1` — Mondays at 2:30 AM
- `0 9 1 * *` — 1st of each month at 9 AM

## Scheduler API

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/schedules` | List all schedules |
| GET | `/api/schedules/:id` | Get schedule details |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/:id` | Update schedule |
| DELETE | `/api/schedules/:id` | Delete schedule |
| POST | `/api/schedules/:id/enable` | Enable (sets next_run_at) |
| POST | `/api/schedules/:id/disable` | Disable schedule |
| POST | `/api/schedules/:id/trigger` | Manual trigger (runs immediately) |

### Example: Create and Enable a Schedule
```bash
# Create a daily price update schedule for Yandex
curl -X POST http://localhost:1488/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Yandex Prices",
    "source": "yandex_market",
    "dataKind": "prices",
    "cronExpression": "0 0 * * *",
    "jobType": "scrape",
    "mode": "fast"
  }'

# Enable the schedule
curl -X POST http://localhost:1488/api/schedules/1/enable

# Check schedule status
curl http://localhost:1488/api/schedules/1 | jq
```

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
- `GET /api/phone-data/raw/:slug` — Raw extracted data (before AI) via EntityDataService
- `GET /api/phone-data/:slug` — AI-processed/normalized data via EntityDataService
- `GET /api/scrape/status?slugs=...` — Returns `hasHtml`, `hasRawData`, `hasAiData`, corruption status
- Stats endpoint includes `rawData` and `aiData` counts

## Phone Data Storage
- **Tables**: `entity_data_raw` (extracted), `entity_data` (AI-normalized)
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
- **SQL**: Use `@effect/sql` template literals, wrap multi-step ops in transactions
- **Imports**: Named imports from libraries (e.g., `import { createSignal } from "solid-js"`)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: Use Prettier (runs on save); ESLint for linting
- **Components**: SolidJS functional components with TypeScript; Tailwind for styling

## Error Handling

### Core Principles
1. **Never silently swallow errors** — always log before recovering
2. **Include `cause` when wrapping errors** — preserves stack traces
3. **Use typed errors** — each service has its own error class with `_tag`

### Effect Error Patterns

**Recoverable fallback with logging:**
```typescript
yield* someOperation().pipe(
  Effect.catchAll((error) =>
    Effect.logWarning("Operation failed").pipe(
      Effect.annotateLogs({ slug, error }),
      Effect.map(() => fallbackValue),
    ),
  ),
);
```

**Fire-and-forget with logging (no fallback needed):**
```typescript
yield* saveToCache(data).pipe(
  Effect.catchAll((error) =>
    Effect.logWarning("Cache save failed").pipe(
      Effect.annotateLogs({ slug, error }),
    ),
  ),
);
```

**Wrapping errors with cause:**
```typescript
class MyServiceError extends Data.TaggedError("MyServiceError")<{
  message: string;
  cause?: unknown;
}> {}

const mapError = (e: unknown) =>
  new MyServiceError({
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });

someOperation().pipe(Effect.mapError(mapError));
```

**Top-level error handlers must log:**
```typescript
Effect.catchAll((error) =>
  Effect.gen(function* () {
    log.error("Handler", `${errorCode}: ${error.message}`, error);
    // Then send error response to client
  }),
);
```

### Log Levels
- `Effect.logError` / `log.error` — Unexpected failures, bugs, unrecoverable errors
- `Effect.logWarning` / `log.warn` — Recoverable failures, fallbacks triggered
- `Effect.logInfo` / `log.info` — Normal operations, progress updates

### Annotations
Use `Effect.annotateLogs` with structured fields (stable message + error object):
```typescript
Effect.logWarning("Entity sync failed").pipe(
  Effect.annotateLogs({ slug, deviceId, error }),
);
```

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

## Database File
- **SQLite file**: `apps/scraper/scraper-cache.sqlite` (not `scraper.db`)

## Bright Data CDP Constraints
- **Kimovil requires Bright Data**: The site has bot protection that blocks local browsers. Always use Bright Data for Kimovil scraping.
- **Per-session navigation limit**: Bright Data CDP sessions have a low navigation limit (~1-2 page.goto calls per session)
- **Session isolation**: Add `?session=<unique-id>` to `BRD_WSENDPOINT` for each CDP connection to get fresh session quotas
- **Never share sessions**: Each browser connection that needs multiple navigations must use its own unique session ID

## Known Limitations (Future Work)
- **Postgres**: SQLite-specific SQL (PRAGMA, INSERT OR REPLACE, last_insert_rowid) needs conversion
