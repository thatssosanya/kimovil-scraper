# Click or Die Catalogue - Development Guide

## Commands
- Development: `npm run dev` or `bun dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Start: `npm run start`
- Postinstall: `drizzle-kit generate`

## Code Style Guidelines
- TypeScript strict mode with noUncheckedIndexedAccess enabled
- Use type imports with inline style: `import type { Type } from 'package'`
- Component naming: PascalCase for components and their files
- **Tailwind CSS v4** for styling with class-variance-authority for variants
- Consistent error handling with try/catch or React Query error states
- Prefer named exports over default exports
- Use React hooks for shared functionality
- Model state with Zustand stores
- Prefix unused variables with underscore (_)
- Use absolute imports with `@/` prefix for internal imports
- Follow React/Next.js best practices for SEO and performance

## Dark Mode Design System

### Color Palette
We use a minimal 3-4 color palette for dark mode:
- **Background**: `hsl(0 0% 7%)` - Near black #121212
- **Foreground**: `hsl(0 0% 85%)` - Light gray #d9d9d9 
- **Card/Elevated**: `hsl(0 0% 9%)` - Slightly lighter than bg #171717
- **Muted**: `hsl(0 0% 60%)` - Medium gray for secondary text
- **Borders**: `hsl(0 0% 20%)` - Very subtle borders
- **Primary**: `hsl(354 73% 56%)` - Brand red color

### Component Guidelines
1. **Backgrounds**:
   - Main background: `dark:bg-[hsl(0_0%_7%)]`
   - Elevated surfaces (cards, modals): `dark:bg-[hsl(0_0%_9%)]`
   - Hover states: `dark:hover:bg-gray-700/20` (very subtle)
   - Selected states: `dark:bg-gray-700/40` (slightly more prominent)

2. **Text Colors**:
   - Primary text: `dark:text-gray-200` or `dark:text-[hsl(0_0%_85%)]`
   - Secondary text: `dark:text-gray-500` or `dark:text-gray-600`
   - Hover text: `dark:hover:text-gray-200`

3. **Borders & Separators**:
   - Use sparingly, prefer spacing over borders
   - When needed: `dark:border-gray-800`
   - Dividers: Remove or make very subtle

4. **Interactive Elements**:
   - No CSS transitions (except height for collapse animations)
   - Instant feedback on hover/click
   - Subtle hover backgrounds: `dark:hover:bg-gray-800/50`
   - Active/selected: `dark:bg-gray-700/40`

5. **Special Elements**:
   - WIP indicators: Small yellow dot `bg-yellow-500/60 dark:bg-yellow-400/50`
   - Icons: Slightly dimmed `opacity-70` default, `opacity-100` when active

## Styling System - Tailwind CSS v4
The project uses **Tailwind CSS v4** with the new CSS-based configuration system:

### Configuration
- **Main config**: `src/styles/globals.css` using `@theme` blocks instead of JavaScript config
- **PostCSS**: Uses `@tailwindcss/postcss` plugin for Next.js compatibility
- **Typography**: `@plugin "@tailwindcss/typography"` for prose styling

### Key Features
- **CSS-based theming**: All colors, spacing, and custom values defined in CSS
- **Dynamic color system**: HSL-based colors with CSS variables for light/dark mode
- **Custom utilities**: Sidebar widths, extended max-widths, custom breakpoints
- **Gradient support**: Modern conic and radial gradient utilities
- **Arbitrary values**: Full support for `bg-[value]`, `w-[--css-var]` syntax

### Custom Theme Variables
- **Colors**: `--color-primary`, `--color-secondary`, `--color-sidebar-*` etc.
- **Sidebar**: `--width-sidebar` (16rem), `--width-sidebar-icon` (3rem)
- **Breakpoints**: `--breakpoint-xs` (24rem)
- **Max-widths**: `--max-width-8xl/9xl/10xl`

### Migration Notes
- Removed deprecated plugins: `tailwindcss-animate`, `@tailwindcss/line-clamp`
- All animations and utilities now built into v4
- Backward compatibility maintained through CSS variable mapping

## API Router Structure
The tRPC router has been refactored into the following logical modules:

1. **deviceRouter** - Core device management
   - Device CRUD operations
   - Device characteristics and specifications
   - Device images and metadata

2. **linkRouter** - Link management
   - Link CRUD operations
   - URL shortening and analysis
   - Partner link generation (moved from yandex-distribution)
   - Marketplace connections

3. **ratingRouter** - Rating system
   - Rating CRUD operations
   - Rating types and categories
   - Device position management in ratings

4. **configRouter** - Configuration management
   - Config CRUD operations
   - SKU and variant management
   - Global settings

5. **widgetRouter** - Widget system
   - Widget CRUD operations
   - Category and tag connections
   - Device connections to widgets

6. **scrapingRouter** - Data scraping
   - Kimovil data scraping
   - RabbitMQ queue management
   - Job status tracking

7. **searchRouter** - Search functionality
   - Device search
   - Relevant devices
   - Auto-complete suggestions

8. **utilsRouter** - Utility endpoints
   - Import/export operations (from parsing)
   - Revalidation endpoints
   - Health checks

## Files to Delete After Device Profile V2 Migration

### Current Device Profile Implementation (to be removed after v2 is complete):
- `src/pages/dashboard/devices/[deviceId].tsx` (current page file)
- `src/components/features/device/views/index.tsx` (current main view)
- `src/components/features/device/views/components/DeviceHeader.tsx`
- `src/components/features/device/views/components/DeviceDescription.tsx`
- `src/components/features/device/views/components/DeviceSpecifications/DeviceSpecifications.tsx`
- `src/components/features/device/views/components/DeviceSpecifications/Sections/` (entire folder)
- `src/components/features/device/views/components/DeviceSpecifications/components/` (entire folder)
- `src/components/features/device/views/components/EditableProsAndCons/` (entire folder)
- `src/components/features/device/views/components/LinksSection.tsx`
- `src/components/features/device/views/components/ImportSpecs.tsx`
- `src/components/features/device/views/components/ProsConsAdapter.tsx`
- `src/components/features/device/views/hooks/` (entire folder)
- `src/components/features/device/views/types/` (entire folder)

### Related Components (evaluate for deletion or migration):
- `src/components/Catalogue/Dialogs/EditDeviceDialogue.tsx` (may need to be updated for new system)
- Any other device-specific dialogs or forms that become redundant

**Note**: Keep these files until the new V2 implementation is fully tested and deployed to avoid breaking the current system.