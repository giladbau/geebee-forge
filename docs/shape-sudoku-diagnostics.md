# Shape Sudoku diagnostics

The previous synthetic fixtures were too narrow to establish human usability.
`node scripts/probe-shape-sudoku-synthetic.mjs` reproduces the committed JSON matrix; all probes are **synthetic**, not user/Pencil captures.

## Observed failures before changes
- Exact square rotated 10 or 15 degrees: rejected; hexagon ranks first.
- Exact square rotated 45 degrees: incorrectly accepted as cross.
- Unrotated aspect 0.8: rejected, hexagon ranks first.
- Repeating a square with a 10-unit offset: rejected. Existing ink is intentionally accumulated, not replaced.
- Across 44 stress probes, 8 accepted as square. This is not an accuracy estimate: the matrix includes rectangle/trapezoid-like distortions.

Only axis-aligned fixed-proportion canonical outlines are trained. Normalization preserves aspect and rotation. Increasing the distance threshold cannot fix wrong rankings and risks false accepts. Threshold, ambiguity margin and circle veto remain unchanged pending real drawings. Synthetic matrix decisions are unchanged after this patch.

## Local capture
Draw freely, wait for the result, open **Drawing diagnostics (local download only)**, optionally annotate the latest attempt, then choose **Download attempts JSON**. Share that file explicitly if desired. There is no upload, target tracing, shape selection, or puzzle answer.

The JSON includes build SHA, recognizer version, raw tile-percent stroke coordinates (before recognition resampling), stroke boundaries, ranked geometric distances, all rejection reasons, circle distance, candidate margin, thresholds, browser/viewport, current ink and the latest 100 events. Events include completed strokes, recognition, scratch erase (before ink is destroyed), cancellation and clear. It does not include pressure or every hardware/coalesced sample; it captures exactly the coordinates this UI feeds to recognition. Notes annotate only the latest exported event. Reload discards memory. Distances are not probabilities.

## Narrow lifecycle fixes
Clear now targets the last tile drawn in, rather than the first nonempty tile. It also cancels pending recognition, so cleared tiles do not turn uncertain 650ms later. No automatic timeout discards multi-stroke drawing. Retry accumulation is now explained in the panel.

## Verification and limitations
81 existing tests and Astro build pass. Chromium browser script replays 28 synthetic fixtures through built route, downloads and parses a real JSON file, and checks last-tile clear/timer cancellation. It does not prove Apple Pencil/Safari behavior or real human recognition. `npm run check` cannot run because @astrojs/check is not installed (interactive install prompt).
