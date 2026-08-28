---
version: alpha
name: Quiet Garden
description: A calm, minimal pastel skin for Shape Sudoku that feels friendly without becoming toy-like.
colors:
  primary: "#315F5A"
  primary-hover: "#274D49"
  primary-soft: "#DDECE7"
  canvas: "#F5F2EC"
  surface: "#FFFEFB"
  surface-muted: "#EEF3F0"
  surface-clue: "#E5ECE8"
  text: "#263331"
  text-muted: "#586966"
  border: "#C6D2CD"
  border-strong: "#7F9690"
  focus: "#416F9D"
  error: "#944040"
  error-soft: "#F7DEDC"
  success: "#39745E"
  success-soft: "#DDEDE5"
  overlay: "rgba(38, 51, 49, 0.42)"
  shape-coral: "#D97872"
  shape-blue: "#6489C4"
  shape-rose: "#C8759E"
  shape-honey: "#C99C43"
  shape-sage: "#6C9B79"
  shape-lavender: "#8976B6"
  shape-apricot: "#CE8559"
  shape-teal: "#559995"
  shape-indigo: "#7376B5"
typography:
  display:
    fontFamily: "ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 3rem
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.035em"
  heading-sm:
    fontFamily: "ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 0.78rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 0.95rem
    fontWeight: 450
    lineHeight: 1.5
  control:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 0.88rem
    fontWeight: 650
    lineHeight: 1.2
rounded:
  sm: 8px
  md: 12px
  lg: 18px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
elevation:
  panel: "0 16px 44px rgba(49, 95, 90, 0.10)"
  raised: "0 5px 14px rgba(49, 95, 90, 0.09)"
  selected: "0 0 0 3px rgba(49, 95, 90, 0.18)"
  dialog: "0 24px 72px rgba(38, 51, 49, 0.22)"
components:
  page-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    padding: 24px
  game-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 32px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-secondary-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  palette-tile:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 8px
    height: 64px
  palette-tile-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 8px
    height: 64px
  board-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 6px
  board-cell-clue:
    backgroundColor: "{colors.surface-clue}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 6px
  board-cell-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 6px
  board-cell-conflict:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
    padding: 6px
  status-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: 8px
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: 8px
  dialog-backdrop:
    backgroundColor: "{colors.overlay}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: 24px
  win-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 32px
    width: 360px
---

## Overview

**Quiet Garden** makes Shape Sudoku feel calm, focused, and child-friendly without turning it into a candy-colored toy. The visual hierarchy comes from whitespace, silhouette, and a small number of soft surfaces. Pastels carry mood; dark evergreen ink carries readability and action.

The interface should feel like a tidy activity sheet placed on a warm desk: one centered panel, one obvious puzzle, and controls that recede until needed. Every visual treatment maps directly to CSS properties and existing semantic HTML.

The alpha DESIGN.md schema has no normative motion-token namespace, so the exact CSS values are specified in the Components section: routine duration `160ms`, board crossfade `180ms`, win ripple `500ms`, routine easing `cubic-bezier(0.2, 0.8, 0.2, 1)`, and exit easing `cubic-bezier(0.4, 0, 1, 1)`. Standard color, type, and component tokens remain available in `tokens.json`.

## Colors

- **Canvas** is warm oat rather than pure white, reducing glare and separating the game from the site chrome.
- **Surface** is nearly white, keeping the board crisp without harsh contrast.
- **Primary** is a dark dusty evergreen. Pastel primary buttons with white text would fail contrast, so the main action uses the deeper anchor color while surrounding states remain pastel.
- **Muted surfaces** use sage-gray, never bluish dashboard gray.
- **Shape colors** are softened but deliberately not washed out. Shape identity must never rely on color: all nine silhouettes remain geometrically distinct.
- **Error and success** combine tint, icon/text, and border treatment. Red or green alone is never the only signal.

The nine shape colors, in symbol order, are coral, blue, rose, honey, sage, lavender, apricot, teal, and indigo.

## Typography

Use only system fonts so the game remains consistent and fully available offline after load.

- The title uses `ui-rounded` where supported, falling back to the system sans. It is friendly through form, not ornament.
- Body and controls use the system UI sans for legibility.
- Avoid all-caps except the small eyebrow label. Labels use sentence case.
- Do not introduce a display webfont, outlined lettering, handwriting, or text shadows.

## Layout

- Center a single game panel at a maximum width of 800px.
- Keep the title and size selector on one row when space permits; stack them below 544px.
- Preserve a minimum 44px target for every interactive control.
- Palette tiles wrap naturally and remain equal height. They are controls, not collectible cards.
- The board remains square and centered. Use an 8px outer gutter between the board frame and cells.
- Replace the current status line's reserved low baseline with a fixed-height status slot that centers its contents vertically. An empty slot remains visually neutral rather than leaving a low phantom line. The slot must not collapse, because error text must not move the board or actions.
- At 9×9 mobile size, prioritize the board: reduce cell padding and hide palette text labels visually while preserving accessible names.

## Elevation & Depth

Use depth sparingly:

- One soft shadow beneath the main panel.
- One smaller shadow for selected or lifted palette controls.
- No gradients, glass blur, inset bevels, or layered card stacks.
- Hover movement is limited to 1px; selection is communicated primarily by border/ring and color.
- The win dialog is the only layer allowed to use the stronger `dialog` shadow.

## Shapes

- Corners are softly rounded, not pill-shaped everywhere.
- The panel uses an 18px radius; controls use 12px; cells use 8px with visible gaps.
- Board cells are separate tiles on a muted board bed rather than a heavy spreadsheet grid.
- Clues use a flat sage tint plus a subtle lock marker or heavier inner outline; do not use diagonal hatching.
- Shape SVGs retain their current geometry. Remove heavy drop shadows; use at most a 1px translucent grounding shadow.

## Components

### Game panel

A single warm-white surface on the oat canvas. Keep the header, instruction, palette, board, status slot, and actions in one vertical flow. Avoid nested cards.

### Size selector

Use the same 44px height, 12px radius, and border language as secondary buttons. Its focus ring uses `focus`, not the shape palette colors.

### Palette tiles

Default tiles use `surface-muted` with a 1px border. Selected tiles use `primary-soft`, a 2px `primary` border, and the `selected` ring. Dragging lowers opacity but does not shrink enough to make the target jump.

### Board

Use `surface-muted` as the board bed with 2px gaps between cells. Cells use `surface`; clues use `surface-clue`. The board has a 12px radius and a 1px `border-strong` outline. There are no dark grid bars.

### Actions

`New Puzzle` is the only primary action. Hint and Reset are secondary. Keep all three the same height; do not make New Puzzle physically larger.

### Feedback

Conflict feedback tints the attempted cell and direct conflicting cells with `error-soft`, adds an `error` inner outline, and gives one restrained horizontal nudge.

Routine feedback uses the motion tokens consistently:

- Palette selection: 1px lift plus the selected ring.
- Drag start/end: lift and opacity only; tile layout does not change.
- Place: shape fades and scales from 0.88 to 1.
- Replace: old shape exits quickly, then the replacement enters; the cell itself does not move.
- Erase: shape fades and scales to 0.88.
- Hint: the filled cell receives one soft `primary-soft` halo that resolves within 500ms.
- Reset and New Puzzle: crossfade the board as one unit; do not cascade cells.
- Conflict: one restrained 2px horizontal nudge and a short error tint.

All routine effects last 120–180ms. Reset, New Puzzle, size change, and component destruction cancel pending motion and dialog timers. Under `prefers-reduced-motion: reduce`, remove transforms and crossfades, retain immediate color/state feedback, skip the completion wave, and open the dialog immediately.

### Win dialog

When the final cell is completed—whether by the child or Hint—a 500ms success tint ripples outward from that final cell by Manhattan distance. The board remains readable and no particles are introduced. After the ripple, open a native modal dialog once for that completed puzzle.

The dialog contains a simple check seal, **“You did it!”**, and “Every shape found its place.” It has two actions:

- **New Puzzle** — primary; closes the dialog and generates a puzzle at the current size.
- **Look at my puzzle** — secondary; closes the dialog and leaves the completed board visible.

Escape behaves like “Look at my puzzle.” Clicking the backdrop does not dismiss. Trap focus while open and restore focus to the control that preceded the dialog. Once dismissed, the dialog does not reopen for the same completed puzzle; the normal New Puzzle action below the board remains available.

## Do's and Don'ts

**Do**

- Use whitespace and alignment as the primary visual system.
- Keep one dark anchor color for readable high-emphasis actions.
- Preserve semantic buttons, visible focus, accessible labels, and reduced-motion behavior.
- Use the platform dialog semantics and verify keyboard focus entry, containment, Escape dismissal, and restoration.
- Test at 390px and with every grid size from 3 through 9.
- Keep shape recognition independent of color.

**Don't**

- Do not use gradients, glassmorphism, neon colors, or oversized shadows.
- Do not add decorative plants, clouds, mascots, textures, or illustrations to sell the “garden” name.
- Do not make every surface a card.
- Do not use pale text on pastel backgrounds.
- Do not animate clues during routine play, pulse the whole board indiscriminately, or celebrate with motion that delays the next action.
- Do not add sound, confetti, a mascot, stats, or backdrop-click dismissal.
