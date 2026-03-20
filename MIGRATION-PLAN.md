# Astro Migration Plan

## Summary
Migrate geebee-forge from SvelteKit to Astro 6 with @astrojs/cloudflare, keeping all existing Svelte components as islands. This enables dropping in React projects (like off-axis-sneaker) without rewriting.

## Phase 0: Validation (MUST PASS BEFORE PROCEEDING)
1. Create branch `feat/astro-migration`
2. Install astro, @astrojs/cloudflare, @astrojs/svelte, @astrojs/react alongside SvelteKit
3. Create minimal astro.config.mjs and test:
   - A simple Svelte 5 component with $state/$derived renders via client:only="svelte"
   - A minimal Threlte canvas renders via client:only="svelte"
   - cloudflare:workers env import works (or document workaround)
4. If any of these fail, STOP and report. Do not proceed.

## Phase 1: Scaffold
1. Create `astro.config.mjs`:
   - adapter: @astrojs/cloudflare
   - integrations: [svelte(), react()]
   - output: 'server'
   - vite config for Three.js SSR noExternal
2. Create `wrangler.jsonc` with compatibility settings
3. Create `src/layouts/BaseLayout.astro` from app.html + +layout.svelte (dark theme, global styles)
4. Create `src/env.d.ts`
5. Update tsconfig.json — add $lib path alias
6. Move static/ → public/
7. Update package.json scripts (dev/build/preview → astro commands)
8. Remove SvelteKit deps: @sveltejs/adapter-auto, @sveltejs/adapter-cloudflare, @sveltejs/kit
9. Keep: svelte, three, @threlte/*, leaflet, chart.js, etc.

## Phase 2: Landing Page
1. Create `src/pages/index.astro` — rewrite the 4 cards as static Astro markup (no JS needed)
2. Verify: renders at /, links work, dark theme correct

## Phase 3: Static Pages (Constellation + Unicorn Farm)
1. Move constellation component to `src/components/svelte/constellation/ConstellationCanvas.svelte`
2. Create `src/pages/constellation.astro` with `<ConstellationCanvas client:only="svelte" />`
3. Move ALL unicorn-farm components to `src/components/svelte/unicorn-farm/`
4. Create `src/pages/unicorn-farm.astro` with `<Scene client:only="svelte" />`
5. Fix import paths (no more relative from routes)

## Phase 4: API Endpoints
Port all 8 endpoints from SvelteKit RequestHandler to Astro APIRoute:
- `src/routes/api/alerts/X/+server.ts` → `src/pages/api/alerts/X.ts`
- Change: `{ url, platform }` → `{ request }` + `import { env } from 'cloudflare:workers'`
- Each file needs `export const prerender = false;`
- Port order: geocode → cities → summary → history → distribution → stats-cities → zone-summary → zone-distribution
- `src/lib/server/redalert-cache.ts`: keep parameterized design, callers change how they get apiKey
- `src/lib/utils/city-names.ts`: unchanged, just verify $lib alias works

## Phase 5: Alerts Dashboard
1. Extract alerts page body into `src/components/svelte/alerts/AlertsDashboard.svelte`
   - Keeps all $state, $derived, $effect, Chart.js, filter logic
   - Still calls /api/alerts/* via fetch() — no change in data flow
2. Move AlertsMap.svelte to `src/components/svelte/alerts/`
3. Create `src/pages/alerts.astro` with `<AlertsDashboard client:only="svelte" />`

## Phase 6: Digest Page
1. Create `src/pages/digest.astro` with import.meta.glob() in frontmatter
2. Extract interactive browser into `src/components/svelte/digest/DigestBrowser.svelte`
3. Pass loaded data as serialized prop with client:load

## Phase 7: Cleanup
1. Remove SvelteKit artifacts: svelte.config.js kit config, .svelte-kit/, old route files
2. Update .github/workflows/deploy.yml — output dir `dist/`
3. Update CI workflow — astro check
4. Update CLAUDE.md
5. Add ViewTransitions to BaseLayout for smooth page transitions
6. Verify tests still pass

## Key Rules
- Every API route needs `export const prerender = false;`
- Browser-only libs (Leaflet, Three.js, Threlte): use `client:only="svelte"` NOT `client:load`
- $lib alias must be configured in both tsconfig.json paths AND astro.config.mjs vite.resolve.alias
- Static JSON data files (israel-cities-coords.json, israel-city-boundaries.json) import the same way
- caches.default access pattern stays as-is (same Workers global)
- DO NOT commit or push until all phases complete and verified

## File Mapping Reference
| SvelteKit | Astro |
|---|---|
| src/routes/+layout.svelte | src/layouts/BaseLayout.astro |
| src/routes/+page.svelte | src/pages/index.astro |
| src/routes/constellation/+page.svelte | src/pages/constellation.astro + src/components/svelte/constellation/ |
| src/routes/unicorn-farm/+page.svelte | src/pages/unicorn-farm.astro + src/components/svelte/unicorn-farm/ |
| src/routes/alerts/+page.svelte | src/pages/alerts.astro + src/components/svelte/alerts/AlertsDashboard.svelte |
| src/routes/alerts/AlertsMap.svelte | src/components/svelte/alerts/AlertsMap.svelte |
| src/routes/digest/+page.svelte | src/pages/digest.astro + src/components/svelte/digest/DigestBrowser.svelte |
| src/routes/api/alerts/X/+server.ts | src/pages/api/alerts/X.ts |
| static/ | public/ |
| src/app.html | src/layouts/BaseLayout.astro |
| src/app.d.ts | src/env.d.ts |
