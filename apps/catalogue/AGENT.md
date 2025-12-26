# Click or Die Catalogue - Agent Guide

## Commands
- **Dev**: `npm run dev` or `bun dev` (also `npm run td` for turbopack)
- **Build**: `npm run build` (includes sitemap generation)
- **Lint**: `npm run lint`
- **Start**: `npm run start`
- **Test**: `npm run test` (vitest)
- **DB Generate**: `npm run db:generate` (drizzle-kit generate)
- **DB Studio**: `npm run db:studio` (drizzle-kit studio)
- **Migrations**: `turso db shell <db-name> < drizzle/<migration-file>.sql`

## Database
- **Stage DB**: `palach-stage-12-25` (libsql://palach-stage-12-25-seenyat.aws-eu-west-1.turso.io)
- **Applied migrations**:
  - `0002_striped_annihilus.sql` (2024-12-17): Added `normalizedName`, `duplicateStatus`, `duplicateOfId` to Device table for duplicate detection

## Architecture
- **Framework**: Next.js 15.3.3 with TypeScript, React 19.2.3
- **Database**: SQLite with Drizzle ORM (LibSQL adapter)
- **API**: tRPC with routers: device, link, rating, config, widget, scraping, search, utils, dashboardWidgets
- **Auth**: Clerk authentication (@clerk/nextjs 6.36.3)
- **Styling**: Tailwind CSS v4 with CSS-based configuration in `src/styles/globals.css`
- **State**: Zustand stores, React Query for server state
- **File uploads**: Uppy with AWS S3
- **Scraper**: WebSocket connection to external scraper service (initialized in `src/instrumentation.ts`)

## Project Structure
```
src/
├── components/
│   ├── dashboard/       # Admin dashboard components
│   │   ├── layout/      # Admin layout (Layout, Sidebar, Header)
│   │   ├── device/      # Device management (DeviceTable, DeviceProfile, dialogs, hooks)
│   │   ├── rating/      # Rating management (components, dialogs, hooks, ratings-page)
│   │   ├── link/        # Link management components
│   │   ├── scraping/    # Scraper hooks (useScraper, useJobStatus)
│   │   ├── widgets/     # Dashboard widgets
│   │   └── common/      # Shared dashboard components (FilterBar, CatalogueTable)
│   ├── public/          # Public-facing components
│   │   ├── layout/      # Site layout (SiteHeader)
│   │   ├── device/      # Public device pages (DevicePage, BrandSection)
│   │   └── rating/      # Public rating components (RatingGroup, DeviceCard)
│   ├── shared/          # Shared across dashboard and public (Logo, DeviceImage, RatingBadge)
│   └── ui/              # shadcn primitives
├── hooks/               # Global hooks (useMobile, useDebounce, useCrossDomainTheme, etc.)
├── pages/               # Next.js pages
│   ├── api/             # API routes (trpc, wordpress, ext)
│   ├── dashboard/       # Admin dashboard pages
│   ├── devices/         # Public device pages
│   ├── ratings/         # Public ratings pages
│   └── rating/          # Single rating page
├── server/
│   ├── api/routers/     # tRPC routers
│   ├── db/              # Drizzle schema
│   ├── services/
│   │   ├── device-data/ # Device spec processing
│   │   ├── job-manager/ # Scraping job state management
│   │   ├── scraper-ws/  # WebSocket client for scraper
│   │   └── logger/      # Logging service
│   └── utils/           # Server-only utils (deviceUtils)
├── stores/              # Zustand stores (scraperStore, ratingStore, etc.)
├── types/               # TypeScript types
└── utils/               # Client utils (pluralize, cn, dateUtils, api, etc.)
```

## Code Style
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`
- **Imports**: Use `import type { Type }` inline style, absolute imports with `@/` prefix
- **Components**: PascalCase naming, prefer named exports over default
- **Hooks**: camelCase naming (`useSomething.ts`, not `use-something.ts`)
- **Styling**: Tailwind CSS v4 with class-variance-authority for variants
- **State**: Zustand for client state, React Query for server state
- **Unused vars**: Prefix with underscore (`_variable`)
- **Error handling**: Try/catch blocks or React Query error states

## Utils
- **Pluralization**: Use `pluralize()` and `PLURALS` from `@/src/utils/pluralize`
- **Class names**: Use `cn()` from `@/src/utils/cn` (or `@/src/lib/utils`)
- **Date formatting**: Use `getStartOfWeek()` from `@/src/utils/dateUtils`, `ruDateFormatter()` from `@/src/utils/utils`
- **Currency**: Use `rubleCurrencyFormatter()` from `@/src/utils/utils`

## Key Features
- **Duplicate Detection**: Devices have `normalizedName`, `duplicateStatus`, `duplicateOfId` fields
- **Scraping Workflow**: WebSocket-based, states: searching → selecting → scraping → done/error/slug_conflict
- **Slug Conflicts**: When scraper finds existing device with same slug, shows conflict UI

## Known Issues
- **Clerk/React 19 warning**: "useContext is not exported" warning during build is harmless (Clerk SDK issue)
- Use `bd` CLI for issue tracking (e.g., `bd list --status open`, `bd show <id>`). Do not read `.beads/issues.jsonl` directly.

## Naming Conventions
- **Dashboard device profile**: `DeviceProfile` at `dashboard/device/profile/`
- **Public device page**: `DevicePage` at `public/device/DevicePage.tsx`
- **Public site header**: `SiteHeader` at `public/layout/SiteHeader/`
