# Development Guide

## Commands
- **Build**: `bun run build` (all apps) or `bun run build --filter=<app-name>`
- **Dev**: `bun run dev` (all apps) or `bun run dev --filter=ws-web` / `bun run dev --filter=scraper`
- **Lint**: `bun run lint`
- **Type Check**: `bun run check-types`
- **Format**: `bun run format` (Prettier on ts/tsx/md files)
- **Test**: `cd apps/scraper && bun test` (single test: `bun test <file>`)

## Running Locally
```bash
# Terminal 1 — Scraper backend (logs appear here)
cd apps/scraper && bun run dev

# Terminal 2 — Web UI
cd apps/ws-web && bun run dev
```
- Scraper WebSocket: `ws://localhost:1488/ws`
- Web UI: `http://localhost:5173`

## Architecture
- **Monorepo**: Turborepo with Bun (v1.2.0+), workspaces in `apps/*` and `packages/*`
- **Apps**: `scraper` (Elysia/Bun + Effect backend), `ws-web` (SolidJS + Vite + Tailwind v4 frontend)
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

## Web UI Features
- Real-time progress streaming via WebSocket
- Animated progress bar during AI processing (simulates 20%→95% over ~25s)
- Timing breakdown shown on completion (browser, scrape, AI, total)

## Code Style
- **TypeScript**: Strict mode, explicit types preferred
- **Imports**: Named imports from libraries (e.g., `import { createSignal } from "solid-js"`)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: Use Prettier (runs on save); ESLint for linting
- **Components**: SolidJS functional components with TypeScript; Tailwind for styling
