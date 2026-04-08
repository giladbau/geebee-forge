# Weekly Digest Pipeline Standardization Plan

> For Hermes: use the `weekly-digest-pipeline` skill as the operating doctrine for this work.

Goal: rebuild/standardize the real digest workflow so it supports scheduled accumulation, scheduled or manual compilation, geebee-forge-compatible publishing, and post-publish reset of the active accumulation pool.

Architecture: keep geebee-forge as the publication surface only. Add a local digest pipeline layer that owns raw fetches, normalization, dedupe, active-pool state, archive snapshots, and compile/publish orchestration. Compilation must emit JSON compatible with `src/lib/digest-data/*.json` and be the only path that clears the active pool.

Tech stack: Node 22, Astro 6 site, plain ESM Node scripts, Vitest, Hermes cron jobs for scheduling, browser-based X access via Hermes/OpenClaw browser session.

---

## What already exists

Verified in the repo:
- Site page: `src/pages/digest.astro`
- Digest UI: `src/components/svelte/digest/DigestBrowser.svelte`
- Published issues: `src/lib/digest-data/*.json`
- Deploy pipeline: `.github/workflows/deploy.yml`
- Existing publish pattern: each digest issue is committed as a single JSON file under `src/lib/digest-data/` and then deployed by the normal GitHub Actions flow.

Observed digest JSON contract:
- `week`
- `published_at`
- `hero_topics[]`
- `notable[]`

Operational rule to preserve:
- accumulate = fill the inbox
- compile = cut an issue from the inbox and then empty it

---

## Target file layout

### New runtime state outside the published site

Create a local-only state tree adjacent to the repo:

- Create: `/home/gilad/work/geebee-forge-digest/`
- Create: `/home/gilad/work/geebee-forge-digest/config.json`
- Create: `/home/gilad/work/geebee-forge-digest/raw/`
- Create: `/home/gilad/work/geebee-forge-digest/active/`
- Create: `/home/gilad/work/geebee-forge-digest/issues/`
- Create: `/home/gilad/work/geebee-forge-digest/logs/`

Reason: keep mutable pipeline state and raw fetch archives out of the site repo while still publishing compiled issue JSON into the repo.

### New code in the repo

Create:
- `scripts/digest/accumulate.mjs`
- `scripts/digest/compile.mjs`
- `scripts/digest/status.mjs`
- `scripts/digest/preview.mjs`
- `scripts/digest/shared/config.mjs`
- `scripts/digest/shared/fs.mjs`
- `scripts/digest/shared/ids.mjs`
- `scripts/digest/shared/time.mjs`
- `scripts/digest/shared/normalize.mjs`
- `scripts/digest/shared/dedupe.mjs`
- `scripts/digest/shared/pool.mjs`
- `scripts/digest/shared/archive.mjs`
- `scripts/digest/shared/render.mjs`
- `scripts/digest/shared/publish.mjs`
- `scripts/digest/sources/reddit.mjs`
- `scripts/digest/sources/x-following.mjs`
- `scripts/digest/sources/x-bookmarks.mjs`
- `scripts/digest/sources/huggingface-papers.mjs`

Create tests:
- `tests/digest/normalize.test.ts`
- `tests/digest/dedupe.test.ts`
- `tests/digest/render.test.ts`
- `tests/digest/pool.test.ts`
- `tests/digest/publish-shape.test.ts`

Modify:
- `package.json`
- `.gitignore`
- `README.md`

Optional later:
- `docs/digest-operations.md`

---

## Command surface

Add these npm scripts in `package.json`:

```json
{
  "scripts": {
    "digest:accumulate": "node scripts/digest/accumulate.mjs",
    "digest:status": "node scripts/digest/status.mjs",
    "digest:preview": "node scripts/digest/preview.mjs",
    "digest:compile": "node scripts/digest/compile.mjs",
    "digest:test": "vitest run tests/digest"
  }
}
```

Behavior:
- `npm run digest:accumulate` → fetch recent windows, merge into active pool, do not publish, do not clear
- `npm run digest:status` → report pool counts, source health, timestamps
- `npm run digest:preview` → compile current pool without publishing or clearing
- `npm run digest:compile` → compile current pool, write issue JSON into repo, commit/push it, archive artifacts, clear active pool only after successful publish

---

## Data and state contracts

### `config.json`

Store durable, editable pipeline config in `/home/gilad/work/geebee-forge-digest/config.json`.

Initial shape:

```json
{
  "repo_path": "/home/gilad/work/geebee-forge",
  "publish_path": "src/lib/digest-data",
  "sources": {
    "reddit": {
      "enabled": true,
      "subreddits": [],
      "min_score": 50,
      "window_days": 7
    },
    "x_following": {
      "enabled": true,
      "window_days": 7
    },
    "x_bookmarks": {
      "enabled": true,
      "window_days": 7
    },
    "huggingface_daily_papers": {
      "enabled": true,
      "window_days": 7,
      "min_upvotes": 0
    }
  },
  "compile": {
    "hero_topic_target_min": 2,
    "hero_topic_target_max": 4,
    "notable_target_max": 15,
    "allow_empty_publish": false
  }
}
```

### `active/state.json`

Store operational metadata only:

```json
{
  "last_accumulation_at": null,
  "last_compile_at": null,
  "last_publish_commit": null,
  "source_health": {
    "reddit": null,
    "x_following": null,
    "x_bookmarks": null,
    "huggingface_daily_papers": null
  }
}
```

### `active/pool.json`

Canonical active staging pool:

```json
{
  "items": []
}
```

Canonical normalized item shape:

```json
{
  "id": "x:x_bookmarks:2031558590754894104",
  "source": "x",
  "source_subtype": "bookmarks",
  "source_item_id": "2031558590754894104",
  "url": "https://x.com/...",
  "title": "L.A. Noire-Style Facial Animation with AI Video Depth Maps",
  "summary": "short normalized snippet",
  "author": "@alexfredo87",
  "published_at": "2026-03-29T08:20:00Z",
  "fetched_at": "2026-04-08T12:00:00Z",
  "dedupe_keys": ["x:2031558590754894104", "url:https://x.com/..."],
  "tags": ["facial-animation", "game-dev"],
  "engagement": {"likes": 0, "score": 0},
  "raw_ref": "raw/2026-04-08T120000Z/x-bookmarks.json"
}
```

### Issue archive

For each compile, create one archive directory by date:

- `issues/YYYY-MM-DD/input-pool.json`
- `issues/YYYY-MM-DD/digest.json`
- `issues/YYYY-MM-DD/publish-result.json`
- `issues/YYYY-MM-DD/summary.txt`

Use `YYYY-MM-DD` as the issue/archive ID.
Keep the human-readable week range in `digest.json` as `week`.

---

## Publish contract

Compilation must emit a file in:
- `src/lib/digest-data/YYYY-MM-DD.json`

Expected shape:

```json
{
  "week": "2026-04-01 to 2026-04-08",
  "published_at": "2026-04-08T12:34:56Z",
  "hero_topics": [
    {
      "title": "...",
      "slug": "...",
      "summary": "...",
      "insight": "...",
      "image_url": null,
      "sources": [
        { "title": "...", "url": "...", "type": "twitter" }
      ],
      "tags": ["..."]
    }
  ],
  "notable": [
    {
      "title": "...",
      "summary": "...",
      "sources": [
        { "title": "...", "url": "...", "type": "paper" }
      ],
      "tags": ["..."]
    }
  ]
}
```

Publish flow:
1. Write issue JSON into repo
2. Validate site build inputs still look correct
3. Commit only the new digest JSON file
4. Push to `main`
5. Let existing GitHub Actions deploy flow publish the site
6. Only after successful git push + archive write should the active pool be cleared

Initial commit message format:
- `digest: publish YYYY-MM-DD`

---

## Source implementations

### Reddit

File: `scripts/digest/sources/reddit.mjs`

Responsibilities:
- fetch configured subreddit hot/top JSON with a User-Agent
- filter by score threshold and recent window
- emit raw response artifact
- normalize posts into canonical items

### X Following

File: `scripts/digest/sources/x-following.mjs`

Responsibilities:
- invoke the browser-backed collection path that uses the persistent logged-in session
- capture recent following-feed items
- emit raw artifact + normalized items

Do not redesign away from browser-based X access.
Use the existing persistent-cookie operating model.

### X Bookmarks

File: `scripts/digest/sources/x-bookmarks.mjs`

Responsibilities:
- same browser session model as X Following
- capture bookmark feed items
- emit raw artifact + normalized items

### HuggingFace Daily Papers

File: `scripts/digest/sources/huggingface-papers.mjs`

Responsibilities:
- fetch `/api/daily_papers`
- keep recent-window items
- emit raw artifact + normalized items

---

## Core behavior details

### Accumulate

Algorithm:
1. Read config
2. Create a raw run directory `raw/<timestamp>/`
3. Fetch all enabled sources
4. Save each source raw artifact, even when another source fails
5. Normalize source items into canonical records
6. Read current `active/pool.json`
7. Merge + dedupe
8. Write updated `active/pool.json`
9. Update `active/state.json`
10. Print a concise status summary

Rules:
- accumulation may succeed with partial source failures
- failed sources must be recorded in `source_health`
- accumulation never clears the pool

### Dedupe

Prefer layered dedupe keys:
1. exact source ID when present
2. canonical URL
3. title + source fallback

Fetch recent rolling windows, then dedupe into the active pool.
Do not rely on perfect incremental cursors as the only correctness mechanism.

### Preview

Algorithm:
1. Read current pool
2. Rank/filter/select heroes and notable items
3. Produce digest JSON in memory
4. Print or save a preview artifact under `issues/<date>/preview.json` if useful
5. Do not publish
6. Do not clear

### Compile

Algorithm:
1. Read current pool
2. Refuse to continue if empty, unless explicitly overridden in config
3. Snapshot `active/pool.json` to `issues/YYYY-MM-DD/input-pool.json`
4. Generate digest JSON
5. Validate output shape
6. Write `issues/YYYY-MM-DD/digest.json`
7. Write `src/lib/digest-data/YYYY-MM-DD.json` into the repo
8. Commit and push
9. Write `issues/YYYY-MM-DD/publish-result.json`
10. Reset `active/pool.json` to `{ "items": [] }`
11. Update `active/state.json`

Critical rule:
- if steps 4 through 9 fail, do not clear the active pool

---

## Ranking and selection rules

Keep the current editorial doctrine:
- ruthless filtering
- 2–4 hero topics
- around 15 notable items max
- better empty than padded

Implementation rules:
- a hero topic may aggregate multiple corroborating sources
- notable items can be single-source if signal is high enough
- prioritize items with clear novelty, utility, and personal relevance
- keep tags and sources clean because the frontend uses them directly

Do not overbuild a scoring system before the basic workflow is reliable.
Start simple and inspect output quality manually.

---

## Tests

### Task 1: add output-shape tests

Objective: lock the existing site contract before adding pipeline logic.

Files:
- Create: `tests/digest/publish-shape.test.ts`
- Test: `src/lib/digest-data/2026-03-29.json`

Test cases:
- latest published JSON parses
- every digest has `week`, `published_at`, `hero_topics`, `notable`
- every hero topic has `title`, `slug`, `summary`, `insight`, `sources`, `tags`
- every notable item has `title`, `summary`, `sources`, `tags`

Run:
- `npm run digest:test`

### Task 2: add normalization tests

Files:
- Create: `tests/digest/normalize.test.ts`
- Create: `scripts/digest/shared/normalize.mjs`

Test cases:
- Reddit raw item → canonical shape
- X raw item → canonical shape
- HF raw item → canonical shape

### Task 3: add dedupe tests

Files:
- Create: `tests/digest/dedupe.test.ts`
- Create: `scripts/digest/shared/dedupe.mjs`

Test cases:
- exact duplicate source IDs collapse
- duplicate URLs collapse
- distinct items remain distinct

### Task 4: add pool tests

Files:
- Create: `tests/digest/pool.test.ts`
- Create: `scripts/digest/shared/pool.mjs`

Test cases:
- merge preserves old unique items
- merge adds new items
- compile reset empties pool
- failed publish path leaves pool unchanged

### Task 5: add render tests

Files:
- Create: `tests/digest/render.test.ts`
- Create: `scripts/digest/shared/render.mjs`

Test cases:
- generated digest JSON matches frontend contract
- heroes/notable limits enforced
- output is stable enough for commit/publish

---

## Implementation order

### Phase 1: lock current contract
1. Add digest shape tests
2. Run digest tests
3. Confirm current published JSON passes

### Phase 2: add local pipeline skeleton
1. Add shared config/fs/time/ids helpers
2. Add pool read/write/reset helpers
3. Add empty CLI entrypoints for accumulate/status/preview/compile
4. Add tests for pool/reset behavior

### Phase 3: add source normalization + dedupe
1. Add normalize helpers and tests
2. Add dedupe helpers and tests
3. Add Reddit source collector
4. Add HuggingFace source collector
5. Add placeholder X source adapters with stable interfaces

### Phase 4: compile path
1. Add render/select logic
2. Add preview command
3. Add compile command that writes archive artifacts only
4. Add output-shape validation

### Phase 5: publish path
1. Add repo publish helper
2. Write digest JSON into `src/lib/digest-data/`
3. Commit with `digest: publish YYYY-MM-DD`
4. Push to `main`
5. Confirm active-pool reset only occurs after success

### Phase 6: operations and docs
1. Add npm scripts
2. Add `.gitignore` entries for local state outside the repo if needed in helper docs
3. Update README with digest commands
4. Document manual recovery steps

---

## Hermes cron job wiring

Do not put schedule logic in the code.
Use Hermes cron jobs to call the same repo commands.

### Accumulation jobs

Recommended frequency:
- 2–4 times per day, depending on how much signal you want

Example command body:
- `cd /home/gilad/work/geebee-forge && npm run digest:accumulate`

Initial suggested schedule:
- `0 9,13,18,22 * * *`

### Weekly compile job

Example command body:
- `cd /home/gilad/work/geebee-forge && npm run digest:compile`

Initial suggested schedule:
- `0 8 * * 0`

### Manual compile

Manual operator command:
- `cd /home/gilad/work/geebee-forge && npm run digest:compile`

Manual preview:
- `cd /home/gilad/work/geebee-forge && npm run digest:preview`

---

## Recovery playbooks

### X broke or logged out
1. Restore the browser session
2. Re-run `npm run digest:accumulate`
3. Check `npm run digest:status`
4. Do not redesign away from browser-based X access

### Compile generated output but push failed
1. Keep active pool unchanged
2. Inspect `issues/YYYY-MM-DD/digest.json`
3. Fix git/auth/deploy issue
4. Re-run compile or add a `--resume-publish` flag later if needed

### Bad digest quality
1. Run preview repeatedly
2. Inspect active pool contents
3. Tune source thresholds and selection rules
4. Only then publish

---

## Definition of done

This plan is complete when:
- `npm run digest:accumulate` fills a persistent local pool without publishing
- `npm run digest:preview` renders a valid digest without clearing the pool
- `npm run digest:compile` writes a valid `src/lib/digest-data/YYYY-MM-DD.json`, commits it, pushes it, archives the run, and only then clears the active pool
- X Following and X Bookmarks are both supported through the persistent browser-session model
- Hermes cron can run accumulation on schedule and weekly compile on schedule using the same entrypoints as manual operations

---

## Recommended immediate next action

Implement Phase 1 and Phase 2 first.
That locks the site contract and establishes the pool/reset semantics before touching the brittle X collection path.