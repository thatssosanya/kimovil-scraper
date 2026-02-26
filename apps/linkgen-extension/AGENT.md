# LinkGen Chrome Extension - Agent Guide

## Build/Lint/Test Commands
- Run from monorepo root with npm workspaces.
- Build: `npm run build --workspace=apps/linkgen-extension`
- Build (Firefox): `npm run build:firefox --workspace=apps/linkgen-extension`
- Development: `npm run dev --workspace=apps/linkgen-extension`
- Tests: `npm run test --workspace=apps/linkgen-extension`
- Lint: `npm run lint --workspace=apps/linkgen-extension`
- Type check: `npm run check-types --workspace=apps/linkgen-extension`
- Format: `npm run prettier --workspace=apps/linkgen-extension`

## Architecture
Chrome Extension (Manifest V3) for affiliate link generation:
- **Background service worker** (src/pages/background/) - handles Chrome APIs
- **Sidepanel UI** (src/pages/sidepanel/) - React UI with components and hooks
- **LinkService** (src/services/) - core business logic for link generation
- **Shared utilities** (src/shared/) - URL parsers, API clients, Chrome storage wrappers
- **Yandex search links flow** - `LinkService.searchYandexLinks()` calls scraper REST endpoint `/api/extension/yandex/search-links` and sidepanel renders price+bonus results

## Environment
- `VITE_SCRAPER_API_URL` can override scraper REST base URL used by `LinkService`.
- Default fallback is `http://localhost:1488`.
- Host permissions for local/prod scraper must stay in `manifest.js`.

## Code Style
- TypeScript with strict config, React 18 with JSX transform
- ESLint + Prettier with Airbnb TypeScript rules
- Path aliases: @root, @src, @assets, @pages for imports
- Tailwind CSS via Twind preset for styling
- Test files: *.test.ts in __tests__ folders, using Vitest with jsdom
- Chrome extension globals available, webextension-polyfill for cross-browser support
