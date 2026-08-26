export type Cell = number | null;
export type Board = Cell[][];

export interface Puzzle {
	size: number;
	initialBoard: Board;
	solution: Board;
	clues: boolean[][];
}

export type RandomSource = () => number;

export const MIN_SIZE = 3;
export const MAX_SIZE = 9;

function assertSupportedSize(size: number): void {
	if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
		throw new RangeError(`Shape Sudoku size must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`);
	}
}

function shuffledRange(size: number, rng: RandomSource): number[] {
	const values = Array.from({ length: size }, (_, index) => index);
	for (let index = values.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(rng() * (index + 1));
		[values[index], values[swapIndex]] = [values[swapIndex], values[index]];
	}
	return values;
}

export function createSolvedBoard(size: number, rng: RandomSource = Math.random): Board {
	assertSupportedSize(size);

	const symbols = shuffledRange(size, rng);
	const rows = shuffledRange(size, rng);
	const columns = shuffledRange(size, rng);

	return rows.map((row) => columns.map((column) => symbols[(row + column) % size]));
}

export function isCompleteAndValid(board: Board): boolean {
	const size = board.length;
	if (size === 0 || board.some((row) => row.length !== size)) return false;

	const isValidGroup = (cells: Cell[]) => {
		if (cells.some((cell) => !Number.isInteger(cell) || cell === null || cell < 0 || cell >= size)) {
			return false;
		}
		return new Set(cells).size === size;
	};

	for (let index = 0; index < size; index += 1) {
		if (!isValidGroup(board[index]) || !isValidGroup(board.map((row) => row[index]))) return false;
	}

	return true;
}

export function countSolutions(board: Board, cap = 2): number {
	const size = board.length;
	const normalizedCap = Math.floor(cap);
	if (
		size === 0 ||
		board.some((row) => row.length !== size) ||
		!Number.isFinite(cap) ||
		normalizedCap <= 0
	) {
		return 0;
	}

	const working = board.map((row) => [...row]);
	const rowMasks = Array<number>(size).fill(0);
	const columnMasks = Array<number>(size).fill(0);
	const allSymbolsMask = (1 << size) - 1;

	for (let row = 0; row < size; row += 1) {
		for (let column = 0; column < size; column += 1) {
			const symbol = working[row][column];
			if (symbol === null) continue;
			if (!Number.isInteger(symbol) || symbol < 0 || symbol >= size) return 0;
			const symbolMask = 1 << symbol;
			if ((rowMasks[row] & symbolMask) !== 0 || (columnMasks[column] & symbolMask) !== 0) return 0;
			rowMasks[row] |= symbolMask;
			columnMasks[column] |= symbolMask;
		}
	}

	let solutions = 0;

	function search(): void {
		if (solutions >= normalizedCap) return;

		let nextRow = -1;
		let nextColumn = -1;
		let nextCandidates = 0;
		let fewestCandidates = size + 1;

		for (let row = 0; row < size; row += 1) {
			for (let column = 0; column < size; column += 1) {
				if (working[row][column] !== null) continue;
				const candidates = allSymbolsMask & ~(rowMasks[row] | columnMasks[column]);
				const candidateCount = countBits(candidates);
				if (candidateCount === 0) return;
				if (candidateCount < fewestCandidates) {
					fewestCandidates = candidateCount;
					nextRow = row;
					nextColumn = column;
					nextCandidates = candidates;
				}
			}
		}

		if (nextRow === -1) {
			solutions += 1;
			return;
		}

		for (let symbol = 0; symbol < size && solutions < normalizedCap; symbol += 1) {
			const symbolMask = 1 << symbol;
			if ((nextCandidates & symbolMask) === 0) continue;

			working[nextRow][nextColumn] = symbol;
			rowMasks[nextRow] |= symbolMask;
			columnMasks[nextColumn] |= symbolMask;
			search();
			working[nextRow][nextColumn] = null;
			rowMasks[nextRow] &= ~symbolMask;
			columnMasks[nextColumn] &= ~symbolMask;
		}
	}

	search();
	return solutions;
}

export function hasCompletionAfterMove(
	board: Board,
	row: number,
	column: number,
	symbol: number,
): boolean {
	if (
		!Number.isInteger(row) ||
		!Number.isInteger(column) ||
		row < 0 ||
		column < 0 ||
		row >= board.length ||
		column >= board.length
	) {
		return false;
	}

	const candidate = board.map((cells) => [...cells]);
	candidate[row][column] = symbol;
	return countSolutions(candidate, 1) === 1;
}

export function isSinglesSolvable(board: Board): boolean {
	const size = board.length;
	if (size === 0 || board.some((row) => row.length !== size)) return false;

	const working = board.map((row) => [...row]);
	const rowMasks = Array<number>(size).fill(0);
	const columnMasks = Array<number>(size).fill(0);
	const allSymbolsMask = (1 << size) - 1;
	let emptyCount = 0;

	for (let row = 0; row < size; row += 1) {
		for (let column = 0; column < size; column += 1) {
			const symbol = working[row][column];
			if (symbol === null) {
				emptyCount += 1;
				continue;
			}
			if (!Number.isInteger(symbol) || symbol < 0 || symbol >= size) return false;
			const symbolMask = 1 << symbol;
			if ((rowMasks[row] & symbolMask) !== 0 || (columnMasks[column] & symbolMask) !== 0) {
				return false;
			}
			rowMasks[row] |= symbolMask;
			columnMasks[column] |= symbolMask;
		}
	}

	while (emptyCount > 0) {
		let madeProgress = false;
		for (let row = 0; row < size; row += 1) {
			for (let column = 0; column < size; column += 1) {
				if (working[row][column] !== null) continue;
				const candidates = allSymbolsMask & ~(rowMasks[row] | columnMasks[column]);
				if (candidates === 0) return false;
				if (countBits(candidates) !== 1) continue;

				const symbol = Math.log2(candidates);
				working[row][column] = symbol;
				rowMasks[row] |= candidates;
				columnMasks[column] |= candidates;
				emptyCount -= 1;
				madeProgress = true;
			}
		}
		if (!madeProgress) return false;
	}

	return true;
}

export function generatePuzzle(size = 4, rng: RandomSource = Math.random): Puzzle {
	const solution = createSolvedBoard(size, rng);
	const initialBoard = solution.map((row) => [...row]);
	const removalOrder = shuffledRange(size * size, rng);
	const targetBlanks = Math.min(Math.floor(size * size * 0.45), size * 3);
	let blankCount = 0;

	for (const cellIndex of removalOrder) {
		if (blankCount >= targetBlanks) break;
		const row = Math.floor(cellIndex / size);
		const column = cellIndex % size;
		const symbol = initialBoard[row][column];
		initialBoard[row][column] = null;

		if (countSolutions(initialBoard, 2) === 1 && isSinglesSolvable(initialBoard)) {
			blankCount += 1;
		} else {
			initialBoard[row][column] = symbol;
		}
	}

	const clues = initialBoard.map((row) => row.map((cell) => cell !== null));

	return { size, initialBoard, solution, clues };
}

export function resetBoard(puzzle: Puzzle): Board {
	return puzzle.initialBoard.map((row) => [...row]);
}

export function applyMove(
	puzzle: Puzzle,
	board: Board,
	row: number,
	column: number,
	symbol: Cell,
): Board | null {
	if (
		!Number.isInteger(row) ||
		!Number.isInteger(column) ||
		row < 0 ||
		column < 0 ||
		row >= puzzle.size ||
		column >= puzzle.size ||
		puzzle.clues[row][column]
	) {
		return null;
	}

	const nextBoard = board.map((cells) => [...cells]);
	if (symbol === null) {
		nextBoard[row][column] = null;
		return nextBoard;
	}

	if (!hasCompletionAfterMove(board, row, column, symbol)) return null;
	nextBoard[row][column] = symbol;
	return nextBoard;
}

export function applyHint(puzzle: Puzzle, board: Board): Board {
	const nextBoard = board.map((row) => [...row]);
	for (let row = 0; row < puzzle.size; row += 1) {
		for (let column = 0; column < puzzle.size; column += 1) {
			if (!puzzle.clues[row][column] && board[row][column] !== puzzle.solution[row][column]) {
				nextBoard[row][column] = puzzle.solution[row][column];
				return nextBoard;
			}
		}
	}
	return nextBoard;
}

function countBits(mask: number): number {
	let remaining = mask;
	let count = 0;
	while (remaining !== 0) {
		remaining &= remaining - 1;
		count += 1;
	}
	return count;
}
