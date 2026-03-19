# CLAUDE.md — geebee-forge

## Project
- SvelteKit + Cloudflare Pages
- Deploy: push to `main` → GitHub Actions → CF Pages
- Live: https://geebee-forge.pages.dev
- Remote: `origin/main` (no `master` branch — don't create one)

## Stack
- SvelteKit, TypeScript, Vitest
- Threlte (Three.js) for 3D pages (e.g. /unicorn-farm)
- Svelte 5 runes (`$state`, `$derived`, etc.)

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
- All components in `src/routes/unicorn-farm/`
- Interactive elements: flowers (petal burst), rainbow (heart & star particles + wobble), well (bucket animation), hay bales (bounce), crystals (pulse + ring), brick walls (crumble + reassemble)
- Terrain is intentionally compact (~50x50) — farm is the focus, minimal surrounding terrain
- Camera: orthographic isometric with OrbitControls

## Alerts Dashboard
- Page: `/alerts` — wartime rocket alert dashboard using RedAlert API
- Upstream API: `https://redalert.orielhaim.com/api/stats/*` (auth via `REDALERT_API_KEY` CF env)
- Active alert types: `missiles`, `hostileAircraftIntrusion`, `terroristInfiltration` (exclude `newsFlash`, `endAlert`)
- **Shared normalization**: `src/lib/utils/city-names.ts` — `normalizeCity()` strips directional suffixes. Used by BOTH geocode endpoint AND AlertsMap component. ONE function, used everywhere — never duplicate this logic.
- **Static data files** (in `src/lib/data/`):
  - `israel-cities-coords.json` — 1,660 city geocode entries
  - `israel-city-boundaries.json` — 992 OSM boundary polygons (admin + residential landuse)
- **Caching**: `src/lib/server/redalert-cache.ts` — CF Cache API, 24h TTL for historical data, 5min for recent
- Map: Leaflet + CartoDB dark tiles, red pin markers + semi-transparent boundary polygons
- Geocode endpoint: GET (small requests) + POST (bulk) at `/api/alerts/geocode`

## Conventions
- Commit messages: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Keep components in their route folder
- When adding interactivity: always `stopPropagation` on click handlers to avoid camera interference

## Workflow
- **Don't push untested changes** — verify in browser before pushing to prod
- **For multi-system features**: trace the full data flow first. Identify every point where names/IDs need to match. Ensure one normalization path.
- **Batch changes**: accumulate fixes into one solid commit instead of rapid-fire push-and-pray
- After feature work: run /review and /simplify
