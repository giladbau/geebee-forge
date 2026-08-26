import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ShapeSudoku from './ShapeSudoku.svelte';

describe('ShapeSudoku', () => {
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
