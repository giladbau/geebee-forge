# Migration Plan: CF Worker → CF Pages (Static) + Standalone Worker

## Current Architecture

```
┌─────────────────────────────────────┐
│ Single Cloudflare Worker            │
│ (Astro output: "server")            │
│ geebee-forge.gilad-bau.workers.dev  │
│                                     │
│ ├── / (index)        ← SSR         │
│ ├── /constellation   ← SSR         │
│ ├── /unicorn-farm    ← SSR         │
│ ├── /digest          ← SSR         │
│ ├── /alerts          ← SSR         │
│ └── /api/alerts/*    ← API routes  │
│     (REDALERT_API_KEY secret)       │
└─────────────────────────────────────┘
```

Everything ships as a single Worker via `wrangler deploy --config dist/server/wrangler.json`. Static pages are server-rendered unnecessarily — only the alerts API routes actually need a runtime.

## Target Architecture

```
┌──────────────────────────┐     ┌─────────────────────────────┐
│ Cloudflare Pages         │     │ Cloudflare Worker            │
│ (static HTML/CSS/JS)     │     │ (alerts API only)            │
│ geebee-forge.pages.dev   │     │ geebee-forge-api.*.workers.dev│
│                          │     │                               │
│ ├── / (index)            │     │ ├── /api/alerts/summary       │
│ ├── /constellation       │     │ ├── /api/alerts/history       │
│ ├── /unicorn-farm        │ ──→ │ ├── /api/alerts/distribution  │
│ ├── /digest              │     │ ├── /api/alerts/cities        │
│ └── /alerts              │     │ ├── /api/alerts/stats-cities  │
│     (Svelte islands      │     │ ├── /api/alerts/geocode       │
│      fetch from worker)  │     │ ├── /api/alerts/zone-summary  │
│                          │     │ └── /api/alerts/zone-dist...  │
│                          │     │                               │
│                          │     │ Secrets: REDALERT_API_KEY      │
│                          │     │ Uses: CF Cache API             │
└──────────────────────────┘     └─────────────────────────────┘
```

Reference architecture: `/tmp/argus` (SvelteKit static + standalone Worker).

---

## 1. Astro Config Changes

### Current (`astro.config.mjs`)
```js
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  // ...
});
```

### Target
```js
export default defineConfig({
  output: 'static',
  // No adapter — Astro generates plain HTML/CSS/JS into dist/
  integrations: [svelte(), react()],
  vite: {
    ssr: {
      noExternal: ['three']
    },
    resolve: {
      alias: { '$lib': '/src/lib' }
    },
    server: {
      allowedHosts: true
    }
  }
});
```

### Changes Required
- Remove `@astrojs/cloudflare` adapter (remove import + `adapter:` key)
- Change `output: 'server'` → `output: 'static'`
- Keep all Vite config (Three.js SSR exclusion still needed for build, Svelte/React integrations unchanged)
- The `ssr.noExternal: ['three']` stays — Astro still needs it during the static build phase for `client:only` components

### Package Changes
- Remove `@astrojs/cloudflare` from `devDependencies`
- Remove root `wrangler.jsonc` (no longer used by Astro)

### Page Changes
- Remove all `export const prerender = false;` statements from API route files (they get deleted entirely)
- Delete `src/pages/api/` directory (routes move to standalone worker)
- The digest page's `import.meta.glob()` for JSON files works fine with static output — no changes needed
- All Svelte `client:only="svelte"` islands remain unchanged

### Build Output
- Currently: `dist/server/` (Worker bundle + wrangler.json)
- After: `dist/` (static HTML/CSS/JS, ready for `wrangler pages deploy`)

---

## 2. Extracting the Alerts API into a Standalone Worker

### New Directory: `worker/`

```
worker/
├── src/
│   ├── index.ts              # Main Worker entry (fetch handler + routing)
│   ├── routes/
│   │   ├── summary.ts        # /api/alerts/summary
│   │   ├── history.ts        # /api/alerts/history
│   │   ├── distribution.ts   # /api/alerts/distribution
│   │   ├── cities.ts         # /api/alerts/cities
│   │   ├── stats-cities.ts   # /api/alerts/stats-cities
│   │   ├── geocode.ts        # /api/alerts/geocode
│   │   ├── zone-summary.ts   # /api/alerts/zone-summary
│   │   └── zone-distribution.ts  # /api/alerts/zone-distribution
│   ├── lib/
│   │   ├── redalert-cache.ts # fetchAllHistory, getCacheTTL, fetchFromUpstream
│   │   ├── city-names.ts     # normalizeCity() — COPIED from src/lib/utils/
│   │   └── cors.ts           # CORS helpers
│   ├── data/
│   │   └── israel-cities-coords.json  # Static geocode data (bundled into worker)
│   └── index.test.ts         # Worker integration tests
├── wrangler.toml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Worker Entry (`worker/src/index.ts`)

Pattern from argus reference — single `fetch` handler with URL routing:

```ts
import { handleSummary } from './routes/summary';
import { handleHistory } from './routes/history';
// ... other route imports
import { corsHeaders, addCorsHeaders } from './lib/cors';

export interface Env {
  REDALERT_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      let response: Response;

      switch (url.pathname) {
        case '/api/alerts/summary':
          response = await handleSummary(request, env);
          break;
        case '/api/alerts/history':
          response = await handleHistory(request, env);
          break;
        // ... all routes
        default:
          response = new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }

      return addCorsHeaders(response, origin);
    } catch (err) {
      console.error('Worker error:', err);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }),
        origin
      );
    }
  }
};
```

### CORS (`worker/src/lib/cors.ts`)

Required because the static site (geebee-forge.pages.dev) makes cross-origin requests to the worker (geebee-forge-api.*.workers.dev):

```ts
export function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
```

### Route Migration

Each Astro APIRoute becomes a plain function that takes `(request: Request, env: Env)`:

| Current (Astro)                                 | Target (Worker)                               |
|------------------------------------------------|-----------------------------------------------|
| `import { env } from 'cloudflare:workers'`     | `env` param passed from fetch handler         |
| `export const GET: APIRoute = async ({ request }) => { ... }` | `export async function handleFoo(request: Request, env: Env): Promise<Response> { ... }` |
| `import { getCacheTTL } from '$lib/server/...'`| `import { getCacheTTL } from '../lib/redalert-cache'` |

Most routes are simple upstream proxy + cache header — minimal rewrite needed. The complex routes (`zone-summary`, `zone-distribution`) use `fetchAllHistory` which ports directly.

### Shared Code: `normalizeCity()`

This function is used in TWO places:
1. **Worker**: `geocode.ts` route (import from `worker/src/lib/city-names.ts`)
2. **Frontend**: `AlertsMap.svelte` component (import from `src/lib/utils/city-names.ts`)

**Decision: duplicate the 6-line function.** It's trivial and avoids monorepo package sharing complexity. Keep both copies. Add a comment in each pointing to the other copy.

### Static Data: `israel-cities-coords.json`

Currently imported by the geocode endpoint at `src/lib/data/israel-cities-coords.json` (1,660 entries, ~100KB).

**Decision:** Copy to `worker/src/data/israel-cities-coords.json`. The worker bundler (wrangler) will inline it. The frontend doesn't need this file (only the AlertsMap boundary data stays in `src/lib/data/`).

Note: `israel-city-boundaries.json` stays in `src/lib/data/` — it's only used by the frontend AlertsMap component, not the API.

### Existing Tests

`src/lib/server/redalert-cache.test.ts` (298 lines, 12 test suites) moves to `worker/src/lib/redalert-cache.test.ts`. The tests mock `fetch` and `caches` — they'll work identically in the worker test environment.

### Wrangler Config (`worker/wrangler.toml`)

```toml
name = "geebee-forge-api"
main = "src/index.ts"
compatibility_date = "2025-03-14"
compatibility_flags = ["nodejs_compat"]

[env.preview]
name = "geebee-forge-api-preview"
```

- No KV namespaces needed (alerts API uses CF Cache API, not KV)
- `REDALERT_API_KEY` set as a secret via CI (never in TOML)
- `[env.preview]` for isolated preview worker
- `nodejs_compat` flag carried over from current config

### Worker Package (`worker/package.json`)

```json
{
  "name": "geebee-forge-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev"
  },
  "devDependencies": {
    "vitest": "^4.0.0",
    "wrangler": "^4.0.0",
    "typescript": "^5.9.0"
  }
}
```

---

## 3. Frontend: API URL Configuration

### The Problem

Currently, `AlertsDashboard.svelte` calls relative URLs:
```ts
fetchJSON(`/api/alerts/zone-summary?${params}`)
fetchJSON(`/api/alerts/cities?limit=500&offset=${offset}`)
```

After the split, these need to go to the standalone worker at a different origin.

### Solution: Build-time Environment Variable

**Astro approach** (equivalent to argus's `VITE_API_URL`):

In `AlertsDashboard.svelte`, change fetch calls to use a configurable base URL:

```ts
const API_BASE = import.meta.env.PUBLIC_API_URL || '';

async function fetchJSON(path: string, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}${path}`, signal ? { signal } : undefined);
  // ...
}
```

Astro exposes `PUBLIC_*` env vars to client-side code (equivalent to Vite's `VITE_*`).

**Build-time values:**
- **Production:** `PUBLIC_API_URL=https://geebee-forge-api.gilad-bau.workers.dev`
- **Preview:** `PUBLIC_API_URL=https://geebee-forge-api-preview.gilad-bau.workers.dev`
- **Local dev:** `PUBLIC_API_URL=http://localhost:8787` (or empty string if proxying)

Set in CI via `env:` on the build step (same pattern as argus).

### Local Dev Workflow

Two terminal approach:
1. `npm run dev` — Astro dev server (static site at localhost:4321)
2. `cd worker && npx wrangler dev` — Worker dev server (API at localhost:8787)

Create a `.env.development` (gitignored) with:
```
PUBLIC_API_URL=http://localhost:8787
```

---

## 4. New `deploy.yml` (Production)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test
      - run: cd worker && npm ci && npm test

  deploy-app:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
        env:
          PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL }}
      - name: Deploy to CF Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name geebee-forge

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy
      - name: Set worker secrets
        run: |
          jq -n --arg key "$REDALERT_API_KEY" '{"REDALERT_API_KEY": $key}' \
            | npx wrangler secret bulk
        working-directory: worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          REDALERT_API_KEY: ${{ secrets.REDALERT_API_KEY }}
```

### Key Differences from Current
- **Tests gate deployment** — both app and worker tests must pass before deploy
- **Two parallel deploy jobs** after tests pass (independent, no ordering dependency)
- **Pages deploy** uses `wrangler pages deploy dist` (not worker deploy)
- **Worker deploy** from `worker/` subdirectory
- **New secret:** `PUBLIC_API_URL` in GitHub secrets (production worker URL)

---

## 5. New `preview.yml` (PR Previews)

```yaml
name: Preview Deploy

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, closed]

jobs:
  test:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test
      - run: cd worker && npm ci && npm test

  deploy-preview-worker:
    needs: test
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Deploy preview worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy --env preview
      - name: Set preview worker secrets
        run: |
          jq -n --arg key "$REDALERT_API_KEY" '{"REDALERT_API_KEY": $key}' \
            | npx wrangler secret bulk --env preview
        working-directory: worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          REDALERT_API_KEY: ${{ secrets.REDALERT_API_KEY }}

  deploy-preview:
    needs: [test, deploy-preview-worker]
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
        env:
          PUBLIC_API_URL: https://geebee-forge-api-preview.gilad-bau.workers.dev
      - name: Deploy preview
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name geebee-forge --branch pr-${{ github.event.number }}
      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            const marker = '<!-- preview-url -->';
            const body = [
              marker,
              `### Preview Deploy`,
              ``,
              `Site: https://pr-${{ github.event.number }}.geebee-forge.pages.dev`,
              `API: https://geebee-forge-api-preview.gilad-bau.workers.dev`,
              `Commit: \`${context.sha.slice(0, 7)}\``,
            ].join('\n');

            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: ${{ github.event.number }},
            });
            const existing = comments.find(c => c.body.includes(marker));

            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: ${{ github.event.number }},
                body,
              });
            }

  cleanup-preview-worker:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Delete preview worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: delete --name geebee-forge-api-preview --force
```

### Key Design Decisions
- **Worker deploys before Pages** — Pages build needs the preview worker URL baked in at build time
- **Single preview worker** (`geebee-forge-api-preview`) — reused across PRs (simpler than per-PR workers)
- **Per-PR Pages branch** (`pr-<number>.geebee-forge.pages.dev`) — CF Pages handles this natively
- **Cleanup only deletes worker** — CF Pages branch previews are automatically cleaned up

### Delete `ci.yml`

The current `ci.yml` only runs `npm run build` on PRs. After migration, `preview.yml` runs tests AND build, making `ci.yml` redundant. Delete it.

### Delete `set-cf-env.yml`

This is a legacy workflow for setting secrets on CF Pages. No longer needed.

---

## 6. Tests Gating Deploys

### Current State
- `ci.yml`: Only runs `npm run build` on PRs (no test execution)
- `deploy.yml`: No tests — deploys directly on push to main
- `preview.yml`: No tests — deploys preview directly

### Target State
- **All deploys gated by tests** — both app and worker tests must pass
- App tests: `npm test` (vitest, currently `redalert-cache.test.ts` + any future tests)
- Worker tests: `cd worker && npm ci && npm test`
- **Test job runs first**, deploy jobs have `needs: test`

### Test Migration
- Move `src/lib/server/redalert-cache.test.ts` → `worker/src/lib/redalert-cache.test.ts`
- Delete `src/lib/server/redalert-cache.ts` from the Astro app (it's now in the worker)
- Keep `vitest.config.ts` in root for any future app-level tests
- Add `worker/vitest.config.ts` for worker tests

### Test Strategy
```
Root (npm test):
  - src/**/*.test.ts (app-level tests, if any)
  - Environment: jsdom (browser simulation for Svelte component tests)

Worker (cd worker && npm test):
  - src/**/*.test.ts (API route tests, cache logic tests)
  - Environment: node
  - Mocks: fetch, caches (CF Cache API)
```

---

## 7. DNS / Domain Considerations

### Current URLs
- **Site:** `geebee-forge.gilad-bau.workers.dev` (Worker subdomain)
- **Legacy:** `geebee-forge.pages.dev` (from prior Pages deployment — may or may not still exist)

### After Migration
- **Site:** `geebee-forge.pages.dev` (CF Pages automatic subdomain)
- **API:** `geebee-forge-api.gilad-bau.workers.dev` (new Worker)
- **Preview API:** `geebee-forge-api-preview.gilad-bau.workers.dev`
- **Preview site:** `pr-<N>.geebee-forge.pages.dev` (CF Pages branch deploy)

### CF Pages Project

If the `geebee-forge` Pages project still exists from the prior migration:
- It can be reused — `wrangler pages deploy` will update it
- The `geebee-forge.pages.dev` subdomain will activate automatically

If it was deleted:
- Create via `wrangler pages project create geebee-forge`
- Or it will be auto-created on first `wrangler pages deploy --project-name geebee-forge`

### Custom Domain (Optional)

If you want a custom domain later:
- Add it in the CF Pages dashboard (Settings → Custom domains)
- The worker can also get a custom domain via CF Workers routes
- Example: `geebee-forge.dev` → Pages, `api.geebee-forge.dev` → Worker

### Old Worker Cleanup

After migration is verified:
- Delete the old `geebee-forge` Worker via `wrangler delete --name geebee-forge`
- This frees up `geebee-forge.gilad-bau.workers.dev`
- Any existing preview workers (`geebee-forge-pr-*`) should also be cleaned up

---

## 8. Migration Steps (In Order)

### Phase 1: Create Worker (non-breaking)

1. **Create `worker/` directory** with `package.json`, `wrangler.toml`, `tsconfig.json`, `vitest.config.ts`
2. **Port `redalert-cache.ts`** → `worker/src/lib/redalert-cache.ts` (copy, no changes needed)
3. **Port `city-names.ts`** → `worker/src/lib/city-names.ts` (copy the 6-line function)
4. **Copy `israel-cities-coords.json`** → `worker/src/data/`
5. **Create `worker/src/lib/cors.ts`** — CORS headers helper
6. **Port each API route** from `src/pages/api/alerts/*.ts` → `worker/src/routes/*.ts`
   - Remove Astro `APIRoute` typing, replace with plain `(request, env) => Response`
   - Replace `import { env } from 'cloudflare:workers'` with `env` function parameter
   - Replace `$lib/` imports with relative paths
7. **Create `worker/src/index.ts`** — fetch handler with URL routing
8. **Move tests** from `src/lib/server/redalert-cache.test.ts` → `worker/src/lib/redalert-cache.test.ts`
9. **Add worker integration tests** in `worker/src/index.test.ts`
10. **Verify:** `cd worker && npm ci && npm test && npx wrangler dev`
11. **Test locally:** run wrangler dev, call endpoints manually, verify CORS headers

### Phase 2: Deploy Worker to Production (non-breaking)

12. **Deploy worker:** `cd worker && npx wrangler deploy`
13. **Set secrets:** `cd worker && wrangler secret put REDALERT_API_KEY`
14. **Verify:** `curl https://geebee-forge-api.gilad-bau.workers.dev/api/alerts/summary?startDate=2026-03-01T00:00:00Z&endDate=2026-03-23T00:00:00Z`
15. **Compare responses:** Call the same endpoints on the old Worker and the new standalone Worker, diff outputs

### Phase 3: Switch Astro to Static (breaking change, single commit)

16. **Update `astro.config.mjs`:**
    - `output: 'static'` (was `'server'`)
    - Remove `adapter: cloudflare()` + import
17. **Remove `@astrojs/cloudflare`** from package.json
18. **Delete `wrangler.jsonc`** from root
19. **Delete `src/pages/api/`** directory entirely
20. **Delete `src/lib/server/redalert-cache.ts`** and its test file
21. **Update `AlertsDashboard.svelte`:**
    - Add `const API_BASE = import.meta.env.PUBLIC_API_URL || '';`
    - Prefix all fetch URLs with `API_BASE`
22. **Create `.env.development`** (gitignored): `PUBLIC_API_URL=http://localhost:8787`
23. **Verify local dev:** `npm run dev` + `cd worker && npx wrangler dev` in separate terminals
24. **Verify build:** `PUBLIC_API_URL=https://geebee-forge-api.gilad-bau.workers.dev npm run build`
25. **Verify output:** `ls dist/` should contain `index.html`, `alerts/index.html`, etc. (no `server/`)

### Phase 4: Update CI/CD

26. **Replace `.github/workflows/deploy.yml`** with the new version (test → deploy-app + deploy-worker)
27. **Replace `.github/workflows/preview.yml`** with the new version (test → deploy-preview-worker → deploy-preview)
28. **Delete `.github/workflows/ci.yml`** (redundant)
29. **Delete `.github/workflows/set-cf-env.yml`** (legacy)
30. **Add GitHub secrets:**
    - `PUBLIC_API_URL` = `https://geebee-forge-api.gilad-bau.workers.dev`
    - Verify `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `REDALERT_API_KEY` still present

### Phase 5: Ship & Verify

31. **Commit & push** to a feature branch
32. **Verify preview:** Check PR comment for preview URL, test the alerts dashboard end-to-end
33. **Merge to main** — triggers production deploy
34. **Verify production:**
    - All pages load (/, /constellation, /unicorn-farm, /digest, /alerts)
    - Alerts dashboard fetches data correctly (check Network tab for CORS)
    - Map loads with pins/boundaries
    - Filters work (zone, origin, category, city search)
    - Timeline chart renders

### Phase 6: Cleanup

35. **Delete old Worker:** `wrangler delete --name geebee-forge` (after 24h burn-in)
36. **Delete stale preview workers:** `wrangler delete --name geebee-forge-pr-*`
37. **Update `CLAUDE.md`:**
    - Change deploy description
    - Update architecture section
    - Remove `import { env } from 'cloudflare:workers'` references
    - Add worker directory documentation

---

## 9. Rollback Strategy

### If Phase 3 fails (static build breaks)

Revert the commit that changes `astro.config.mjs`. The old Worker-based deployment still works — push to main will redeploy the working version.

### If Phase 4 fails (CI/CD issues)

The standalone worker (Phase 2) is already running independently. Fix workflows on a new branch. Worst case: manually deploy via `npm run build && wrangler pages deploy dist` and `cd worker && wrangler deploy`.

### If CORS issues in production

Quick fix: update `worker/src/lib/cors.ts` to allow the specific Pages origin:
```ts
'Access-Control-Allow-Origin': 'https://geebee-forge.pages.dev'
```
Deploy worker fix independently — no need to rebuild the static site.

### If alerts dashboard is broken but other pages work

The standalone worker can be redeployed independently. The static site doesn't need rebuilding for API-only fixes.

### Nuclear rollback

1. Revert all commits back to the pre-migration state
2. Push to main — the old single-Worker deploy.yml kicks in
3. Everything is back to normal

**Key advantage of the phased approach:** The new worker (Phase 2) coexists with the old architecture. Nothing breaks until Phase 3, and Phase 3 is a single atomic commit that can be reverted.

---

## 10. Files Changed Summary

### New Files
```
worker/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── summary.ts
│   │   ├── history.ts
│   │   ├── distribution.ts
│   │   ├── cities.ts
│   │   ├── stats-cities.ts
│   │   ├── geocode.ts
│   │   ├── zone-summary.ts
│   │   └── zone-distribution.ts
│   ├── lib/
│   │   ├── redalert-cache.ts     (moved from src/lib/server/)
│   │   ├── redalert-cache.test.ts (moved from src/lib/server/)
│   │   ├── city-names.ts          (copied from src/lib/utils/)
│   │   └── cors.ts                (new)
│   ├── data/
│   │   └── israel-cities-coords.json (copied from src/lib/data/)
│   └── index.test.ts              (new)
├── wrangler.toml                   (new)
├── package.json                    (new)
├── tsconfig.json                   (new)
└── vitest.config.ts                (new)

.env.development                    (new, gitignored)
```

### Modified Files
```
astro.config.mjs                    (output: static, remove adapter)
package.json                        (remove @astrojs/cloudflare)
src/components/svelte/alerts/AlertsDashboard.svelte  (add API_BASE prefix)
.github/workflows/deploy.yml        (rewritten)
.github/workflows/preview.yml       (rewritten)
.gitignore                          (add .env.development)
CLAUDE.md                           (update architecture docs)
```

### Deleted Files
```
wrangler.jsonc                      (root wrangler config)
src/pages/api/alerts/summary.ts
src/pages/api/alerts/history.ts
src/pages/api/alerts/distribution.ts
src/pages/api/alerts/cities.ts
src/pages/api/alerts/stats-cities.ts
src/pages/api/alerts/geocode.ts
src/pages/api/alerts/zone-summary.ts
src/pages/api/alerts/zone-distribution.ts
src/lib/server/redalert-cache.ts    (moved to worker)
src/lib/server/redalert-cache.test.ts (moved to worker)
.github/workflows/ci.yml            (replaced by test job in deploy/preview)
.github/workflows/set-cf-env.yml    (legacy, unused)
```

### Kept As-Is
```
src/lib/utils/city-names.ts         (still used by AlertsMap.svelte)
src/lib/data/israel-city-boundaries.json (frontend-only)
src/lib/data/israel-cities-coords.json   (kept for reference, also copied to worker)
src/lib/digest-data/*.json          (build-time import, no change)
All .astro pages                     (no change)
All Svelte components except AlertsDashboard (no change)
```

---

## 11. GitHub Secrets Inventory

### Required (already exist)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `REDALERT_API_KEY`

### New
- `PUBLIC_API_URL` — production worker URL (e.g., `https://geebee-forge-api.gilad-bau.workers.dev`)

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CORS issues on production | Medium | High (dashboard broken) | Test CORS in preview deploy; worker reflects Origin header |
| Build output path wrong | Low | High (deploy fails) | Verify `dist/` contains HTML before pushing workflows |
| `import.meta.env.PUBLIC_API_URL` not available in Svelte island | Low | High | Astro injects `PUBLIC_*` vars into client bundles — verified pattern |
| CF Cache API not available in standalone worker | Very Low | Medium (perf regression) | It's a standard Workers API, same as before |
| Preview worker URL mismatch | Low | Low (preview broken, prod fine) | Hardcode preview URL in workflow, same as argus |
| Old worker still receiving traffic | Low | Low | Delete old worker after 24h burn-in |
| `geebee-forge.pages.dev` subdomain not available | Very Low | Medium | If CF Pages project exists, it'll work; if not, create it first |
