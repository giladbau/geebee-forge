import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ShapeSudoku from './ShapeSudoku.svelte';
import { SHAPES } from './ShapeIcon.svelte';

async function fillWithValidShape(cell: HTMLElement): Promise<HTMLElement> {
	for (const shapeButton of screen.getAllByRole('button', { name: /Select .* shape/ })) {
		await fireEvent.click(shapeButton);
		await fireEvent.click(cell);
		if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) return shapeButton;
	}
	throw new Error(`No valid shape found for ${cell.getAttribute('aria-label')}`);
}

describe('ShapeSudoku', () => {
	it('uses the nine stable Quiet Garden shape colors in symbol order', () => {
		expect(SHAPES.map((shape) => shape.color)).toEqual([
			'#D97872',
			'#6489C4',
			'#C8759E',
			'#C99C43',
			'#6C9B79',
			'#8976B6',
			'#CE8559',
			'#559995',
			'#7376B5',
		]);
	});

	it('exposes the exact Quiet Garden visual and motion tokens on the game shell', () => {
		const { container } = render(ShapeSudoku);
		const shell = container.querySelector('.game-shell');
		expect(shell).not.toBeNull();
		const styles = getComputedStyle(shell!);
		expect({
			primary: styles.getPropertyValue('--color-primary').trim(),
			canvas: styles.getPropertyValue('--color-canvas').trim(),
			surface: styles.getPropertyValue('--color-surface').trim(),
			text: styles.getPropertyValue('--color-text').trim(),
			focus: styles.getPropertyValue('--color-focus').trim(),
			errorSoft: styles.getPropertyValue('--color-error-soft').trim(),
			radiusSm: styles.getPropertyValue('--radius-sm').trim(),
			radiusMd: styles.getPropertyValue('--radius-md').trim(),
			radiusLg: styles.getPropertyValue('--radius-lg').trim(),
			spaceXs: styles.getPropertyValue('--space-xs').trim(),
			spaceSm: styles.getPropertyValue('--space-sm').trim(),
			spaceMd: styles.getPropertyValue('--space-md').trim(),
			spaceLg: styles.getPropertyValue('--space-lg').trim(),
			spaceXl: styles.getPropertyValue('--space-xl').trim(),
			panelShadow: styles.getPropertyValue('--shadow-panel').trim(),
			routineDuration: styles.getPropertyValue('--motion-routine').trim(),
			boardDuration: styles.getPropertyValue('--motion-board').trim(),
			rippleDuration: styles.getPropertyValue('--motion-ripple').trim(),
			routineEasing: styles.getPropertyValue('--ease-routine').trim(),
			exitEasing: styles.getPropertyValue('--ease-exit').trim(),
		}).toEqual({
			primary: '#315F5A',
			canvas: '#F5F2EC',
			surface: '#FFFEFB',
			text: '#263331',
			focus: '#416F9D',
			errorSoft: '#F7DEDC',
			radiusSm: '8px',
			radiusMd: '12px',
			radiusLg: '18px',
			spaceXs: '4px',
			spaceSm: '8px',
			spaceMd: '16px',
			spaceLg: '24px',
			spaceXl: '32px',
			panelShadow: '0 16px 44px rgba(49, 95, 90, 0.10)',
			routineDuration: '160ms',
			boardDuration: '180ms',
			rippleDuration: '500ms',
			routineEasing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
			exitEasing: 'cubic-bezier(0.4, 0, 1, 1)',
		});
	});

	it('keeps one stable polite status slot before, during, and after conflict feedback', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const statusSlot = screen.getByRole('status');
			expect(statusSlot).toHaveClass('status-slot');
			expect(statusSlot).toHaveAttribute('aria-live', 'polite');
			expect(statusSlot).toBeEmptyDOMElement();

			const target = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
			const position = target.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
			const conflictingClue = screen.getAllByRole('button', { name: /^Locked/ }).find((clue) => {
				const cluePosition = clue.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
				return cluePosition && position &&
					(cluePosition[1] === position[1] || cluePosition[2] === position[2]);
			});
			const conflictingShape = conflictingClue?.getAttribute('aria-label')?.match(/^Locked (.+) clue/)?.[1];
			expect(conflictingShape).toBeDefined();

			await fireEvent.click(screen.getByRole('button', { name: `Select ${conflictingShape} shape` }));
			await fireEvent.click(target);
			expect(screen.getByRole('status')).toBe(statusSlot);
			expect(statusSlot).toHaveTextContent("That shape doesn't fit there.");

			await vi.advanceTimersByTimeAsync(1400);
			expect(screen.getByRole('status')).toBe(statusSlot);
			expect(statusSlot).toBeEmptyDOMElement();
		} finally {
			vi.useRealTimers();
		}
	});

	it('renders the default game controls, four-shape palette, and 4 by 4 grid', () => {
		render(ShapeSudoku);

		const sizeSelect = screen.getByRole('combobox', { name: 'Grid size' });
		expect(sizeSelect).toHaveValue('4');
		expect(within(sizeSelect).getAllByRole('option')).toHaveLength(7);
		expect(screen.getAllByRole('button', { name: /Select .* shape/ })).toHaveLength(4);
		expect(screen.getByRole('button', { name: 'Select eraser' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'New Puzzle' })).toBeInTheDocument();

		const grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
		expect(within(grid).getAllByRole('button')).toHaveLength(16);
	});

	it('keeps the full faceted-heart accessible name while using the compact preview label', () => {
		render(ShapeSudoku);
		const heart = screen.getByRole('button', { name: 'Select faceted heart shape' });
		expect(heart).toHaveAccessibleName('Select faceted heart shape');
		expect(heart.lastElementChild).toHaveTextContent(/^Heart$/);
	});

	it('places a selected reusable shape and clears it with the eraser', async () => {
		render(ShapeSudoku);
		const cell = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
		const shapeButtons = screen.getAllByRole('button', { name: /Select .* shape/ });

		for (const shapeButton of shapeButtons) {
			await fireEvent.click(shapeButton);
			await fireEvent.click(cell);
			if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) break;
		}

		expect(cell).not.toHaveAccessibleName(/^Empty cell/);
		await fireEvent.click(screen.getByRole('button', { name: 'Select eraser' }));
		await fireEvent.click(cell);
		expect(cell).toHaveAccessibleName(/^Empty cell/);
	});

	it('marks a successful empty-cell placement with one transient keyed place effect', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const cell = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
			const shapeButtons = screen.getAllByRole('button', { name: /Select .* shape/ });

			for (const shapeButton of shapeButtons) {
				await fireEvent.click(shapeButton);
				await fireEvent.click(cell);
				if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) break;
			}

			expect(cell).toHaveClass('effect-place');
			expect(cell.querySelector('.shape-layer')).toBeInTheDocument();
			expect(cell.querySelector('.shape-layer')).toHaveAttribute('data-effect-key');
			await vi.advanceTimersByTimeAsync(160);
			expect(cell).not.toHaveClass('effect-place');
		} finally {
			vi.useRealTimers();
		}
	});

	it('records replacement and exits the old keyed shape before the replacement settles', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const cell = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
			const shapeButtons = screen.getAllByRole('button', { name: /Select .* shape/ });

			for (const shapeButton of shapeButtons) {
				await fireEvent.click(shapeButton);
				await fireEvent.click(cell);
				if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) break;
			}
			await vi.advanceTimersByTimeAsync(160);
			const placedShape = cell.getAttribute('aria-label')?.match(/^(.+), row/)?.[1];
			expect(placedShape).toBeDefined();

			await fireEvent.click(screen.getByRole('button', { name: `Select ${placedShape} shape` }));
			await fireEvent.click(cell);
			expect(cell).toHaveClass('effect-replace');
			expect(cell.querySelector('.shape-layer.previous-shape')).toBeInTheDocument();
			expect(cell.querySelector('.shape-layer.current-shape')).toBeInTheDocument();

			await vi.advanceTimersByTimeAsync(180);
			expect(cell).not.toHaveClass('effect-replace');
			expect(cell.querySelector('.previous-shape')).not.toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('erases board state immediately while the removed shape gets a transient erase effect', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const cell = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
			for (const shapeButton of screen.getAllByRole('button', { name: /Select .* shape/ })) {
				await fireEvent.click(shapeButton);
				await fireEvent.click(cell);
				if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) break;
			}
			await vi.advanceTimersByTimeAsync(160);

			await fireEvent.click(screen.getByRole('button', { name: 'Select eraser' }));
			await fireEvent.click(cell);
			expect(cell).toHaveAccessibleName(/^Empty cell/);
			expect(cell).toHaveClass('effect-erase');
			expect(cell.querySelector('.shape-layer.previous-shape')).toBeInTheDocument();

			await vi.advanceTimersByTimeAsync(160);
			expect(cell).not.toHaveClass('effect-erase');
			expect(cell.querySelector('.previous-shape')).not.toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('locks clue cells and identifies their shape and position', () => {
		render(ShapeSudoku);
		const clue = screen.getAllByRole('button', { name: /^Locked .* clue, row \d, column \d$/ })[0];

		expect(clue).toBeDisabled();
		expect(clue).toHaveAccessibleName(/^Locked (triangle|square|faceted heart|star) clue/);
	});

	it('rejects a conflicting move without changing the cell and announces feedback', async () => {
		render(ShapeSudoku);
		const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
		const clues = screen.getAllByRole('button', { name: /^Locked/ });
		let target: HTMLElement | undefined;
		let conflictClue: HTMLElement | undefined;
		let conflictingShape = '';

		for (const empty of emptyCells) {
			const emptyMatch = empty.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
			if (!emptyMatch) continue;
			for (const clue of clues) {
				const clueMatch = clue
					.getAttribute('aria-label')
					?.match(/^Locked (.+) clue, row (\d+), column (\d+)$/);
				if (clueMatch && (clueMatch[2] === emptyMatch[1] || clueMatch[3] === emptyMatch[2])) {
					target = empty;
					conflictClue = clue;
					conflictingShape = clueMatch[1];
					break;
				}
			}
			if (target) break;
		}

		expect(target).toBeDefined();
		expect(conflictClue).toBeDefined();
		await fireEvent.click(screen.getByRole('button', { name: `Select ${conflictingShape} shape` }));
		await fireEvent.click(target!);

		expect(target).toHaveAccessibleName(/^Empty cell/);
		expect(target).toHaveClass('conflict');
		expect(conflictClue).toHaveClass('conflict');
		expect(screen.getByRole('status')).toHaveTextContent("That shape doesn't fit there");
	});

	it('limits attempted and direct-conflict cell feedback to the 160ms routine duration', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const target = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
			const targetPosition = target.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
			const conflictClue = screen.getAllByRole('button', { name: /^Locked/ }).find((clue) => {
				const cluePosition = clue.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
				return targetPosition && cluePosition &&
					(targetPosition[1] === cluePosition[1] || targetPosition[2] === cluePosition[2]);
			});
			const conflictShape = conflictClue?.getAttribute('aria-label')?.match(/^Locked (.+) clue/)?.[1];
			expect(conflictShape).toBeDefined();

			await fireEvent.click(screen.getByRole('button', { name: `Select ${conflictShape} shape` }));
			await fireEvent.click(target);
			expect(target).toHaveClass('conflict');
			expect(conflictClue).toHaveClass('conflict');

			await vi.advanceTimersByTimeAsync(160);
			expect(target).not.toHaveClass('conflict');
			expect(conflictClue).not.toHaveClass('conflict');
			expect(screen.getByRole('status')).toHaveTextContent("That shape doesn't fit there.");
		} finally {
			vi.useRealTimers();
		}
	});

	it('fills one hint, resets to the clues, and regenerates at a selected size', async () => {
		render(ShapeSudoku);
		const initialEmptyNames = screen
			.getAllByRole('button', { name: /^Empty cell/ })
			.map((cell) => cell.getAttribute('aria-label'));

		await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
		expect(screen.getAllByRole('button', { name: /^Empty cell/ })).toHaveLength(
			initialEmptyNames.length - 1,
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
		expect(
			screen.getAllByRole('button', { name: /^Empty cell/ }).map((cell) => cell.getAttribute('aria-label')),
		).toEqual(initialEmptyNames);

		await fireEvent.change(screen.getByRole('combobox', { name: 'Grid size' }), {
			target: { value: '3' },
		});
		const resizedGrid = screen.getByRole('group', { name: '3 by 3 Shape Sudoku grid' });
		expect(within(resizedGrid).getAllByRole('button')).toHaveLength(9);
		expect(screen.getAllByRole('button', { name: /Select .* shape/ })).toHaveLength(3);

		await fireEvent.change(screen.getByRole('combobox', { name: 'Grid size' }), {
			target: { value: '9' },
		});
		expect(screen.getAllByRole('button', { name: /Select .* shape/ }).map((button) => button.getAttribute('aria-label')))
			.toEqual([
				'Select triangle shape',
				'Select square shape',
				'Select faceted heart shape',
				'Select star shape',
				'Select pentagon shape',
				'Select hexagon shape',
				'Select cross shape',
				'Select trapezoid shape',
				'Select arrow shape',
			]);
		expect(within(screen.getByRole('group', { name: '9 by 9 Shape Sudoku grid' })).getAllByRole('button'))
			.toHaveLength(81);
	});

	it('marks the exact newly filled hint cell with one halo that resolves within 500ms', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			const hintedCells = emptyCells.filter(
				(cell) => !cell.getAttribute('aria-label')?.startsWith('Empty cell'),
			);

			expect(hintedCells).toHaveLength(1);
			expect(hintedCells[0]).toHaveClass('effect-hint');
			await vi.advanceTimersByTimeAsync(500);
			expect(hintedCells[0]).not.toHaveClass('effect-hint');
		} finally {
			vi.useRealTimers();
		}
	});

	it('crossfades reset, new puzzle, and size change as one board while clearing cell effects', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			expect(document.querySelector('.effect-hint')).toBeInTheDocument();

			await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
			let grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			expect(grid).toHaveAttribute('data-board-effect', 'reset');
			expect(document.querySelector('.effect-hint')).not.toBeInTheDocument();
			await vi.advanceTimersByTimeAsync(180);
			expect(grid).not.toHaveAttribute('data-board-effect');

			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			await fireEvent.click(screen.getByRole('button', { name: 'New Puzzle' }));
			grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			expect(grid).toHaveAttribute('data-board-effect', 'new-puzzle');
			expect(document.querySelector('.effect-hint')).not.toBeInTheDocument();
			await vi.advanceTimersByTimeAsync(180);

			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			await fireEvent.change(screen.getByRole('combobox', { name: 'Grid size' }), {
				target: { value: '3' },
			});
			grid = screen.getByRole('group', { name: '3 by 3 Shape Sudoku grid' });
			expect(grid).toHaveAttribute('data-board-effect', 'size-change');
			expect(document.querySelector('.effect-hint')).not.toBeInTheDocument();
			await vi.advanceTimersByTimeAsync(180);
			expect(grid).not.toHaveAttribute('data-board-effect');
		} finally {
			vi.useRealTimers();
		}
	});

	it('cancels stale drag presentation state on reset, new puzzle, and size change', async () => {
		render(ShapeSudoku);
		const shape = screen.getAllByRole('button', { name: /Select .* shape/ })[0];
		const dataTransfer = {
			dropEffect: 'none',
			effectAllowed: 'none',
			setData: vi.fn(),
			getData: vi.fn(() => ''),
		};

		await fireEvent.dragStart(shape, { dataTransfer });
		expect(shape).toHaveClass('dragging');
		await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
		expect(document.querySelector('.dragging')).not.toBeInTheDocument();

		await fireEvent.dragStart(shape, { dataTransfer });
		await fireEvent.click(screen.getByRole('button', { name: 'New Puzzle' }));
		expect(document.querySelector('.dragging')).not.toBeInTheDocument();

		const nextShape = screen.getAllByRole('button', { name: /Select .* shape/ })[0];
		await fireEvent.dragStart(nextShape, { dataTransfer });
		await fireEvent.change(screen.getByRole('combobox', { name: 'Grid size' }), {
			target: { value: '3' },
		});
		expect(document.querySelector('.dragging')).not.toBeInTheDocument();
	});

	it('shows a checkmark and completion message after the final correct move', async () => {
		render(ShapeSudoku);
		const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
		const shapeButtons = screen.getAllByRole('button', { name: /Select .* shape/ });

		for (const cell of emptyCells) {
			for (const shapeButton of shapeButtons) {
				await fireEvent.click(shapeButton);
				await fireEvent.click(cell);
				if (!cell.getAttribute('aria-label')?.startsWith('Empty cell')) break;
			}
		}

		expect(screen.getByText('✓')).toBeInTheDocument();
		expect(screen.getByText('You did it!')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'New Puzzle' })).toBeInTheDocument();
	});

	it('records the final move coordinate exactly once on the first incomplete-to-complete transition', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
			for (const cell of emptyCells.slice(0, -1)) await fillWithValidShape(cell);
			const finalCell = emptyCells.at(-1)!;
			const position = finalCell.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/);
			expect(position).toBeDefined();

			const selectedShape = await fillWithValidShape(finalCell);
			const grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			expect(grid).toHaveAttribute(
				'data-completion-origin',
				`${Number(position![1]) - 1}-${Number(position![2]) - 1}`,
			);

			await fireEvent.click(selectedShape);
			await fireEvent.click(finalCell);
			expect(grid).toHaveAttribute(
				'data-completion-origin',
				`${Number(position![1]) - 1}-${Number(position![2]) - 1}`,
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('stages completion cells by Manhattan distance within the 500ms ripple window', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
			for (const cell of emptyCells) await fillWithValidShape(cell);

			const grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			const [originRow, originColumn] = grid
				.getAttribute('data-completion-origin')!
				.split('-')
				.map(Number);
			const cells = within(grid).getAllByRole('button');
			const at = (row: number, column: number) => cells.find((cell) =>
				cell.getAttribute('aria-label')?.includes(`row ${row + 1}, column ${column + 1}`),
			)!;
			const adjacentRow = originRow < 3 ? originRow + 1 : originRow - 1;
			const farRow = originRow < 2 ? 3 : 0;
			const farColumn = originColumn < 2 ? 3 : 0;
			const maxDistance = Math.abs(farRow - originRow) + Math.abs(farColumn - originColumn);

			expect(at(originRow, originColumn)).toHaveStyle('--ripple-delay: 0ms');
			expect(at(adjacentRow, originColumn)).toHaveStyle(
				`--ripple-delay: ${Math.round(320 / maxDistance)}ms`,
			);
			expect(at(farRow, farColumn)).toHaveStyle('--ripple-delay: 320ms');
		} finally {
			vi.useRealTimers();
		}
	});

	it('opens the exact native win dialog only after the 500ms completion ripple', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const dialog = document.querySelector('dialog');
			expect(dialog).not.toBeNull();
			for (const cell of screen.getAllByRole('button', { name: /^Empty cell/ })) {
				await fillWithValidShape(cell);
			}

			expect(dialog).not.toHaveAttribute('open');
			await vi.advanceTimersByTimeAsync(499);
			expect(dialog).not.toHaveAttribute('open');
			await vi.advanceTimersByTimeAsync(1);
			expect(dialog).toHaveAttribute('open');

			const modal = within(dialog!);
			expect(modal.getByTestId('win-check-seal')).toHaveTextContent('✓');
			expect(modal.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
			expect(modal.getByText('Every shape found its place.')).toBeInTheDocument();
			expect(modal.getByRole('button', { name: 'New Puzzle' })).toBeInTheDocument();
			expect(modal.getByRole('button', { name: 'Look at my puzzle' })).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('Look at my puzzle preserves the completed board, restores focus, and never reopens it', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const normalNewPuzzle = screen.getByRole('button', { name: 'New Puzzle' });
			const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
			for (const cell of emptyCells.slice(0, -1)) await fillWithValidShape(cell);
			normalNewPuzzle.focus();
			await fillWithValidShape(emptyCells.at(-1)!);
			await vi.advanceTimersByTimeAsync(500);

			const dialog = document.querySelector('dialog')!;
			expect(dialog).toHaveAttribute('open');
			expect(within(dialog).getByRole('button', { name: 'New Puzzle' })).toHaveFocus();
			await fireEvent.click(within(dialog).getByRole('button', { name: 'Look at my puzzle' }));
			expect(dialog).not.toHaveAttribute('open');
			expect(normalNewPuzzle).toHaveFocus();
			expect(screen.queryAllByRole('button', { name: /^Empty cell/ })).toHaveLength(0);

			await fireEvent.click(emptyCells.at(-1)!);
			await vi.advanceTimersByTimeAsync(1000);
			expect(dialog).not.toHaveAttribute('open');
		} finally {
			vi.useRealTimers();
		}
	});

	it('ignores backdrop clicks and treats Escape like Look at my puzzle', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			const restoreTarget = screen.getByRole('button', { name: 'Reset' });
			const emptyCells = screen.getAllByRole('button', { name: /^Empty cell/ });
			for (const cell of emptyCells.slice(0, -1)) await fillWithValidShape(cell);
			restoreTarget.focus();
			await fillWithValidShape(emptyCells.at(-1)!);
			await vi.advanceTimersByTimeAsync(500);
			const dialog = document.querySelector('dialog')!;

			await fireEvent.pointerDown(dialog);
			await fireEvent.pointerUp(dialog);
			await fireEvent.click(dialog);
			expect(dialog).toHaveAttribute('open');

			const cancelEvent = new Event('cancel', { cancelable: true });
			await fireEvent(dialog, cancelEvent);
			expect(cancelEvent.defaultPrevented).toBe(true);
			expect(dialog).not.toHaveAttribute('open');
			expect(restoreTarget).toHaveFocus();
			expect(screen.queryAllByRole('button', { name: /^Empty cell/ })).toHaveLength(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('contains Tab and Shift+Tab within the two native-dialog actions', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			for (const cell of screen.getAllByRole('button', { name: /^Empty cell/ })) {
				await fillWithValidShape(cell);
			}
			await vi.advanceTimersByTimeAsync(500);
			const dialog = document.querySelector('dialog')!;
			const first = within(dialog).getByRole('button', { name: 'New Puzzle' });
			const last = within(dialog).getByRole('button', { name: 'Look at my puzzle' });

			last.focus();
			const forwardTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
			await fireEvent(last, forwardTab);
			expect(forwardTab.defaultPrevented).toBe(true);
			expect(first).toHaveFocus();

			const reverseTab = new KeyboardEvent('keydown', {
				key: 'Tab',
				shiftKey: true,
				bubbles: true,
				cancelable: true,
			});
			await fireEvent(first, reverseTab);
			expect(reverseTab.defaultPrevented).toBe(true);
			expect(last).toHaveFocus();
		} finally {
			vi.useRealTimers();
		}
	});

	it('starts a fresh same-size puzzle from the dialog and focuses an editable cell', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			for (const cell of screen.getAllByRole('button', { name: /^Empty cell/ })) {
				await fillWithValidShape(cell);
			}
			await vi.advanceTimersByTimeAsync(500);
			const dialog = document.querySelector('dialog')!;
			await fireEvent.click(within(dialog).getByRole('button', { name: 'New Puzzle' }));
			vi.runAllTicks();

			expect(dialog).not.toHaveAttribute('open');
			const grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			expect(grid).not.toHaveAttribute('data-completion-origin');
			expect(within(grid).getAllByRole('button', { name: /^Empty cell/ }).length).toBeGreaterThan(0);
			expect(document.activeElement).toHaveAccessibleName(/^Empty cell/);
			expect(screen.getByRole('combobox', { name: 'Grid size' })).toHaveValue('4');
		} finally {
			vi.useRealTimers();
		}
	});

	it('uses the same completion origin, ripple, and dialog path when Hint fills the final cell', async () => {
		vi.useFakeTimers();
		try {
			render(ShapeSudoku);
			while (screen.getAllByRole('button', { name: /^Empty cell/ }).length > 1) {
				await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			}
			const finalCell = screen.getByRole('button', { name: /^Empty cell/ });
			const position = finalCell.getAttribute('aria-label')?.match(/row (\d+), column (\d+)/)!;
			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));

			const grid = screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' });
			expect(grid).toHaveAttribute(
				'data-completion-origin',
				`${Number(position[1]) - 1}-${Number(position[2]) - 1}`,
			);
			const dialog = document.querySelector('dialog')!;
			expect(dialog).not.toHaveAttribute('open');
			await vi.advanceTimersByTimeAsync(500);
			expect(dialog).toHaveAttribute('open');
		} finally {
			vi.useRealTimers();
		}
	});

	it('skips transforms, board crossfades, and the ripple while opening immediately for reduced motion', async () => {
		const originalMatchMedia = window.matchMedia;
		window.matchMedia = vi.fn().mockImplementation((query: string) => ({
			matches: query === '(prefers-reduced-motion: reduce)',
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		try {
			render(ShapeSudoku);
			const initialEmptyCount = screen.getAllByRole('button', { name: /^Empty cell/ }).length;
			await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			expect(screen.getAllByRole('button', { name: /^Empty cell/ })).toHaveLength(
				initialEmptyCount - 1,
			);

			while (screen.queryAllByRole('button', { name: /^Empty cell/ }).length > 0) {
				await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
			}
			const dialog = document.querySelector('dialog')!;
			expect(dialog).toHaveAttribute('open');
			expect(document.querySelector('.completion-ripple')).not.toBeInTheDocument();

			await fireEvent.click(within(dialog).getByRole('button', { name: 'Look at my puzzle' }));
			await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
			expect(screen.getByRole('group', { name: '4 by 4 Shape Sudoku grid' }))
				.not.toHaveAttribute('data-board-effect');
		} finally {
			window.matchMedia = originalMatchMedia;
		}
	});

	it.each(['Reset', 'New Puzzle', 'size change', 'unmount'] as const)(
		'cancels a pending completion callback on %s',
		async (cancellation) => {
			vi.useFakeTimers();
			try {
				const view = render(ShapeSudoku);
				while (screen.queryAllByRole('button', { name: /^Empty cell/ }).length > 0) {
					await fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
				}
				const dialog = document.querySelector('dialog')!;
				expect(dialog).not.toHaveAttribute('open');

				if (cancellation === 'size change') {
					await fireEvent.change(screen.getByRole('combobox', { name: 'Grid size' }), {
						target: { value: '3' },
					});
				} else if (cancellation === 'unmount') {
					view.unmount();
				} else {
					await fireEvent.click(screen.getByRole('button', { name: cancellation }));
				}

				await vi.advanceTimersByTimeAsync(1000);
				expect(dialog).not.toHaveAttribute('open');
				expect(vi.getTimerCount()).toBe(0);
			} finally {
				vi.useRealTimers();
			}
		},
	);

	it('supports native drag and drop from reusable palette tiles', async () => {
		render(ShapeSudoku);
		const target = screen.getAllByRole('button', { name: /^Empty cell/ })[0];
		const shapeButtons = screen.getAllByRole('button', { name: /Select .* shape/ });
		let payload = '';
		const dataTransfer = {
			dropEffect: 'none',
			effectAllowed: 'none',
			setData: (_type: string, value: string) => (payload = value),
			getData: () => payload,
		};

		for (const shapeButton of shapeButtons) {
			await fireEvent.dragStart(shapeButton, { dataTransfer });
			await fireEvent.dragOver(target, { dataTransfer });
			await fireEvent.drop(target, { dataTransfer });
			if (!target.getAttribute('aria-label')?.startsWith('Empty cell')) break;
		}

		expect(target).not.toHaveAccessibleName(/^Empty cell/);
	});
});
