<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		applyHint,
		applyMove,
		generatePuzzle,
		isCompleteAndValid,
		resetBoard,
		type Cell,
	} from '$lib/shape-sudoku';
	import ShapeIcon, { SHAPES } from './ShapeIcon.svelte';

	const initialPuzzle = generatePuzzle(4);
	let size = $state(4);
	let puzzle = $state(initialPuzzle);
	let board = $state(resetBoard(initialPuzzle));
	let selectedSymbol = $state<Cell | undefined>(undefined);
	let feedback = $state('');
	let conflictCells = $state<string[]>([]);
	let draggingSymbol = $state<number | null>(null);
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	const paletteShapes = $derived(SHAPES.slice(0, size));
	const isComplete = $derived(isCompleteAndValid(board));

	function clearFeedback(): void {
		feedback = '';
		conflictCells = [];
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = undefined;
	}

	function startNewPuzzle(): void {
		puzzle = generatePuzzle(size);
		board = resetBoard(puzzle);
		selectedSymbol = undefined;
		clearFeedback();
	}

	function resetPuzzle(): void {
		board = resetBoard(puzzle);
		selectedSymbol = undefined;
		clearFeedback();
	}

	function revealHint(): void {
		board = applyHint(puzzle, board);
		clearFeedback();
	}

	function placeSymbol(row: number, column: number, symbol: Cell | undefined = selectedSymbol): void {
		if (symbol === undefined) return;
		const nextBoard = applyMove(puzzle, board, row, column, symbol);
		if (nextBoard) {
			board = nextBoard;
			feedback = '';
			conflictCells = [];
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
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => {
			feedback = '';
			conflictCells = [];
		}, 1400);
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
		if (feedbackTimer) clearTimeout(feedbackTimer);
	});
</script>

<main class="game-shell">
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
						startNewPuzzle();
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
					<span>{shape.name}</span>
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
			class="grid"
			role="group"
			aria-label={`${size} by ${size} Shape Sudoku grid`}
			aria-describedby="shape-sudoku-instructions"
			style={`--grid-size: ${size}`}
		>
			{#each board as row, rowIndex}
				{#each row as cell, columnIndex}
					{@const isClue = puzzle.clues[rowIndex][columnIndex]}
					<button
						type="button"
						class:clue={isClue}
						class:conflict={conflictCells.includes(`${rowIndex}-${columnIndex}`)}
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
						{#if cell !== null}<ShapeIcon symbol={cell} />{/if}
					</button>
				{/each}
			{/each}
		</div>
		<p class="status" role="status" aria-live="polite">{feedback}</p>
		{#if isComplete}
			<div class="completion" aria-live="polite">
				<span aria-hidden="true">✓</span>
				<strong>You did it!</strong>
			</div>
		{/if}

		<div class="actions">
			<button type="button" onclick={revealHint}>Hint</button>
			<button type="button" onclick={resetPuzzle}>Reset</button>
			<button type="button" class="primary" onclick={startNewPuzzle}>New Puzzle</button>
		</div>
	</section>
</main>

<style>
	.game-shell {
		min-height: 100vh;
		padding: 5.25rem 1rem 3rem;
		background:
			radial-gradient(circle at 20% 10%, rgba(95, 150, 255, 0.17), transparent 32rem),
			radial-gradient(circle at 85% 75%, rgba(217, 79, 157, 0.12), transparent 28rem);
	}

	.game-panel {
		width: min(100%, 50rem);
		margin: 0 auto;
		padding: clamp(1rem, 3vw, 2rem);
		color: #182133;
		background: #fdfefe;
		border: 1px solid rgba(255, 255, 255, 0.65);
		border-radius: 1.25rem;
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.3);
	}

	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 7vw, 3.25rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		color: #58708f;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	header label {
		display: grid;
		flex: 0 0 auto;
		gap: 0.35rem;
		color: #405473;
		font-size: 0.78rem;
		font-weight: 750;
	}

	select,
	.palette button,
	.actions button {
		min-height: 44px;
		font: inherit;
	}

	select {
		padding: 0 2.15rem 0 0.75rem;
		color: #182133;
		background: #fff;
		border: 2px solid #aab8ca;
		border-radius: 0.65rem;
		font-weight: 750;
	}

	.instructions {
		margin: 1.25rem 0 1rem;
		color: #52647d;
		font-size: 0.94rem;
		line-height: 1.45;
	}

	.palette,
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.55rem;
	}

	.palette {
		margin: 0 0 1.1rem;
	}

	.palette button {
		display: grid;
		min-width: 4.25rem;
		padding: 0.5rem 0.65rem;
		place-items: center;
		gap: 0.2rem;
		color: #35465f;
		background: #f4f7fb;
		border: 2px solid #d5deea;
		border-radius: 0.8rem;
		font-size: 0.68rem;
		font-weight: 750;
		text-transform: capitalize;
		cursor: grab;
		transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
		touch-action: manipulation;
	}

	.palette button:hover {
		transform: translateY(-2px);
		border-color: #7b8fab;
	}

	.palette button.selected {
		background: #eaf1ff;
		border-color: #356fdb;
		box-shadow: 0 0 0 2px rgba(53, 111, 219, 0.17);
	}

	.palette button.dragging {
		opacity: 0.58;
		transform: scale(0.96);
	}

	.palette-icon,
	.eraser {
		width: 2.1rem;
		height: 2.1rem;
	}

	.eraser {
		display: grid;
		place-items: center;
		font-size: 1.75rem;
		line-height: 1;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		width: min(100%, 38rem);
		aspect-ratio: 1;
		margin: 0 auto;
		overflow: hidden;
		background: #445673;
		border: 3px solid #26364f;
		border-radius: 0.5rem;
		box-shadow: 0 0.6rem 1.6rem rgba(39, 55, 79, 0.17);
	}

	.grid button {
		min-width: 0;
		min-height: 0;
		padding: clamp(0.14rem, 1.1vw, 0.55rem);
		background: #fff;
		border: 1px solid #56667e;
		border-radius: 0;
		cursor: pointer;
		transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
		touch-action: manipulation;
	}

	.grid button:not(.clue):hover {
		position: relative;
		z-index: 1;
		background: #f2f7ff;
		box-shadow: inset 0 0 0 2px #6f9be5;
	}

	.grid button.clue {
		background:
			linear-gradient(rgba(229, 235, 243, 0.91), rgba(229, 235, 243, 0.91)),
			repeating-linear-gradient(135deg, transparent 0 6px, rgba(77, 94, 120, 0.12) 6px 8px);
		cursor: not-allowed;
	}

	.grid button.conflict {
		position: relative;
		z-index: 2;
		background: #ffe9e7;
		box-shadow: inset 0 0 0 3px #d9473f;
		animation: shake 180ms ease-in-out 2;
	}

	button:focus-visible,
	select:focus-visible {
		position: relative;
		z-index: 3;
		outline: 3px solid #145ec7;
		outline-offset: 3px;
	}

	.status {
		min-height: 1.35rem;
		margin: 0.7rem 0 0;
		color: #b52f2a;
		font-size: 0.9rem;
		font-weight: 750;
		text-align: center;
	}

	.completion {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		margin: 0.2rem 0 0.5rem;
		color: #137344;
		font-size: 1.15rem;
	}

	.completion span {
		display: grid;
		width: 1.65rem;
		height: 1.65rem;
		place-items: center;
		color: #fff;
		background: #1b9360;
		border-radius: 50%;
		font-size: 0.95rem;
	}

	.actions {
		margin-top: 0.45rem;
	}

	.actions button {
		padding: 0.55rem 1rem;
		color: #30435f;
		background: #eef2f7;
		border: 2px solid #c8d2df;
		border-radius: 0.7rem;
		font-weight: 750;
		cursor: pointer;
	}

	.actions button:hover {
		background: #e2e9f2;
		border-color: #8fa1b8;
	}

	.actions button.primary {
		color: #fff;
		background: #2d67c6;
		border-color: #2d67c6;
	}

	.actions button.primary:hover {
		background: #2155aa;
		border-color: #2155aa;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		35% { transform: translateX(-3px); }
		65% { transform: translateX(3px); }
	}

	@media (max-width: 34rem) {
		.game-shell {
			padding: 4.4rem 0.55rem 1.5rem;
		}

		.game-panel {
			padding: 1rem 0.65rem 1.25rem;
			border-radius: 1rem;
		}

		header {
			align-items: start;
		}

		.instructions {
			margin-top: 1rem;
		}

		.palette {
			gap: 0.35rem;
		}

		.palette button {
			min-width: 3.2rem;
			padding: 0.38rem 0.42rem;
			font-size: 0;
		}

		.palette-icon,
		.eraser {
			width: 1.8rem;
			height: 1.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.palette button,
		.grid button {
			transition: none;
		}

		.grid button.conflict {
			animation: none;
		}
	}
</style>
