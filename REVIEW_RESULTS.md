# Review Results — `refactor/pages-worker-split`

Branch: `refactor/pages-worker-split` vs `main`
Commits: 3 (ce24161, d019c8b, b226334)

---

## Review Issues

### Critical

#### 1. CORS: Open origin reflection (FIXED)
**File:** `worker/src/lib/cors.ts:3`

The CORS handler reflects any `Origin` header back verbatim as `Access-Control-Allow-Origin`. This means any website can make cross-origin requests to the API.

**Fix:** Whitelist known origins (`geebee-forge.pages.dev`, preview URLs, `localhost` for dev).

#### 2. Missing `@cloudflare/workers-types` dependency (FIXED)
**File:** `worker/tsconfig.json:12`, `worker/package.json`

`tsconfig.json` references `"types": ["@cloudflare/workers-types"]` but the package isn't in `devDependencies`. Running `npx tsc --noEmit` from `worker/` fails with:
```
error TS2688: Cannot find type definition file for '@cloudflare/workers-types'
```

**Fix:** Add `@cloudflare/workers-types` to `worker/package.json` devDependencies.

### Warnings

#### 3. Preview workflow: all PRs share one preview worker
**File:** `.github/workflows/preview.yml`

`deploy-preview-worker` deploys to a single `geebee-forge-api-preview` worker. If two PRs with different worker code are open simultaneously, they overwrite each other. The old approach created per-PR workers (`geebee-forge-pr-<number>`).

Also, `cleanup-preview-worker` deletes this shared worker when *any* PR closes — breaking other open PRs.

**Recommendation:** Accept this tradeoff if concurrent PRs with worker changes are rare, or switch to per-PR preview workers (`--env pr-${{ github.event.number }}`).

#### 4. `deploy.yml` relies on `PUBLIC_API_URL` secret for production
**File:** `.github/workflows/deploy.yml:32`

The Astro build uses `PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL }}` to set the worker API base. If this secret isn't configured, `API_BASE` falls back to `''` (empty string), meaning fetches go to relative paths — which won't work since the site is now static CF Pages and the API is a separate worker.

**Recommendation:** Ensure `PUBLIC_API_URL` is set in GitHub repo secrets. Consider failing the build if it's missing.

#### 5. Route handlers don't validate HTTP method
**Files:** `worker/src/routes/summary.ts`, `history.ts`, `distribution.ts`, `cities.ts`, `stats-cities.ts`

All proxy routes accept any HTTP method (POST, DELETE, etc.) and forward to the upstream API. Only `geocode.ts` properly dispatches by method.

**Recommendation:** Low risk since upstream likely rejects non-GET, but a method guard would be more defensive.

#### 6. `MIGRATION_PLAN.md` (823 lines) committed to repo
Planning artifact that isn't useful in the final codebase. Consider removing before merge.

### Notes (non-blocking)

- Old API routes (`src/pages/api/alerts/`) and server lib (`src/lib/server/`) properly deleted — no orphaned files.
- Cache logic (`redalert-cache.ts`) preserved correctly via rename.
- City normalization intentionally duplicated in `src/lib/utils/city-names.ts` and `worker/src/lib/city-names.ts` — both are identical.
- Test coverage is good: `worker/src/index.test.ts` covers routing, CORS preflight, CORS headers on responses, geocode GET/POST, and 404 handling (11 tests). `redalert-cache.test.ts` carried over.
- `astro.config.mjs` correctly switched from `output: 'server'` with cloudflare adapter to `output: 'static'`.
- `@astrojs/cloudflare` correctly removed from `package.json` dependencies.

---

## Simplify Suggestions

### 1. Proxy route handlers are repetitive (optional)
`summary.ts`, `history.ts`, `distribution.ts`, `stats-cities.ts`, and `cities.ts` follow an identical pattern:
- Parse URL params → build upstream URL → fetch with auth → return response with cache headers.

Could extract a `proxyUpstream(upstreamPath, request, env, opts?)` helper to DRY up ~100 lines. Not blocking — the duplication is readable and each handler is self-contained.

### 2. `API_BASE` declared in two Svelte components
`AlertsDashboard.svelte:71` and `AlertsMap.svelte:101` both declare `const API_BASE = import.meta.env.PUBLIC_API_URL || ''`. Could extract to a shared constant in `src/lib/config.ts`, but this is minor.

### 3. No dead code or unnecessary imports found
All imports are used. No leftover `cloudflare:workers` imports. Clean migration.
