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
- **Apps**: `scraper` (Elysia + Node adapter + Effect backend), `ws-web` (SolidJS + Vite + Tailwind v4 frontend)
- **Packages**: `@repo/scraper-protocol` (Effect Schema msgs), `@repo/scraper-domain` (services), `@repo/typescript-config`
- **Stack**: TypeScript 5.9, Effect 3.x, ESLint v9, Prettier

## Scraper Services
- **SearchService**: Kimovil autocomplete API search
- **ScrapeService**: Full phone data scraping via Playwright + Bright Data (or local browser)
- **GeminiService**: Data normalization/translation using **gemini-3-flash-preview** (~25s per phone)
- **StorageService**: SQLite cache for raw HTML (`./scraper-cache.sqlite`)
- **BrowserService**: Playwright browser lifecycle

## Scraping Pipeline
1. **Browser** launches (local or Bright Data) — ~1-2s
2. **Navigate** to Kimovil phone page — ~1-2s  
3. **Extract** structured data from HTML (cameras, specs, SKUs) — instant
4. **Cache** raw HTML to SQLite — instant
5. **Normalize** via Gemini (translate to Russian, clean features) — **~25s with Gemini 3 Flash**
6. **Return** PhoneData to frontend

## Fast Scrape (No AI)
- Uses `scrapeFast` to fetch and save raw HTML only (no Gemini).
- Validates HTML before saving (bot placeholders and missing structure are rejected).

## Bulk Scraping
- **Endpoints**:
  - `POST /api/scrape/bulk` (starts a bulk job; `mode` must be `fast`)
  - `GET /api/scrape/bulk/:id` (job status + queue stats)
- **Queue**: job-scoped items in `scrape_queue` with retry/backoff fields.
- **Tables**: `bulk_jobs` + extended `scrape_queue` columns (attempt, max_attempts, next_attempt_at, job_id).
- **UI**: ws-web can trigger server-side bulk jobs and poll status.

## Gemini Integration
- **Model**: `gemini-3-flash-preview` via Vercel AI SDK (@ai-sdk/google)
- **Input**: Only fields needing AI processing (~500 tokens): displayFeatures, cameraFeatures, materials, colors, cpu, camera types
- **Output**: Translated/normalized JSON via structured output (generateObject)
- **Retries**: Exponential backoff (1s, 2s, 4s) on failure
- Uses Vercel AI SDK's `generateObject` with Zod schema for type-safe structured output

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
- **Format**: JSON stored as TEXT, parsed on read
- **Methods**: `savePhoneDataRaw`, `getPhoneDataRaw`, `hasPhoneDataRaw`, `getPhoneDataRawCount` (same for AI data)

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
- **Imports**: Named imports from libraries (e.g., `import { createSignal } from "solid-js"`)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: Use Prettier (runs on save); ESLint for linting
- **Components**: SolidJS functional components with TypeScript; Tailwind for styling
