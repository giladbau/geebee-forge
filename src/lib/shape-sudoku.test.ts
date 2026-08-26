import { describe, expect, it } from 'vitest';

import {
	applyHint,
	applyMove,
	countSolutions,
	createSolvedBoard,
	generatePuzzle,
	hasCompletionAfterMove,
	isCompleteAndValid,
	isSinglesSolvable,
	resetBoard,
} from './shape-sudoku';

function seededRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

describe('createSolvedBoard', () => {
	it('creates valid Latin-square boards for every supported size', () => {
		for (let size = 3; size <= 9; size += 1) {
			const board = createSolvedBoard(size, seededRng(size));

			expect(board).toHaveLength(size);
			expect(isCompleteAndValid(board)).toBe(true);

			for (let index = 0; index < size; index += 1) {
				expect(new Set(board[index])).toEqual(new Set(Array.from({ length: size }, (_, symbol) => symbol)));
				expect(new Set(board.map((row) => row[index]))).toEqual(
					new Set(Array.from({ length: size }, (_, symbol) => symbol)),
				);
			}
		}
	});
});

describe('hasCompletionAfterMove', () => {
	it('accepts a viable move and rejects a locally plausible dead end', () => {
		const board = [
			[null, null, 0, null],
			[1, null, null, 3],
			[null, null, null, 1],
			[null, null, null, null],
		];

		expect(hasCompletionAfterMove(board, 1, 1, 0)).toBe(true);
		expect(hasCompletionAfterMove(board, 1, 1, 2)).toBe(false);
		expect(board[1][1]).toBeNull();
	});
});

describe('countSolutions', () => {
	it('counts a completed board once and stops at the requested cap', () => {
		const solved = createSolvedBoard(3, seededRng(31));
		const empty = Array.from({ length: 3 }, () => Array<null>(3).fill(null));

		expect(countSolutions(solved, 2)).toBe(1);
		expect(countSolutions(empty, 2)).toBe(2);
		expect(countSolutions(empty, 1.5)).toBe(1);
		expect(countSolutions(empty, Number.NaN)).toBe(0);
		expect(countSolutions(empty, Number.POSITIVE_INFINITY)).toBe(0);
	});

	it('rejects boards with duplicate symbols in a row or column', () => {
		const duplicateRow = [
			[0, 0, 2],
			[1, 2, 0],
			[2, 1, 1],
		];
		const duplicateColumn = [
			[0, 1, 2],
			[0, 2, 1],
			[2, 0, 1],
		];

		expect(countSolutions(duplicateRow, 2)).toBe(0);
		expect(countSolutions(duplicateColumn, 2)).toBe(0);
	});
});

describe('generatePuzzle', () => {
	it('creates both locked clues and editable cells while preserving the solution', () => {
		const puzzle = generatePuzzle(4, seededRng(41));
		let clueCount = 0;
		let editableCount = 0;

		for (let row = 0; row < puzzle.size; row += 1) {
			for (let column = 0; column < puzzle.size; column += 1) {
				if (puzzle.clues[row][column]) {
					clueCount += 1;
					expect(puzzle.initialBoard[row][column]).toBe(puzzle.solution[row][column]);
				} else {
					editableCount += 1;
					expect(puzzle.initialBoard[row][column]).toBeNull();
				}
			}
		}

		expect(clueCount).toBeGreaterThan(0);
		expect(editableCount).toBeGreaterThan(0);
	});

	it('has exactly one completion', () => {
		const puzzle = generatePuzzle(4, seededRng(42));

		expect(countSolutions(puzzle.initialBoard, 2)).toBe(1);
	});

	it('can be solved by repeatedly filling single-candidate cells', () => {
		const puzzle = generatePuzzle(4, seededRng(43));

		expect(isSinglesSolvable(puzzle.initialBoard)).toBe(true);
	});

	it('generates deterministic beginner puzzles for every supported size', () => {
		for (let size = 3; size <= 9; size += 1) {
			const first = generatePuzzle(size, seededRng(size * 100));
			const second = generatePuzzle(size, seededRng(size * 100));

			expect(first).toEqual(second);
			expect(first.initialBoard).toHaveLength(size);
			expect(countSolutions(first.initialBoard, 2)).toBe(1);
			expect(isSinglesSolvable(first.initialBoard)).toBe(true);
		}
	});
});

describe('puzzle actions', () => {
	it('resets safely, protects clues, applies viable moves, and fills one hint', () => {
		const puzzle = generatePuzzle(4, seededRng(51));
		const board = resetBoard(puzzle);
		const clueIndex = puzzle.clues.flat().findIndex(Boolean);
		const editableIndex = puzzle.clues.flat().findIndex((clue) => !clue);
		const clueRow = Math.floor(clueIndex / puzzle.size);
		const clueColumn = clueIndex % puzzle.size;
		const row = Math.floor(editableIndex / puzzle.size);
		const column = editableIndex % puzzle.size;
		const symbol = puzzle.solution[row][column];

		expect(board).toEqual(puzzle.initialBoard);
		expect(board).not.toBe(puzzle.initialBoard);
		expect(applyMove(puzzle, board, clueRow, clueColumn, null)).toBeNull();

		const placed = applyMove(puzzle, board, row, column, symbol);
		expect(placed?.[row][column]).toBe(symbol);
		expect(board[row][column]).toBeNull();
		expect(applyMove(puzzle, placed!, row, column, null)?.[row][column]).toBeNull();

		const hinted = applyHint(puzzle, board);
		const changedCells = hinted.flat().filter((cell, index) => cell !== board.flat()[index]);
		expect(changedCells).toHaveLength(1);
		expect(hinted[row][column]).toBe(symbol);
		expect(hinted[clueRow][clueColumn]).toBe(puzzle.initialBoard[clueRow][clueColumn]);
	});
});
