# CLAUDE.md — geebee-forge

## Project
- Astro 6 static site (CF Pages) + standalone CF Worker (alerts API)
- Deploy: push to `main` → GitHub Actions → `wrangler pages deploy` (site) + `wrangler deploy` (worker)
- Site: https://geebee-forge.pages.dev
- API: https://geebee-forge-api.gilad-bau.workers.dev
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
- **Worker**: `worker/` — standalone CF Worker for alerts API
  - `worker/src/index.ts` — fetch handler with URL routing
  - `worker/src/routes/` — one handler per API endpoint
  - `worker/src/lib/` — cache logic, CORS, city normalization
  - `worker/src/data/` — static geocode data (bundled into worker)
- **Layout**: `src/layouts/BaseLayout.astro` — shared HTML shell + global styles
- **Lib**: `src/lib/` — shared utils, data files (frontend only)
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
- **API lives in `worker/`** — standalone CF Worker proxying RedAlert upstream
- Upstream API: `https://redalert.orielhaim.com/api/stats/*` (auth via `REDALERT_API_KEY` Workers secret)
- Active alert types: `missiles`, `hostileAircraftIntrusion`, `terroristInfiltration` (exclude `newsFlash`, `endAlert`)
- **City normalization** exists in TWO copies (intentional — avoids monorepo complexity):
  - `src/lib/utils/city-names.ts` — used by AlertsMap.svelte (frontend)
  - `worker/src/lib/city-names.ts` — used by geocode route (worker)
- **Static data files**:
  - `src/lib/data/israel-city-boundaries.json` — 992 OSM boundary polygons (frontend only)
  - `worker/src/data/israel-cities-coords.json` — 1,660 city geocode entries (worker only)
- **Caching**: `worker/src/lib/redalert-cache.ts` — CF Cache API, 24h TTL for historical data, 5min for recent
- Map: Leaflet + CartoDB dark tiles, red pin markers + semi-transparent boundary polygons
- Geocode endpoint: GET (small requests) + POST (bulk) at `/api/alerts/geocode`
- **API URL**: `AlertsDashboard.svelte` uses `import.meta.env.PUBLIC_API_URL` to reach the worker (set at build time)
- **Local dev**: run `npm run dev` (Astro at :4321) + `cd worker && npx wrangler dev` (API at :8787)

## Conventions
- Commit messages: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Svelte components go in `src/components/svelte/<feature>/`
- Worker API routes go in `worker/src/routes/` — plain `(request, env) => Response` functions
- Browser-only libs (Leaflet, Three.js, Threlte): use `client:only="svelte"` NOT `client:load`
- When adding interactivity: always `stopPropagation` on click handlers to avoid camera interference

## Workflow
- **Don't push untested changes** — verify in browser before pushing to prod
- **For multi-system features**: trace the full data flow first. Identify every point where names/IDs need to match. Ensure one normalization path.
- **Batch changes**: accumulate fixes into one solid commit instead of rapid-fire push-and-pray
- After feature work: run /review and /simplify
