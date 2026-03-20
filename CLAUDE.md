# CLAUDE.md — geebee-forge

## Project
- Astro 6 + Cloudflare Workers (migrated from SvelteKit → Pages → Workers)
- Deploy: push to `main` → GitHub Actions → `wrangler deploy` (Workers)
- Live: https://geebee-forge.pages.dev (legacy Pages URL — may need custom domain after Workers migration)
- Remote: `origin/main` (no `master` branch — don't create one)

## Stack
- Astro 6, TypeScript, Vitest
- Svelte 5 components as islands (`client:only="svelte"` / `client:load`)
- React integration available (`@astrojs/react`)
- Threlte (Three.js) for 3D pages (e.g. /unicorn-farm)
- Svelte 5 runes (`$state`, `$derived`, etc.)
- ViewTransitions for smooth navigation

## Architecture
- **Pages**: `src/pages/*.astro` — Astro pages with `.astro` file-based routing
- **Components**: `src/components/svelte/` — Svelte island components by feature
  - `constellation/` — Three.js star field
  - `unicorn-farm/` — Threlte 3D farm scene
  - `alerts/` — AlertsDashboard + AlertsMap (Chart.js, Leaflet)
  - `digest/` — DigestBrowser (tag filtering)
- **API routes**: `src/pages/api/alerts/*.ts` — Astro APIRoute endpoints
- **Layout**: `src/layouts/BaseLayout.astro` — shared HTML shell + global styles
- **Lib**: `src/lib/` — shared utils, server code, data files
- **Static**: `public/` (was `static/` in SvelteKit)

## Todoist
Track all work in the **🤖 Data Dev** project via the Todoist MCP tool (configured in your MCP servers).
- **Create a task when starting work** — before writing any code
- Comment on progress if multi-step
- **Complete the task when done** — after committing

## Three.js / Threlte Performance Rules
- **Share geometries**: create Shape/ExtrudeGeometry ONCE at module scope, reuse for all instances
- **Object pools for particles**: pre-allocate fixed arrays, toggle `active` flag — never splice/spread per frame
- **No per-frame allocations**: no `new Array()`, no spread `[...old, ...new]` in animation loops
- **Use `visible={false}`** to skip rendering inactive objects (cheaper than removing from DOM)
- **Cap particle counts**: set a max pool size, recycle oldest when full

## Unicorn Farm Specifics
- All components in `src/components/svelte/unicorn-farm/`
- Interactive elements: flowers (petal burst), rainbow (heart & star particles + wobble), well (bucket animation), hay bales (bounce), crystals (pulse + ring), brick walls (crumble + reassemble)
- Terrain is intentionally compact (~50x50) — farm is the focus, minimal surrounding terrain
- Camera: orthographic isometric with OrbitControls

## Alerts Dashboard
- Page: `/alerts` — wartime rocket alert dashboard using RedAlert API
- Upstream API: `https://redalert.orielhaim.com/api/stats/*` (auth via `REDALERT_API_KEY` Workers secret)
- Active alert types: `missiles`, `hostileAircraftIntrusion`, `terroristInfiltration` (exclude `newsFlash`, `endAlert`)
- **Shared normalization**: `src/lib/utils/city-names.ts` — `normalizeCity()` strips directional suffixes. Used by BOTH geocode endpoint AND AlertsMap component. ONE function, used everywhere — never duplicate this logic.
- **Static data files** (in `src/lib/data/`):
  - `israel-cities-coords.json` — 1,660 city geocode entries
  - `israel-city-boundaries.json` — 992 OSM boundary polygons (admin + residential landuse)
- **Caching**: `src/lib/server/redalert-cache.ts` — CF Cache API, 24h TTL for historical data, 5min for recent
- Map: Leaflet + CartoDB dark tiles, red pin markers + semi-transparent boundary polygons
- Geocode endpoint: GET (small requests) + POST (bulk) at `/api/alerts/geocode`
- **Env access**: `import { env } from 'cloudflare:workers'` (Astro v6 pattern)

## Conventions
- Commit messages: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Svelte components go in `src/components/svelte/<feature>/`
- API endpoints: `src/pages/api/` with `export const prerender = false;`
- Browser-only libs (Leaflet, Three.js, Threlte): use `client:only="svelte"` NOT `client:load`
- When adding interactivity: always `stopPropagation` on click handlers to avoid camera interference

## Workflow
- **Don't push untested changes** — verify in browser before pushing to prod
- **For multi-system features**: trace the full data flow first. Identify every point where names/IDs need to match. Ensure one normalization path.
- **Batch changes**: accumulate fixes into one solid commit instead of rapid-fire push-and-pray
- After feature work: run /review and /simplify
