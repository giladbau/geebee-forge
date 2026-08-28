<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		applyHint,
		applyMove,
		generatePuzzle,
		isCompleteAndValid,
		resetBoard,
		type Cell,
	} from '$lib/shape-sudoku';
	import ShapeIcon, { SHAPES } from './ShapeIcon.svelte';

	const MOTION = {
		routine: 160,
		board: 180,
		ripple: 500,
	} as const;

	const quietGardenTokens = {
		'--color-primary': '#315F5A',
		'--color-primary-hover': '#274D49',
		'--color-primary-soft': '#DDECE7',
		'--color-canvas': '#F5F2EC',
		'--color-surface': '#FFFEFB',
		'--color-surface-muted': '#EEF3F0',
		'--color-surface-clue': '#E5ECE8',
		'--color-text': '#263331',
		'--color-text-muted': '#586966',
		'--color-border': '#C6D2CD',
		'--color-border-strong': '#7F9690',
		'--color-focus': '#416F9D',
		'--color-error': '#944040',
		'--color-error-soft': '#F7DEDC',
		'--color-success': '#39745E',
		'--color-success-soft': '#DDEDE5',
		'--color-overlay': 'rgba(38, 51, 49, 0.42)',
		'--color-shape-coral': SHAPES[0].color,
		'--color-shape-blue': SHAPES[1].color,
		'--color-shape-rose': SHAPES[2].color,
		'--color-shape-honey': SHAPES[3].color,
		'--color-shape-sage': SHAPES[4].color,
		'--color-shape-lavender': SHAPES[5].color,
		'--color-shape-apricot': SHAPES[6].color,
		'--color-shape-teal': SHAPES[7].color,
		'--color-shape-indigo': SHAPES[8].color,
	// The nine --color-shape-* tokens mirror the SHAPES registry so DESIGN.md exports a complete palette.
	// They are consumed indirectly through ShapeIcon.svelte; explicit CSS usage is optional.

		'--radius-sm': '8px',
		'--radius-md': '12px',
		'--radius-lg': '18px',
		'--radius-pill': '999px',
		'--space-xs': '4px',
		'--space-sm': '8px',
		'--space-md': '16px',
		'--space-lg': '24px',
		'--space-xl': '32px',
		'--shadow-panel': '0 16px 44px rgba(49, 95, 90, 0.10)',
		'--shadow-raised': '0 5px 14px rgba(49, 95, 90, 0.09)',
		'--shadow-selected': '0 0 0 3px rgba(49, 95, 90, 0.18)',
		'--shadow-dialog': '0 24px 72px rgba(38, 51, 49, 0.22)',
		'--motion-routine': `${MOTION.routine}ms`,
		'--motion-board': `${MOTION.board}ms`,
		'--motion-ripple': `${MOTION.ripple}ms`,
		'--ease-routine': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
		'--ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
	} as const;
	const quietGardenStyle = Object.entries(quietGardenTokens)
		.map(([property, value]) => `${property}: ${value}`)
		.join('; ');
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

	const initialPuzzle = generatePuzzle(4);
	let size = $state(4);
	let puzzle = $state(initialPuzzle);
	let board = $state(resetBoard(initialPuzzle));
	let selectedSymbol = $state<Cell | undefined>(undefined);
	let feedback = $state('');
	let conflictCells = $state<string[]>([]);
	let draggingSymbol = $state<number | null>(null);
	let boardEffect = $state<'reset' | 'new-puzzle' | 'size-change' | null>(null);
	let completionOrigin = $state<{ row: number; column: number } | null>(null);
	let prefersReducedMotion = $state(
		typeof window !== 'undefined' && typeof window.matchMedia === 'function'
			? window.matchMedia(REDUCED_MOTION_QUERY).matches
			: false,
	);
	let cellEffect = $state<{
		row: number;
		column: number;
		kind: 'place' | 'replace' | 'erase' | 'hint';
		key: number;
		previousSymbol: number | null;
	} | null>(null);
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	let conflictTimer: ReturnType<typeof setTimeout> | undefined;
	let cellEffectTimer: ReturnType<typeof setTimeout> | undefined;
	let boardEffectTimer: ReturnType<typeof setTimeout> | undefined;
	let completionTimer: ReturnType<typeof setTimeout> | undefined;
	let winDialog: HTMLDialogElement | undefined;
	let dialogNewPuzzleButton: HTMLButtonElement | undefined;
	let gridElement: HTMLDivElement | undefined;
	let focusBeforeDialog: HTMLElement | null = null;
	let dialogShownForPuzzle = false;
	const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
	let effectKey = 0;
	const paletteShapes = $derived(SHAPES.slice(0, size));
	const RIPPLE_CELL_DURATION_MS = MOTION.board;
	const RIPPLE_WINDOW_MS = MOTION.ripple;

	function schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
		let timer: ReturnType<typeof setTimeout>;
		timer = setTimeout(() => {
			pendingTimers.delete(timer);
			callback();
		}, delay);
		pendingTimers.add(timer);
		return timer;
	}

	function cancelTimer(timer: ReturnType<typeof setTimeout> | undefined): void {
		if (!timer) return;
		clearTimeout(timer);
		pendingTimers.delete(timer);
	}

	function cancelAllTimers(): void {
		for (const timer of pendingTimers) clearTimeout(timer);
		pendingTimers.clear();
		feedbackTimer = undefined;
		conflictTimer = undefined;
		cellEffectTimer = undefined;
		boardEffectTimer = undefined;
		completionTimer = undefined;
	}

	function completionRippleDelay(row: number, column: number): string | undefined {
		if (!completionOrigin || prefersReducedMotion) return undefined;
		const distance = Math.abs(row - completionOrigin.row) + Math.abs(column - completionOrigin.column);
		const lastRow = size - 1;
		const maxDistance = Math.max(
			completionOrigin.row + completionOrigin.column,
			completionOrigin.row + (lastRow - completionOrigin.column),
			(lastRow - completionOrigin.row) + completionOrigin.column,
			(lastRow - completionOrigin.row) + (lastRow - completionOrigin.column),
		);
		if (maxDistance === 0) return '0ms';
		return `${Math.round(
			(distance * (RIPPLE_WINDOW_MS - RIPPLE_CELL_DURATION_MS)) / maxDistance,
		)}ms`;
	}

	function clearFeedback(): void {
		feedback = '';
		conflictCells = [];
		cancelTimer(feedbackTimer);
		cancelTimer(conflictTimer);
		feedbackTimer = undefined;
		conflictTimer = undefined;
	}

	function startCellEffect(
		row: number,
		column: number,
		kind: 'place' | 'replace' | 'erase' | 'hint',
		previousSymbol: number | null,
	): void {
		cancelTimer(cellEffectTimer);
		cellEffect = { row, column, kind, key: ++effectKey, previousSymbol };
		cellEffectTimer = schedule(() => {
			cellEffect = null;
			cellEffectTimer = undefined;
		}, kind === 'hint' ? MOTION.ripple : kind === 'replace' ? MOTION.board : MOTION.routine);
	}

	function startBoardEffect(kind: 'reset' | 'new-puzzle' | 'size-change'): void {
		cancelAllTimers();
		cellEffect = null;
		feedback = '';
		conflictCells = [];
		draggingSymbol = null;
		completionOrigin = null;
		boardEffect = null;
		if (prefersReducedMotion) return;
		boardEffect = kind;
		boardEffectTimer = schedule(() => {
			boardEffect = null;
			boardEffectTimer = undefined;
		}, MOTION.board);
	}

	function startNewPuzzle(effect: 'new-puzzle' | 'size-change' = 'new-puzzle'): void {
		dialogShownForPuzzle = false;
		puzzle = generatePuzzle(size);
		board = resetBoard(puzzle);
		selectedSymbol = undefined;
		clearFeedback();
		startBoardEffect(effect);
	}

	function resetPuzzle(): void {
		board = resetBoard(puzzle);
		selectedSymbol = undefined;
		clearFeedback();
		startBoardEffect('reset');
	}

	function closeDialogElement(): void {
		if (!winDialog?.open) return;
		if (typeof winDialog.close === 'function') winDialog.close();
		else winDialog.removeAttribute('open');
	}

	function dismissWinDialog(restoreFocus = true): void {
		closeDialogElement();
		if (restoreFocus) focusBeforeDialog?.focus();
	}

	function trapDialogFocus(event: KeyboardEvent): void {
		if (event.key !== 'Tab' || !winDialog?.open) return;
		const controls = [...winDialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
		const first = controls[0];
		const last = controls.at(-1);
		if (!first || !last) return;
		const activeElement = document.activeElement;
		if (event.shiftKey && (activeElement === first || !winDialog.contains(activeElement))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (activeElement === last || !winDialog.contains(activeElement))) {
			event.preventDefault();
			first.focus();
		}
	}

	function showWinDialog(): void {
		completionTimer = undefined;
		if (!winDialog || dialogShownForPuzzle || !isCompleteAndValid(board)) return;
		dialogShownForPuzzle = true;
		focusBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (typeof winDialog.showModal === 'function') {
			try {
				winDialog.showModal();
			} catch {
				winDialog.setAttribute('open', '');
			}
		} else {
			winDialog.setAttribute('open', '');
		}
		dialogNewPuzzleButton?.focus();
	}

	function beginCompletion(row: number, column: number): void {
		if (completionOrigin !== null || dialogShownForPuzzle) return;
		completionOrigin = { row, column };
		cancelTimer(completionTimer);
		if (prefersReducedMotion) showWinDialog();
		else completionTimer = schedule(showWinDialog, RIPPLE_WINDOW_MS);
	}

	function startNewPuzzleFromDialog(): void {
		dismissWinDialog(false);
		startNewPuzzle();
		queueMicrotask(() => {
			gridElement?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
		});
	}

	function revealHint(): void {
		const previousBoard = board;
		const nextBoard = applyHint(puzzle, board);
		board = nextBoard;
		clearFeedback();
		for (let row = 0; row < puzzle.size; row += 1) {
			for (let column = 0; column < puzzle.size; column += 1) {
				if (previousBoard[row][column] !== nextBoard[row][column]) {
					startCellEffect(row, column, 'hint', previousBoard[row][column]);
					if (!isCompleteAndValid(previousBoard) && isCompleteAndValid(nextBoard)) {
						beginCompletion(row, column);
					}
					return;
				}
			}
		}
	}

	function placeSymbol(row: number, column: number, symbol: Cell | undefined = selectedSymbol): void {
		if (symbol === undefined) return;
		const previousCell = board[row][column];
		const previousBoard = board;
		const nextBoard = applyMove(puzzle, board, row, column, symbol);
		if (nextBoard) {
			board = nextBoard;
			clearFeedback();
			if (
				completionOrigin === null &&
				!isCompleteAndValid(previousBoard) &&
				isCompleteAndValid(nextBoard)
			) {
				beginCompletion(row, column);
			}
			if (previousCell === null && symbol !== null) {
				startCellEffect(row, column, 'place', previousCell);
			} else if (previousCell !== null && symbol !== null) {
				startCellEffect(row, column, 'replace', previousCell);
			} else if (previousCell !== null && symbol === null) {
				startCellEffect(row, column, 'erase', previousCell);
			}
			return;
		}

		feedback = "That shape doesn't fit there.";
		const conflicts = new Set([`${row}-${column}`]);
		if (symbol !== null) {
			for (let index = 0; index < puzzle.size; index += 1) {
				if (board[row][index] === symbol) conflicts.add(`${row}-${index}`);
				if (board[index][column] === symbol) conflicts.add(`${index}-${column}`);
			}
		}
		conflictCells = [...conflicts];
		cancelTimer(conflictTimer);
		conflictTimer = schedule(() => {
			conflictCells = [];
			conflictTimer = undefined;
		}, MOTION.routine);
		cancelTimer(feedbackTimer);
		feedbackTimer = schedule(() => {
			feedback = '';
			feedbackTimer = undefined;
		}, 1400);
		// The 1400ms dwell is intentionally longer than the 120-180ms routine effects:
		// it gives children time to read the error without pulsing the board.
	}

	function startDrag(event: DragEvent, symbol: number): void {
		selectedSymbol = symbol;
		draggingSymbol = symbol;
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('text/plain', String(symbol));
	}

	function allowDrop(event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function dropShape(event: DragEvent, row: number, column: number): void {
		event.preventDefault();
		const payload = event.dataTransfer?.getData('text/plain') ?? '';
		if (!/^\d+$/.test(payload)) return;
		placeSymbol(row, column, Number(payload));
		draggingSymbol = null;
	}

	onDestroy(() => {
		cancelAllTimers();
	});

	onMount(() => {
		if (typeof window.matchMedia !== 'function') return;
		const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
		const updatePreference = (event: MediaQueryListEvent | MediaQueryList): void => {
			prefersReducedMotion = event.matches;
			if (!event.matches) return;
			cancelTimer(boardEffectTimer);
			boardEffectTimer = undefined;
			boardEffect = null;
			if (completionTimer) {
				cancelTimer(completionTimer);
				completionTimer = undefined;
				showWinDialog();
			}
		};
		updatePreference(mediaQuery);
		mediaQuery.addEventListener('change', updatePreference);
		return () => mediaQuery.removeEventListener('change', updatePreference);
	});
</script>

<main class="game-shell" style={quietGardenStyle} data-reduced-motion={prefersReducedMotion}>
	<section class="game-panel" aria-labelledby="shape-sudoku-title">
		<header>
			<div>
				<p class="eyebrow">A picture puzzle for curious minds</p>
				<h1 id="shape-sudoku-title">Shape Sudoku</h1>
			</div>
			<label>
				<span>Grid size</span>
				<select
					aria-label="Grid size"
					value={size}
					onchange={(event) => {
						size = Number(event.currentTarget.value);
						startNewPuzzle('size-change');
					}}
				>
					{#each Array.from({ length: 7 }, (_, index) => index + 3) as option}
						<option value={option}>{option} × {option}</option>
					{/each}
				</select>
			</label>
		</header>
		<p class="instructions" id="shape-sudoku-instructions">
			Put each shape once in every row and column. Pick a shape, then pick a square.
		</p>

		<div class="palette" role="group" aria-label="Shape palette">
			{#each paletteShapes as shape, symbol}
				<button
					type="button"
					class:selected={selectedSymbol === symbol}
					class:dragging={draggingSymbol === symbol}
					aria-pressed={selectedSymbol === symbol}
					aria-label={`Select ${shape.name} shape`}
					onclick={() => (selectedSymbol = symbol)}
					draggable={true}
					ondragstart={(event) => startDrag(event, symbol)}
					ondragend={() => (draggingSymbol = null)}
				>
					<span class="palette-icon"><ShapeIcon {symbol} /></span>
					<span>{shape.name === 'faceted heart' ? 'Heart' : shape.name}</span>
				</button>
			{/each}
			<button
				type="button"
				class:selected={selectedSymbol === null}
				aria-label="Select eraser"
				aria-pressed={selectedSymbol === null}
				onclick={() => (selectedSymbol = null)}
			>
				<span class="eraser" aria-hidden="true">⌫</span>
				<span>eraser</span>
			</button>
		</div>

		<div
			bind:this={gridElement}
			class="grid"
			data-board-effect={boardEffect ?? undefined}
			data-completion-origin={completionOrigin
				? `${completionOrigin.row}-${completionOrigin.column}`
				: undefined}
			role="group"
			aria-label={`${size} by ${size} Shape Sudoku grid`}
			aria-describedby="shape-sudoku-instructions"
			style={`--grid-size: ${size}`}
		>
			{#each board as row, rowIndex}
				{#each row as cell, columnIndex}
					{@const isClue = puzzle.clues[rowIndex][columnIndex]}
					{@const activeCellEffect = cellEffect?.row === rowIndex && cellEffect.column === columnIndex}
					<button
						type="button"
						class:clue={isClue}
						class:conflict={conflictCells.includes(`${rowIndex}-${columnIndex}`)}
						class:effect-place={activeCellEffect && cellEffect?.kind === 'place'}
						class:effect-replace={activeCellEffect && cellEffect?.kind === 'replace'}
						class:effect-erase={activeCellEffect && cellEffect?.kind === 'erase'}
						class:effect-hint={activeCellEffect && cellEffect?.kind === 'hint'}
						class:completion-ripple={completionOrigin !== null && !prefersReducedMotion}
						style:--ripple-delay={completionRippleDelay(rowIndex, columnIndex)}
						disabled={isClue}
						onclick={() => placeSymbol(rowIndex, columnIndex)}
						ondragover={allowDrop}
						ondrop={(event) => dropShape(event, rowIndex, columnIndex)}
						aria-label={isClue
							? `Locked ${SHAPES[cell!].name} clue, row ${rowIndex + 1}, column ${columnIndex + 1}`
							: cell === null
								? `Empty cell, row ${rowIndex + 1}, column ${columnIndex + 1}`
								: `${SHAPES[cell].name}, row ${rowIndex + 1}, column ${columnIndex + 1}`}
					>
						{#if activeCellEffect && (cellEffect?.kind === 'replace' || cellEffect?.kind === 'erase') && cellEffect.previousSymbol !== null}
							<span class="shape-layer previous-shape" aria-hidden="true">
								<ShapeIcon symbol={cellEffect.previousSymbol} />
							</span>
						{/if}
						{#if cell !== null}
							{#key `${rowIndex}-${columnIndex}-${cell}-${activeCellEffect ? cellEffect?.key : 0}`}
								<span
									class="shape-layer current-shape"
									data-effect-key={`${rowIndex}-${columnIndex}-${cell}-${activeCellEffect ? cellEffect?.key : 0}`}
								>
									<ShapeIcon symbol={cell} />
								</span>
							{/key}
						{/if}
					</button>
				{/each}
			{/each}
		</div>
		<p class="status-slot" role="status" aria-live="polite">
			{#if feedback}<span>{feedback}</span>{/if}
		</p>

		<div class="actions">
			<button type="button" onclick={revealHint}>Hint</button>
			<button type="button" onclick={resetPuzzle}>Reset</button>
			<button type="button" class="primary" onclick={() => startNewPuzzle()}>New Puzzle</button>
		</div>

		<dialog
			bind:this={winDialog}
			aria-labelledby="win-dialog-title"
			aria-describedby="win-dialog-description"
			onkeydown={trapDialogFocus}
			oncancel={(event) => {
				event.preventDefault();
				dismissWinDialog();
			}}
		>
			<span class="win-check-seal" data-testid="win-check-seal" aria-hidden="true">✓</span>
			<h2 id="win-dialog-title">You did it!</h2>
			<p id="win-dialog-description">Every shape found its place.</p>
			<div class="dialog-actions">
				<button
					bind:this={dialogNewPuzzleButton}
					type="button"
					class="primary"
					onclick={startNewPuzzleFromDialog}
				>
					New Puzzle
				</button>
				<button type="button" onclick={() => dismissWinDialog()}>Look at my puzzle</button>
			</div>
		</dialog>
	</section>
</main>

<style>
	.game-shell {
		min-height: 100vh;
		padding: 68px var(--space-lg) 64px;
		color: var(--color-text);
		background: var(--color-canvas);
		font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 0.95rem;
		font-weight: 450;
		line-height: 1.5;
	}

	.game-panel {
		width: min(100%, 50rem);
		margin: 0 auto;
		padding: var(--space-xl);
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-panel);
	}

	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--space-lg);
	}

	h1 {
		margin: 0;
		font-family: ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: clamp(2.125rem, 5vw, 3rem);
		font-weight: 750;
		line-height: 1;
		letter-spacing: -0.035em;
	}

	.eyebrow {
		margin: 0 0 7px;
		color: var(--color-text-muted);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	header label {
		display: grid;
		flex: 0 0 auto;
		gap: 6px;
		color: var(--color-text-muted);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.06em;
	}

	select,
	.palette button,
	.actions button {
		height: 44px;
		font: inherit;
	}

	select {
		padding: 0 38px 0 13px;
		color: var(--color-text);
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.88rem;
		font-weight: 650;
		line-height: 1.2;
	}

	.instructions {
		margin: 20px 0 var(--space-md);
		color: var(--color-text-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.palette,
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
	}

	.palette {
		margin: 0 0 18px;
	}

	.palette button {
		display: grid;
		width: 76px;
		height: 64px;
		padding: var(--space-sm);
		place-items: center;
		gap: 2px;
		color: var(--color-text-muted);
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		font-weight: 650;
		line-height: 1.2;
		text-transform: capitalize;
		cursor: grab;
		transition:
			transform var(--motion-routine) var(--ease-routine),
			opacity var(--motion-routine) var(--ease-routine),
			border-color var(--motion-routine) var(--ease-routine),
			background-color var(--motion-routine) var(--ease-routine),
			box-shadow var(--motion-routine) var(--ease-routine);
		touch-action: manipulation;
	}

	.palette button:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-raised);
	}

	.palette button.selected {
		color: var(--color-text);
		background: var(--color-primary-soft);
		border: 2px solid var(--color-primary);
		box-shadow: var(--shadow-selected);
		transform: translateY(-1px);
	}

	.palette button.dragging {
		opacity: 0.6;
		transform: translateY(-1px);
	}

	.palette-icon,
	.eraser {
		width: 34px;
		height: 34px;
	}

	.eraser {
		display: grid;
		place-items: center;
		font-size: 1.625rem;
		line-height: 1;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		width: min(100%, 31.25rem);
		aspect-ratio: 1;
		margin: 0 auto;
		padding: var(--space-sm);
		overflow: hidden;
		gap: 2px;
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
	}

	.grid[data-board-effect] {
		animation: board-crossfade var(--motion-board) var(--ease-routine);
	}

	.grid button {
		position: relative;
		display: grid;
		min-width: 0;
		min-height: 0;
		padding: 6px;
		place-items: center;
		background: var(--color-surface);
		border: 0;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			background-color var(--motion-routine) var(--ease-routine),
			box-shadow var(--motion-routine) var(--ease-routine);
		touch-action: manipulation;
	}

	.grid button:not(.clue):hover {
		z-index: 1;
		background: var(--color-primary-soft);
		box-shadow: inset 0 0 0 2px var(--color-primary);
	}

	.grid button.clue {
		background: var(--color-surface-clue);
		cursor: not-allowed;
	}

	.grid button.clue::after {
		position: absolute;
		top: 7px;
		right: 7px;
		width: 5px;
		height: 5px;
		background: var(--color-border-strong);
		border-radius: 50%;
		content: '';
		opacity: 0.7;
	}

	.shape-layer {
		display: block;
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
	}

	.grid button.effect-place .shape-layer {
		animation: shape-enter var(--motion-routine) var(--ease-routine);
	}

	.grid button.effect-replace .previous-shape {
		animation: shape-exit 120ms var(--ease-exit) forwards;
	}

	.grid button.effect-replace .current-shape {
		opacity: 0;
		animation: shape-enter 120ms 60ms var(--ease-routine) forwards;
	}

	.grid button.effect-erase .previous-shape {
		animation: shape-exit var(--motion-routine) var(--ease-exit) forwards;
	}

	.grid button.effect-hint {
		animation: hint-halo var(--motion-ripple) var(--ease-routine);
	}

	.grid button.completion-ripple {
		animation: completion-cell-ripple var(--motion-board) var(--ripple-delay) var(--ease-routine);
	}

	.grid button.conflict {
		z-index: 2;
		color: var(--color-error);
		background: var(--color-error-soft);
		box-shadow: inset 0 0 0 2px var(--color-error);
		animation: conflict-nudge var(--motion-routine) var(--ease-routine);
	}

	button:focus-visible,
	select:focus-visible {
		position: relative;
		z-index: 3;
		outline: 3px solid var(--color-focus);
		outline-offset: 3px;
	}

	.status-slot {
		display: grid;
		height: 40px;
		margin: 0;
		place-items: center;
	}

	.status-slot span {
		padding: var(--space-sm);
		color: var(--color-error);
		background: var(--color-error-soft);
		border-radius: var(--radius-pill);
		font-size: 0.88rem;
		font-weight: 650;
		line-height: 1.2;
		text-align: center;
	}

	dialog {
		width: min(calc(100vw - 32px), 360px);
		padding: var(--space-xl);
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-dialog);
		font: inherit;
		text-align: center;
	}

	dialog::backdrop {
		background: var(--color-overlay);
	}

	.win-check-seal {
		display: grid;
		width: 48px;
		height: 48px;
		margin: 0 auto var(--space-md);
		place-items: center;
		color: var(--color-success);
		background: var(--color-success-soft);
		border: 2px solid var(--color-success);
		border-radius: 50%;
		font-size: 1.5rem;
		font-weight: 700;
	}

	dialog h2 {
		margin: 0;
		font-family: ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 1.75rem;
		font-weight: 750;
		line-height: 1;
		letter-spacing: -0.035em;
	}

	dialog p {
		margin: var(--space-md) 0 var(--space-lg);
		color: var(--color-text-muted);
	}

	.dialog-actions {
		display: grid;
		gap: var(--space-sm);
	}

	.dialog-actions button {
		height: 44px;
		padding: 0 18px;
		color: var(--color-text);
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font: 650 0.88rem/1.2 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
		cursor: pointer;
	}

	.dialog-actions button:hover {
		background: var(--color-primary-soft);
	}

	.dialog-actions button.primary {
		color: var(--color-surface);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.dialog-actions button.primary:hover {
		background: var(--color-primary-hover);
		border-color: var(--color-primary-hover);
	}

	.actions {
		gap: 9px;
		margin-top: 0;
	}

	.actions button {
		padding: 0 18px;
		color: var(--color-text);
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.88rem;
		font-weight: 650;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background-color var(--motion-routine) var(--ease-routine),
			border-color var(--motion-routine) var(--ease-routine);
	}

	.actions button:hover {
		background: var(--color-primary-soft);
	}

	.actions button.primary {
		color: var(--color-surface);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.actions button.primary:hover {
		background: var(--color-primary-hover);
		border-color: var(--color-primary-hover);
	}

	@keyframes conflict-nudge {
		0%, 100% { transform: translateX(0); }
		35% { transform: translateX(-2px); }
		65% { transform: translateX(2px); }
	}

	@keyframes shape-enter {
		from {
			opacity: 0;
			transform: scale(0.88);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes shape-exit {
		to {
			opacity: 0;
			transform: scale(0.88);
		}
	}

	@keyframes hint-halo {
		0%, 45% {
			background: var(--color-primary-soft);
			box-shadow: inset 0 0 0 3px rgba(49, 95, 90, 0.18);
		}
		100% {
			background: var(--color-surface);
			box-shadow: none;
		}
	}

	@keyframes board-crossfade {
		from { opacity: 0.55; }
		to { opacity: 1; }
	}

	@keyframes completion-cell-ripple {
		0%, 60% {
			background: var(--color-success-soft);
			box-shadow: inset 0 0 0 2px var(--color-success);
		}
		100% {
			background: var(--color-surface);
			box-shadow: none;
		}
	}

	@media (max-width: 544px) {
		.game-shell {
			padding: 60px 10px var(--space-lg);
		}

		.game-panel {
			padding: 22px 14px 20px;
		}

		header {
			align-items: start;
			flex-direction: column;
			gap: 14px;
		}

		header label,
		select {
			width: 100%;
		}

		.instructions {
			margin-top: var(--space-md);
		}

		.palette {
			gap: 6px;
		}

		.palette button {
			width: 58px;
			height: 58px;
			padding: 6px;
			font-size: 0;
		}

		.palette-icon,
		.eraser {
			width: 32px;
			height: 32px;
		}

		.grid {
			padding: 6px;
		}

		.grid button {
			padding: clamp(1px, 1.25vw, 6px);
			border-radius: 5px;
		}

		.grid button.clue::after {
			top: 4px;
			right: 4px;
			width: 4px;
			height: 4px;
		}

		.actions button {
			flex: 1;
			padding-inline: var(--space-sm);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.palette button,
		.grid button,
		.actions button {
			transition: none;
		}

		.palette button:hover,
		.palette button.selected,
		.palette button.dragging {
			transform: none;
		}

		.grid button.conflict {
			animation: none;
		}

		.grid button.effect-place .shape-layer,
		.grid button.effect-replace .previous-shape,
		.grid button.effect-replace .current-shape,
		.grid button.effect-erase .previous-shape {
			animation: none;
			opacity: 1;
		}

		.grid button.effect-hint {
			animation: none;
			background: var(--color-primary-soft);
		}

		.grid[data-board-effect] {
			animation: none;
		}

		.grid button.completion-ripple {
			animation: none;
		}
	}
</style>
