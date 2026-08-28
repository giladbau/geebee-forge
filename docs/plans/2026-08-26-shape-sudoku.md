# Shape Sudoku Implementation Plan

> **For Codex:** Implement this plan task-by-task using strict RED-GREEN-REFACTOR. Do not commit or push; Hermes will review and finish the branch.

**Goal:** Add a simple, accessible, client-only Shape Sudoku page for children, with configurable sizes 3–9, palette-to-grid interaction, locally generated beginner puzzles, and no network dependency after load.

**Architecture:** Keep puzzle generation, solving, validation, and move rules in a pure TypeScript module. Render the game as a Svelte 5 island mounted by a minimal Astro route. Use inline SVG silhouettes and feature-local CSS; add no dependencies or backend calls.

**Tech Stack:** Astro 6, Svelte 5 runes, TypeScript, Vitest, Testing Library, browser Drag and Drop API plus tap/keyboard fallback.

**Source specification:** `/home/gilad/GVault/Personal/Projects/geebee-forge.md`, section `Shape Sudoku`.

---

## Acceptance criteria

- Route `/shape-sudoku` is linked from the primary global navigation and homepage grid.
- Grid size selector supports every integer from 3 through 9 and defaults to 4.
- Every puzzle uses exactly `size` stable shape identities and row/column-only Latin-square rules; there are no sub-boxes.
- Puzzle generation is entirely local, produces exactly one completion, and retains only clue sets solvable through repeated single-candidate moves.
- Solver uses constraint propagation/MRV and stops counting after the requested cap; it never enumerates the full solution space unnecessarily.
- A move is accepted only when the resulting board still has at least one completion.
- Palette tiles are reusable. Players can place by desktop drag/drop or select-shape-then-select-cell via pointer/keyboard.
- Placing a new shape replaces an editable cell; an eraser clears it. Clues are locked.
- Invalid placement is rejected with brief conflict feedback and no score penalty.
- Hint fills one correct editable cell, with no counter or penalty.
- Reset restores original clues. New Puzzle, size change, and reload generate a fresh puzzle; no persistence.
- Completion shows a small checkmark, “You did it!”, and New Puzzle. No sound, timer, score, streak, or leaderboard.
- Shape set, in stable order so heart appears in small games: triangle, square, faceted heart, star, pentagon, hexagon, cross, trapezoid, arrow. Shapes use stable colors but remain distinguishable by geometry.
- Functional visual baseline: light play panel in existing Forge chrome, strong grid borders, large shapes, responsive wrapping palette.
- Semantic buttons, visible focus, screen-reader labels, and keyboard-operable tap flow.
- Once loaded, generation, play, reset, new puzzle, hints, validation, and completion make no network requests and continue after connectivity is lost. Offline reload/PWA support is explicitly out of scope.

---

### Task 1: Pure puzzle model and deterministic test seam

**Objective:** Establish typed board/puzzle APIs and deterministic randomness before production logic.

**Files:**
- Create: `src/lib/shape-sudoku.ts`
- Create: `src/lib/shape-sudoku.test.ts`

**RED:** Add one focused test asserting that a generated completed board for each size 3–9 contains every symbol exactly once in every row and column. Run `npm test -- src/lib/shape-sudoku.test.ts`; confirm failure because the module/API is absent.

**GREEN:** Add types (`Cell`, `Board`, `Puzzle`) and a `createSolvedBoard(size, rng?)` function. Build a cyclic Latin square and randomize it with symbol, row, and column permutations while preserving validity. Export `isCompleteAndValid` for behavior tests.

**Verify:** Run the focused test and then `npm test`.

### Task 2: Capped solver and viable-move behavior

**Objective:** Count completions efficiently and reject moves that make the puzzle impossible.

**Files:**
- Modify: `src/lib/shape-sudoku.ts`
- Modify: `src/lib/shape-sudoku.test.ts`

**RED→GREEN slices:**
1. Test `countSolutions(board, cap)` returns one for a completed valid board and stops at the cap for an underconstrained small board.
2. Test duplicate row/column boards have no completion.
3. Test `hasCompletionAfterMove(board, row, col, symbol)` accepts a viable move and rejects a locally plausible move that leaves no completion.

Implement row/column candidate masks and choose the empty cell with the fewest candidates (MRV). Return as soon as `cap` solutions are found.

**Verify:** Focused test, then full `npm test`.

### Task 3: Beginner unique puzzle generation

**Objective:** Generate partially filled, uniquely solvable puzzles that require no guessing.

**Files:**
- Modify: `src/lib/shape-sudoku.ts`
- Modify: `src/lib/shape-sudoku.test.ts`

**RED→GREEN slices:**
1. Generated puzzle has clues and editable cells, and preserves the solved board’s values in clue cells.
2. `countSolutions(initialBoard, 2)` returns exactly one.
3. `isSinglesSolvable(initialBoard)` succeeds by repeatedly filling cells with one legal candidate.
4. Generation works for every size 3–9 with deterministic seeded RNG in tests.
5. `resetBoard`, `applyMove`, and `applyHint` preserve clues and expected state.

Generate a full board, shuffle candidate removals, and retain a removal only when uniqueness and singles-solvability remain true. Cap removal attempts/target blanks so generation stays bounded.

**Verify:** Focused test, full test suite, and a small timed smoke loop over sizes 3–9.

### Task 4: Shape rendering and interaction shell

**Objective:** Render all stable silhouettes and the accessible palette/grid interaction.

**Files:**
- Create: `src/components/svelte/shape-sudoku/ShapeIcon.svelte`
- Create: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`
- Create: `src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`

**RED→GREEN slices:**
1. Component renders default 4×4 grid, four palette shape buttons, size control, Hint, Reset, and New Puzzle.
2. Selecting a palette shape and activating an editable cell places it; selecting eraser clears it.
3. Clue cells are disabled/locked and expose useful accessible labels.
4. Invalid moves do not change the board and expose brief status feedback.
5. Hint fills one editable cell; Reset restores clues; size change regenerates the requested dimensions.
6. Completion displays “You did it!”.

Use Svelte 5 runes and property event syntax. Use buttons for palette and cells. Add native desktop `dragstart`/`dragover`/`drop` while retaining the same selection state for tap and keyboard interaction. Avoid timers except the short conflict-feedback reset.

**Verify:** Run the component test file and full `npm test`.

### Task 5: Functional responsive styling

**Objective:** Make the interaction clear on desktop and mobile without premature visual polish.

**Files:**
- Modify: `src/components/svelte/shape-sudoku/ShapeIcon.svelte`
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`

Add scoped CSS for a light panel, responsive square grid, strong clue/editable distinction, 44px-friendly controls where space permits, wrapping palette, selected/dragging/conflict/focus states, and reduced-motion handling. Ensure 9×9 remains contained within viewport width; tap interaction is the mobile fallback.

**Verify:** `npm run check`, focused tests, and browser inspection at desktop and narrow mobile viewport.

### Task 6: Astro route and site integration

**Objective:** Expose Shape Sudoku as a first-class Forge page.

**Files:**
- Create: `src/pages/shape-sudoku.astro`
- Modify: `src/components/GlobalNav.astro`
- Modify: `src/pages/index.astro`

Create a minimal `BaseLayout` route mounting `ShapeSudoku` with `client:only="svelte"`. Add `Shape Sudoku` to the primary `demos` navigation array and a homepage card describing the child-friendly shape puzzle.

**Verify:** `npm run build`; assert `dist/shape-sudoku/index.html` exists and includes the island shell. Browser-check navigation and home card.

### Task 7: Final quality gates

**Objective:** Prove the feature works and remains local/offline after initial load.

**Files:** No planned production changes; fix only failures tied to this feature.

1. Run `npm test`.
2. Run `npm run check`; distinguish pre-existing diagnostics from changed-file failures.
3. Run `npm run build`.
4. Serve the production build locally.
5. Exercise size 3, default 4, and size 9; tap placement, drag/drop, replacement, erase, invalid move, hint, reset, new puzzle, completion, keyboard focus, and mobile layout.
6. After the page generates, block network/offline the browser session and verify game actions still work without requests.
7. Review `git diff --check`, `git status`, and the final diff for scope.

Do not add dependencies, service workers, persistence, backend routes, binary assets, or unrelated cleanup.

---

## Beautification round: Quiet Garden skin, motion, and win dialog

**Design source:** `docs/design/shape-sudoku/DESIGN.md`

**Goal:** Apply the Quiet Garden tokens consistently, fix the low empty status line without introducing layout shifts, add calm tactile feedback for every meaningful action, and replace the inline completion message with a proper accessible win dialog.

**Architecture:** Keep game rules in `src/lib/shape-sudoku.ts`. Add transient presentation state to `ShapeSudoku.svelte` for the last changed cell, effect kind, board transition, completion origin, and whether the current puzzle's dialog has been shown. Use scoped CSS, keyed shape wrappers, CSS custom properties, and the native `<dialog>` element; add no animation or dialog dependency.

**Motion contract:** Routine effects last 120–180ms. Reset and New Puzzle crossfade the board as a unit. Completion ripples outward from the final cell for about 500ms, then opens the modal. Reset, New Puzzle, size change, and unmount cancel pending effects and delayed dialog opening. Under `prefers-reduced-motion: reduce`, state changes remain immediate, transforms/crossfades are removed, the completion ripple is skipped, and the dialog opens immediately.

### Beautification acceptance criteria

- The implementation uses the exact Quiet Garden color, spacing, radius, elevation, and motion tokens from `docs/design/shape-sudoku/DESIGN.md`; no parallel ad-hoc palette is introduced.
- The empty feedback area is a fixed-height, vertically centered status slot. Empty and populated states occupy identical space, and neither moves the board nor actions.
- Palette selection/drag, place, replace, erase, hint, conflict, reset, New Puzzle, size change, and completion each have a defined restrained visual response.
- Routine animations do not block controls. Reset, New Puzzle, size change, and unmount cancel stale timers/effects so an old win dialog cannot appear over a new puzzle.
- Completing the board through either a move or Hint starts one roughly 500ms success ripple from the final changed cell, then opens the win dialog once for that puzzle.
- The modal contains a check seal, “You did it!”, “Every shape found its place.”, primary “New Puzzle”, and secondary “Look at my puzzle”.
- “Look at my puzzle” and Escape dismiss the modal and leave the completed board visible. Clicking the backdrop does not dismiss it. The normal New Puzzle action remains available.
- The dialog traps focus while open and restores focus after dismissal. It does not reopen for the same completed puzzle.
- Reduced-motion users receive immediate state changes and dialog opening with no transform, crossfade, shake, or ripple animation.
- No sound, confetti, mascot, stats, score, persistence, service worker, or new runtime dependency is added.

### Task 8: Introduce Quiet Garden CSS tokens and fix the status slot

**Objective:** Make the DESIGN.md values the single visual source and remove the low empty-line defect without layout movement.

**Files:**
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`
- Modify: `src/components/svelte/shape-sudoku/ShapeIcon.svelte`
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`
- Reference: `docs/design/shape-sudoku/DESIGN.md`

**RED:** Add a component test that captures the stable status container contract: it is always present, has a dedicated `status-slot` class, remains the same element when conflict text appears and clears, and continues to expose `role="status"`/`aria-live="polite"`. Confirm the test fails against the current `.status` paragraph.

**GREEN:**
1. Define feature-local CSS custom properties matching DESIGN.md exactly.
2. Apply Quiet Garden canvas, panel, typography, palette, board-bed, cell, clue, action, focus, and shape-color treatments.
3. Replace `.status` with `.status-slot`: fixed height, grid centering, zero collapsing margins, and no visual decoration while empty.
4. Replace ShapeIcon's current colors with the nine DESIGN.md shape tokens and reduce the SVG drop shadow to the specified 1px grounding shadow.

**Verify:** Run `npm test -- src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`, then browser-capture desktop and 390×844 mobile views. Compare the vertical positions of the board/actions before, during, and after conflict feedback; they must be pixel-stable.

### Task 9: Add cancellable routine interaction effects

**Objective:** Give every meaningful action calm tactile feedback without coupling animation state to puzzle rules.

**Files:**
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`

**RED→GREEN slices:**
1. **Place:** test a successful empty-cell move marks that cell with a transient `place` effect; render the shape through a keyed wrapper that fades/scales from 0.88 to 1 over the routine duration.
2. **Replace:** test replacing an editable value records `replace`; exit the old keyed shape before entering the replacement without moving the cell.
3. **Erase:** test erasing an editable value records `erase`; fade/scale only the shape, not the cell.
4. **Hint:** test `revealHint` identifies the newly filled coordinate and applies one `hint` halo that resolves within 500ms.
5. **Palette and drag:** retain the selected ring and add only the specified 1px lift/opacity feedback; tile dimensions must remain constant.
6. **Conflict:** retain the attempted and direct conflicting coordinates; use the DESIGN.md tint plus one 2px horizontal nudge lasting no more than 180ms.
7. **Reset/New Puzzle/size change:** test that each sets one board-level transition state and clears per-cell effects; crossfade the board as a single unit over 180ms.
8. **Cancellation:** centralize timeout tracking and add a test with fake timers proving Reset, New Puzzle, size change, and unmount clear pending effect/completion callbacks.

Do not use transition events as game-logic triggers. State updates happen immediately; animation only reflects the completed state transition.

**Verify:** Run the focused component tests with fake timers, then the full suite. In a real browser, rapidly place → Reset → New Puzzle → change size and confirm no stale class, callback, or feedback appears.

### Task 10: Add completion ripple and accessible win dialog

**Objective:** Celebrate completion clearly, then offer a focused next step without taking the completed board away.

**Files:**
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`
- Modify: `src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`

**RED→GREEN slices:**
1. Track the final changed coordinate for both `placeSymbol` and `revealHint`. Test that the first incomplete→complete transition records the completion origin exactly once.
2. Derive each cell's Manhattan distance from the origin and expose it as a CSS delay custom property. Test representative same-cell, adjacent, and far-cell delays.
3. Start a 500ms success-tint ripple after completion and schedule the modal only after it. With reduced motion, skip the schedule and open immediately.
4. Render a native `<dialog>` containing a check seal, heading “You did it!”, text “Every shape found its place.”, “New Puzzle”, and “Look at my puzzle”.
5. Test “Look at my puzzle” and Escape close the dialog, preserve the completed board, mark the dialog as shown for that puzzle, and restore the previously focused control.
6. Test backdrop pointer interaction does not dismiss the modal.
7. Test “New Puzzle” closes the modal, generates a fresh board at the current size, clears completion/dialog state, and moves focus to a sensible control in the new game.
8. Test a Hint that fills the final cell follows the same completion path.
9. Test closing the modal and refocusing/activating the completed board never reopens it.

Use `showModal()` and platform focus semantics where available. Keep a small explicit focus guard only if browser testing proves native containment insufficient. Do not implement a div-based fake modal.

**Verify:** Run the focused tests, then keyboard-test Tab/Shift+Tab containment, Escape dismissal, focus restoration, both actions, completion via Hint, and no backdrop dismissal in Chromium.

### Task 11: Reduced motion, responsive polish, and final gates

**Objective:** Ensure the skin and effects remain accessible, stable, and contained across the full game matrix.

**Files:**
- Modify if required: `src/components/svelte/shape-sudoku/ShapeSudoku.svelte`
- Modify if required: `src/components/svelte/shape-sudoku/ShapeSudoku.test.ts`

1. Add a reduced-motion test seam or `matchMedia` mock and prove routine effect classes do not rely on delayed callbacks, the ripple is skipped, and the modal opens immediately.
2. Verify modal width, padding, and actions at 390×844; no horizontal overflow and all targets remain at least 44px.
3. Verify sizes 3–9, including 9×9 mobile palette label hiding while accessible names remain intact.
4. Run `npx -y @google/design.md lint docs/design/shape-sudoku/DESIGN.md`; require zero errors and zero WCAG contrast warnings. Intentional orphan-token warnings for SVG/stroke-only primitives may remain documented.
5. Run `npm test`, `npm run check`, and `npm run build`; changed-file diagnostics are blockers, unrelated pre-existing diagnostics are reported separately.
6. Serve `dist/` and browser-exercise place, replace, erase, hint, conflict, reset, New Puzzle, size change, move-completion, hint-completion, both modal actions, Escape, focus restoration, rapid cancellation, offline-after-load, and reduced motion.
7. Capture desktop and mobile screenshots for visual review against `docs/design/shape-sudoku/quiet-garden-preview.html`.
8. Run `git diff --check` and review the final diff for scope. Do not commit or push until the user approves the implemented skin.

