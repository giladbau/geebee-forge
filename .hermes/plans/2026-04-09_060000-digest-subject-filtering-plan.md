# Weekly Digest Subject Filtering + Editorial Compilation Plan

> Planning only. No code changes yet.

## Goal

Refocus the weekly digest so it only covers professional subjects you explicitly choose.

The new operating model will be:
- accumulation = fetch broadly from enabled sources, then keep only items that match your chosen professional subject scope
- compilation = perform the final editorial pass, pick the 2–4 main themes/items, and write the actual synthesis/analysis

## Current context

The current pipeline already has:
- source collection from Reddit, X following, X bookmarks, and HuggingFace daily papers
- normalization into a shared item schema
- time-window filtering per source
- deduped accumulation into a live pool
- preview/compile output in the geebee-forge digest contract

What it does not yet have:
- a configurable subject allowlist
- a professional-scope gate during accumulation
- subject tagging on accepted items
- compile-time theme clustering driven by chosen subjects
- stronger editorial logic for selecting the 2–4 main items/themes

## Product decision

Use a two-stage filter:

1. Accumulation-stage filtering
- Keep the pool clean early.
- Accept only items matching configured professional subject families.
- Tag accepted items with subject matches and rationale.
- Preserve raw source artifacts for traceability.

2. Compilation-stage curation
- Start only from the filtered pool.
- Cluster accepted items into digest-worthy themes.
- Choose 2–4 main themes/items.
- Generate the final analysis and supporting notables from within the allowed scope only.

This gives us a cleaner active pool without overloading accumulation with the full editorial job.

## Initial subject scope

These are the starting subject families based on your message.

### 1. 3D Gaussian Splatting and adjacent subjects
Primary focus:
- 3D Gaussian Splatting
- Gaussian Splatting
- 3D reconstruction
- radiance fields
- NeRF-adjacent methods
- real-time novel view synthesis
- scene representation / neural scene representation
- dynamic scene reconstruction
- 3D capture pipelines
- splat rendering, point-based rendering, differentiable rendering

Suggested adjacent terms:
- gaussian splat / gaussian splats
- 4D Gaussian Splatting
- SLAM + splatting overlap
- photogrammetry + neural rendering overlap
- inverse rendering when clearly tied to scene representation
- reconstruction benchmarks, datasets, viewers, tooling

### 2. AI agents news and adjacent subjects
Primary focus:
- AI agents
- agentic workflows
- coding agents
- autonomous agents
- Claude / GPT / Gemini class frontier model updates when they matter for agents
- model releases relevant to agency, tool use, reasoning, coding, orchestration
- OpenClaw
- Hermes

Suggested adjacent terms:
- tool use / function calling
- MCP and agent infrastructure
- evals for agents
- browser agents, coding agents, research agents
- memory, planning, delegation, orchestration
- notable open-source agent frameworks
- important model launches or papers that materially change agent capabilities

Boundary note:
- include both practically relevant model news and genuinely notable model releases/works, even when the value is broader industry significance rather than only immediate workflow impact
- compilation should make the editorial call on whether a model/item is truly notable enough to deserve inclusion

### 3. Image and video processing + GenAI
Primary focus:
- image generation
- video generation
- image editing
- video editing / transformation
- multimodal vision generation
- image/video foundation models
- image restoration / enhancement when relevant to modern GenAI workflows

Suggested adjacent terms:
- diffusion models
- transformers for vision generation
- controllable generation
- image-to-image / video-to-video
- motion transfer / world models where clearly connected to video GenAI
- segmentation, tracking, depth, and reconstruction when they directly support image/video generation or editing pipelines
- production tools, benchmarks, datasets, and notable releases in visual GenAI

Boundary note:
- notable works in image/video processing and computer vision are in scope even when they are not narrowly GenAI, as long as they are genuinely important to the field
- examples like SAM-class releases should be treated as relevant by default

## Recommended config shape

Add explicit subject controls to the digest config.

Target file:
- `/home/gilad/work/geebee-forge-digest/config.json`

Likely schema additions:

```json
{
  "subjects": {
    "enabled": true,
    "mode": "allowlist",
    "minimum_match_score": 1,
    "professional_only": true,
    "families": [
      {
        "id": "gaussian-splatting",
        "label": "3D Gaussian Splatting",
        "include_terms": ["gaussian splatting", "3d gaussian splatting", "radiance fields", "nerf"],
        "exclude_terms": [],
        "adjacent_terms": ["novel view synthesis", "3d reconstruction", "scene representation"]
      },
      {
        "id": "ai-agents",
        "label": "AI Agents",
        "include_terms": ["ai agents", "agentic", "coding agent", "tool use", "mcp", "claude", "gpt", "hermes", "openclaw"],
        "exclude_terms": [],
        "adjacent_terms": ["orchestration", "planning", "memory", "browser agent"]
      },
      {
        "id": "image-video-genai",
        "label": "Image/Video GenAI",
        "include_terms": ["image generation", "video generation", "diffusion", "image editing", "video editing"],
        "exclude_terms": [],
        "adjacent_terms": ["multimodal", "video-to-video", "image-to-image", "vision generation"]
      }
    ]
  }
}
```

Notes:
- keep this human-editable
- avoid a huge ontology for v1
- prefer a compact, explicit subject allowlist over a general classifier
- score matches by term hits across title, summary, tags, URL hints, and source metadata

## Recommended data model changes

Accepted items in the active pool should carry subject metadata.

Likely added fields on normalized items:
- `subject_matches[]`
- `subject_primary`
- `subject_match_score`
- `professional_relevance`
- `filter_decision`
- `filter_reason`

Example:

```json
{
  "subject_matches": ["ai-agents", "image-video-genai"],
  "subject_primary": "ai-agents",
  "subject_match_score": 3,
  "professional_relevance": "high",
  "filter_decision": "accepted",
  "filter_reason": "Matched ai-agents on title+summary; model release relevant to coding/tool use"
}
```

For rejected items, do not pollute the active pool. Instead, preserve enough debugability via:
- raw fetch artifacts already saved per run
- optional per-run `filtered-out.json` or summary counts by subject/reason

## Implementation approach

### Phase 1: Subject taxonomy + accumulation filter

Objective:
- introduce an explicit allowlist of professional subjects and use it during accumulation

Files likely to change:
- `scripts/digest/shared/config.mjs`
- `scripts/digest/accumulate.mjs`
- new: `scripts/digest/shared/subjects.mjs`
- possibly: `scripts/digest/shared/normalize.mjs`
- possibly: `scripts/digest/shared/filter.mjs`
- `src/lib/digest/pool.test.ts`
- new tests: `src/lib/digest/subjects.test.ts`

Planned work:
- extend config with a `subjects` block
- create a subject-matching helper that scores items against the configured families
- inspect title, summary, tags, author/source metadata, and URL text for matches
- decide accepted vs rejected during accumulation after normalization and existing time-window filtering
- attach subject metadata to accepted items before merge into active pool
- emit per-run counters for accepted/rejected items and acceptance reasons

Definition of done:
- active pool contains only accepted in-scope items
- each accepted item has subject metadata
- accumulation output reports subject-filtering results

### Phase 2: Status + observability improvements

Objective:
- make the filtered pool inspectable so tuning is easy

Files likely to change:
- `scripts/digest/status.mjs`
- maybe `scripts/digest/preview.mjs`
- new: optional `scripts/digest/inspect.mjs` or equivalent helper
- tests: `src/lib/digest/pool.test.ts` and/or new status tests

Planned work:
- extend status output to show counts by subject family, not just by source
- show accepted/rejected totals from the latest accumulation run
- keep source health intact
- optionally expose top tags / top matched families for sanity checking

Definition of done:
- after one accumulation run, we can see whether the allowlist is behaving sensibly without reading raw JSON by hand

### Phase 3: Compile-time editorial selection by theme

Objective:
- replace simple score-sorting with subject-aware theme selection and curation

Files likely to change:
- `scripts/digest/shared/render.mjs`
- possibly new: `scripts/digest/shared/editorial.mjs`
- `scripts/digest/preview.mjs`
- `scripts/digest/compile.mjs`
- `src/lib/digest/render.test.ts`
- new tests for theme grouping/editorial selection

Planned work:
- group filtered items into candidate themes using subject metadata plus lightweight textual similarity heuristics
- choose 2–4 main themes/items using:
  - subject relevance
  - source diversity
  - recency
  - engagement
  - novelty / non-duplication
- generate hero topics from those themes, not just the top N ranked raw items
- select notable items only from remaining in-scope items

Definition of done:
- preview and compile produce 2–4 main themes/items that clearly reflect your chosen professional areas rather than generic popularity ranking

### Phase 4: Better editorial analysis scaffolding

Objective:
- improve the output quality of hero topic summaries and insights

Files likely to change:
- `scripts/digest/shared/render.mjs`
- maybe new helper under `scripts/digest/shared/editorial.mjs`
- tests under `src/lib/digest/render.test.ts`

Planned work:
- derive hero summaries from grouped evidence, not a single top item only
- make `insight` explicitly answer: why this matters professionally
- bias summaries toward product, tooling, model, research, and workflow implications
- preserve source links as supporting evidence for each hero topic

Definition of done:
- hero topics read like curated professional intelligence, not just selected links with placeholder copy

### Phase 5: Tuning pass on real accumulation data

Objective:
- make the initial subject list practical and reduce false positives/negatives

Files likely to change:
- `/home/gilad/work/geebee-forge-digest/config.json`
- possibly subject helper tests

Planned work:
- run accumulation on live data
- inspect status / preview outputs
- tune include/adjoining/exclude terms
- trim overly broad terms
- add missing important adjacent terms discovered in real runs

Definition of done:
- the pool feels intentionally scoped and the weekly preview looks plausibly publishable

## Suggested file-level design

### `scripts/digest/shared/config.mjs`
Add defaults for the new `subjects` block.

### `scripts/digest/shared/subjects.mjs` (new)
Responsibilities:
- normalize text for matching
- score subject families
- choose primary subject
- return accept/reject decision plus rationale

### `scripts/digest/accumulate.mjs`
Insert subject filtering after normalization/source collection and before merge into pool.

### `scripts/digest/status.mjs`
Report counts by subject family and latest filter metrics.

### `scripts/digest/shared/render.mjs`
Replace the current flat ranking-first selection with subject-aware editorial grouping.

### `scripts/digest/preview.mjs` and `scripts/digest/compile.mjs`
Continue sharing one rendering path; do not fork preview vs compile logic.

## Editorial rules for v1

These rules should shape implementation.

1. Subject allowlist is authoritative
- If an item does not match the chosen subject families, it does not enter the active pool.

2. Professional relevance beats generic virality
- An in-scope item with clear professional significance should beat a more viral but less relevant item.

3. Compilation chooses themes, not just links
- Hero topics should represent the strongest 2–4 professional developments of the period.

4. Notable section stays within scope
- No off-topic filler.

5. Traceability remains intact
- Raw artifacts stay saved even when items are rejected.

## Validation plan

Primary commands:
- `npm run digest:test`
- `npm run digest:accumulate`
- `npm run digest:status`
- `npm run digest:preview`

What success should look like:
- accumulation reduces pool size materially by removing out-of-scope items
- status shows sensible counts by subject family
- preview hero topics concentrate around the chosen domains
- notable items stay in-domain
- no regression in digest JSON contract

## Risks and tradeoffs

### Risk: over-filtering
If accumulation is too strict, important items will never reach compilation.

Mitigation:
- start with explicit allowlist + adjacent terms
- keep thresholds simple in v1
- preserve enough diagnostics to tune quickly

### Risk: under-filtering on broad terms like Claude/GPT
These terms can match general hype/news.

Mitigation:
- require contextual co-signals for the AI-agents family when possible, such as agents, coding, tools, orchestration, reasoning, or model capability changes
- use exclude terms if needed after the first live tuning pass

### Risk: poor theme grouping
Naive grouping can collapse unrelated items or split one story into many fragments.

Mitigation:
- start with lightweight clustering keyed by subject + normalized important terms
- optimize later only if needed

## Policy decisions locked in

1. Model/news inclusion
- include both practically relevant items and genuinely notable releases/works
- compilation makes the final editorial call on what is notable enough to lead

2. Image/video/CV inclusion
- notable classic CV and image/video processing works are in scope even when not narrowly GenAI
- SAM-class releases are representative of the kind of work that should qualify

3. Project weighting
- OpenClaw, Hermes, and similar subjects are normal in-scope items, not specially boosted by rule
- relative importance should be decided editorially during compilation based on actual impact and relevance

4. Rejected-item visibility
- no user-facing rejected-item output is needed for v1
- accumulation should still maintain enough internal traceability for debugging if needed later

## Recommended execution order

Keep it compact:
1. Add subject config + matcher
2. Filter during accumulation + store subject metadata
3. Upgrade status visibility
4. Upgrade render/editorial selection for 2–4 main themes
5. Tune on one real accumulation run

That is the smallest end-to-end path that changes behavior in the way you want without overbuilding the system.
