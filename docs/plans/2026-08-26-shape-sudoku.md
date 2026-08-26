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
