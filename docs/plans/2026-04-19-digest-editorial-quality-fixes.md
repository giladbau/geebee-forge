# Weekly Digest Editorial Quality Fixes Implementation Plan

> **For Hermes:** Use the `codex` skill with highest reasoning to implement this plan. Work on a branch, verify locally, then run independent review before pushing.

**Goal:** Fix the weekly digest so hero themes are coherent, titles are short, summaries and analysis serve different jobs, notable items are not duplicates of hero sources, weak/low-signal sources are less likely to dominate, and the UI supports expandable summaries.

**Architecture:** Tighten the digest generator first, then update the frontend contract/UI to expose the richer output. The core fix is editorial: better clustering, stronger source-quality scoring, dedupe between hero coverage and notable coverage, and distinct text-generation rules for title vs summary vs analysis.

**Tech Stack:** Node.js scripts (`scripts/digest/*`), Astro + Svelte 5 (`src/pages`, `src/components/svelte/digest`), Vitest.

---

## Root-cause findings

1. `scripts/digest/shared/render.mjs` currently builds hero titles by prepending the subject label to the lead source title, so titles become absurdly long and inherit source phrasing.
2. AI-agents subtheme detection is too coarse, so unrelated posts get lumped together under one theme.
3. Notable selection excludes only hero lead items, not the full set of hero-covered sources/items, so duplicates leak into `notable`.
4. Ranking is still too engagement-heavy and too trusting of low-signal Reddit media/link posts.
5. `summary` and `insight` are both generated from the same lead-title-driven pattern, so they partially duplicate each other.
6. `week` regressed to `issueDate -> issueDate` instead of the actual compile window.
7. The frontend has no affordance for compact-vs-expanded long summaries.

---

## Task 1: Lock the new editorial rules in tests

**Objective:** Add failing tests for the exact regressions the user flagged.

**Files:**
- Modify: `src/lib/digest/render.test.ts`

**Add tests for:**
- hero titles are short and do not embed the full lead source title
- hero summaries and analyses are materially different
- notable items do not duplicate any source already used in hero topics
- low-signal Reddit complaint/gossip/image-only items lose to stronger official/paper/project sources
- week label reflects the compile window, not a single-day fallback

**Verification:**
- Run: `npm run digest:test -- src/lib/digest/render.test.ts`
- Expected: FAIL before implementation

---

## Task 2: Fix compile-time editorial modeling

**Objective:** Replace lead-title-driven output with actual theme synthesis and better source selection.

**Files:**
- Modify: `scripts/digest/shared/render.mjs`
- Possibly modify: `scripts/digest/shared/normalize.mjs`

**Implementation notes:**
- Introduce a compact hero title generator that emits theme labels, not pasted headlines.
- Improve AI-agents subtheme detection so tooling/monitoring/cost-management do not get lumped with generic application/build stories.
- Add source-criticality heuristics:
  - reward official/org/blog/paper/github/huggingface/arxiv domains
  - penalize image-host/video-host-only Reddit URLs (`i.redd.it`, `v.redd.it`, gallery-only links) unless corroborated
  - penalize gripe/gossip/low-substance complaint phrasing
  - prefer groups with corroboration across multiple solid items, not one viral post plus junk
- Build hero summaries as complete “what happened in this theme” syntheses.
- Build hero analysis as interpretive “why it matters / what it means” text, not a rephrased summary.
- Track all hero-covered item IDs/source URLs and exclude them from notable selection.
- Compute the week label from the real compile window.

**Verification:**
- Run the render tests after implementation.
- Inspect a generated preview JSON and confirm the hero titles/summaries/analysis read differently.

---

## Task 3: Thread compile-window context through preview/compile

**Objective:** Pass enough state into rendering to build the correct week range in both preview and compile modes.

**Files:**
- Modify: `scripts/digest/preview.mjs`
- Modify: `scripts/digest/compile.mjs`
- Possibly modify: `scripts/digest/shared/pool.mjs`

**Implementation notes:**
- Load the pre-compile state before writing the new state.
- Pass the previous successful compile timestamp (or sane fallback from item timestamps) into `buildPreviewDigest`.
- Keep preview and compile on the same render path.

**Verification:**
- Run: `npm run digest:preview`
- Check the generated `preview.json` week range.

---

## Task 4: Add expandable summaries in the Svelte UI

**Objective:** Let long summaries/analysis start compact and expand on demand.

**Files:**
- Modify: `src/components/svelte/digest/DigestBrowser.svelte`

**Implementation notes:**
- Add per-card expand/collapse state for hero summaries, hero analysis, and optionally notable summaries.
- Keep collapsed text readable; don’t make the whole page feel like a wall of prose.
- Preserve current favorites/tag filtering behavior.

**Verification:**
- Run the app locally and verify expand/collapse behavior in the browser.

---

## Task 5: Re-run digest generation and inspect output quality

**Objective:** Validate the fixes against the real current pool / published issue artifacts.

**Files:**
- No required source edits

**Run:**
- `npm run digest:test`
- `npm run digest:preview`
- Inspect `/home/gilad/work/geebee-forge-digest/issues/<latest>/preview.json`

**Review checklist:**
- Hero titles brief
- Summaries complete and useful
- Analysis interpretive, not repetitive
- No hero/notable duplication
- Hero themes coherent
- Weak Reddit filler demoted
- Week range sane

---

## Task 6: Independent review before push

**Objective:** Catch logic mistakes before shipping.

**Files:**
- all modified files

**Run:**
- `npm run digest:test`
- any project-local checks needed for the digest page
- independent review via `delegate_task`

**Ship rule:**
- Do not push until tests pass and the diff has been reviewed.
