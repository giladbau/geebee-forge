# Drawing mode: first integration boundary

The drawing UI and local CNN controller are implemented on a preview branch. This is not yet a production release; actual integrated iPad/Pencil and child usability still require testing.

## Imported unchanged from 9515a8b

`src/lib/shape-sudoku-lab/{cnn.ts,cnn-worker.ts,cnn.test.ts}`, `public/models/shape-cnn-v1.json`, `scripts/fixtures/shape-cnn-reference.json`, and the Pillow license. No lab route/navigation, training code, private samples, or model edits. The synthetic parity fixture is required by the imported contract test.

## API / game fit

`DrawingState(puzzle, board?)` owns cell ink, overlay, accepted value, invalid/pending flags and monotonically increasing revisions. `cell()` and `board()` return copies. `begin(row,column,point)`, `point(point)`, `end()`, `cancel()` form one stroke transaction. Coordinates are normalized to the start cell. Active points retain their original coordinates. Completed strokes are segment-clipped into separate paths at excursions, avoiding artificial border segments; SVG display clips the active stroke to its owning cell. `activeStroke` exposes a copy for rendering.

`request()` returns a token plus an independent ink snapshot. Pass its revision and a unique id to the imported worker; retain the full token in the controller, including epoch. `preview(token, symbol|null)` is guarded; after a preview delay call `commit(token)`. Only commit calls existing `applyMove`, so invalid recognition keeps ink/overlay without entering the board. Recognition never receives the puzzle. New stroke, undo, replacement, mode change and reset invalidate affected pending work. For an individual inference error use `preview(token,null)`; the controller implements global worker-failure handling and timer cancellation.

`undo()` reverses the latest stroke/erase/replacement across the board; recognition adds no history entry. Accepted cells ignore ordinary strokes but permit conservative horizontal scrubbing. `replace(row,column,value)` accepts an already validated `applyMove` or `applyHint` result, clears old ink, and records an undo snapshot. Keep existing hint targeting; detect the changed cell in `applyHint` as the current UI does. `setMode(boolean)` preserves ink/accepted values and invalidates outstanding tokens. `reset(puzzle)` clears drawing/history, including size changes.

## Provisional recognition, NOT calibrated

`provisionalRecognition(ink, scores)` expects nine softmax scores in canonical model order (not sorted `ranked` order). Empty/tiny/nearly linear marks, extreme path-length scribbles, and weak score/margin are rejected. Thresholds are explicit development heuristics, not empirically justified child accuracy. Synthetic tests use supplied scores, not a human evaluation corpus, and do not establish rejection reliability. Confident incomplete shapes can still pass. The separate scratch detector requires existing ink, a single horizontal gesture, five broad reversals and overlap with old bounds; slash/X are not erase gestures. Vertical/diagonal scrubs are deliberately not accepted yet.

## Implemented UI / remaining verification

- Svelte reactive adapter around this non-reactive class; sync accepted board after transactions. Existing click/hint/reset/new-puzzle/size paths are wired through state.
- Pencil-only board capture, pointer id ownership, coalesced events, cell-local coordinate conversion, true segment clipping, pointercancel rollback, live provisional ink rendering.
- Worker lifecycle/load/error/retry, id-to-token map, pause/preview timers, cancellation on unmount/mode/undo/reset. Reject malformed messages and discard duplicate results in controller.
- Minimum cell size/scrolling, ink/canonical layers, persistent invalid non-color cue, Undo control and mode switch. No clear-cell UI is authorized.
- Browser integration passes 19 checks with real Chromium pen/touch dispatch. Actual iPad/Pencil/palm behavior, real child rejection and erase false-positive validation remain unverified.

State, controller, policy, CNN parity and game component tests pass; the full Astro build passes. The parent reran all 19 browser checks successfully. Full suite: 53 tests pass. Ink is rescheduled when the worker becomes ready or unfinished work resumes after cancellation/mode changes. Timing is provisionally 400ms quiet time followed by 600ms preview, drawing cells have a 96px minimum, and recognition rejection remains explicitly uncalibrated.
