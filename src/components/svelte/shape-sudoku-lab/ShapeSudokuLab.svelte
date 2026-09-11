<script lang="ts">
	import { onMount } from 'svelte';
	import { Recognizer } from '$lib/shape-sudoku-lab/recognizer.js';
	import { isScratch } from '$lib/shape-sudoku-lab/scratch.js';
	import { canonicalPoints, SHAPE_NAMES } from '$lib/shape-sudoku-lab/shapes.js';

	const COLORS: Record<string, string> = {
		triangle: '#D97872', square: '#6489C4', heart: '#C8759E', star: '#C99C43',
		pentagon: '#6C9B79', hexagon: '#8976B6', cross: '#CE8559', trapezoid: '#559995', arrow: '#7376B5'
	};

	let boardEl: HTMLElement;
	let logEl: HTMLElement;
	let modeNoteEl: HTMLElement;
	let penBtn: HTMLButtonElement;
	let mouseBtn: HTMLButtonElement;
	let pauseBtn: HTMLButtonElement;
	let undoBtn: HTMLButtonElement;
	let clearBtn: HTMLButtonElement;
	let undoDisabled = $state(true);
	let logText = $state('Lab ready. Draw a shape in any tile.');
	let modeNote = $state('Pen input active. Recognition paused: off');

	interface TileState {
		strokes: number[][][];
		current: number[][];
		recognized: boolean;
		recognizedName: string | null;
		pending: ReturnType<typeof setTimeout> | null;
		beforeStroke: any | null;
	}

	interface TileApi {
		index: number;
		el: HTMLElement;
		state: TileState;
		saveState: () => any;
		restoreState: (s: any) => void;
		clear: () => void;
		eraseByScratch: () => void;
		renderInk: () => void;
	}

	onMount(() => {
		const recognizer = new Recognizer({ sampleCount: 48 });
		recognizer.train(SHAPE_NAMES.map(name => ({ name, points: canonicalPoints(name, 64) })));

		const tiles: TileApi[] = [];
		const RECOGNITION_PAUSE_MS = 650;
		const undoStack: { tile: TileApi; previous: any }[] = [];
		let penMode = true;
		let recognitionPaused = false;

		function log(msg: string) {
			logText = msg + '\n' + logText.slice(0, 800);
		}

		function pushUndo(tile: TileApi) {
			undoStack.push({ tile, previous: tile.state.beforeStroke || tile.saveState() });
			undoDisabled = false;
		}

		function createTile(index: number): TileApi {
			const el = document.createElement('div');
			el.className = 'tile';
			el.dataset.index = String(index);

			const inkCanvas = document.createElement('canvas');
			inkCanvas.className = 'ink';
			inkCanvas.width = 112; inkCanvas.height = 112;
			const inkCtx = inkCanvas.getContext('2d')!;
			inkCtx.lineCap = 'round';
			inkCtx.lineJoin = 'round';
			inkCtx.lineWidth = 3;

			const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			overlay.setAttribute('class', 'overlay');
			overlay.setAttribute('viewBox', '0 0 100 100');
			overlay.setAttribute('preserveAspectRatio', 'xMidYMid meet');

			const label = document.createElement('div');
			label.className = 'label';
			label.textContent = 'draw a shape';

			el.append(inkCanvas, overlay, label);
			boardEl.appendChild(el);

			const state: TileState = {
				strokes: [],
				current: [],
				recognized: false,
				recognizedName: null,
				pending: null,
				beforeStroke: null,
			};

			function saveState() {
				return {
					strokes: state.strokes.map(s => s.slice()),
					recognized: state.recognized,
					recognizedName: state.recognizedName,
					labelText: label.textContent,
					labelClass: label.className,
				};
			}

			function restoreState(snapshot: any) {
				if (state.pending) clearTimeout(state.pending);
				state.strokes = snapshot.strokes.map((s: number[][]) => s.slice());
				state.recognized = snapshot.recognized;
				state.recognizedName = snapshot.recognizedName;
				label.textContent = snapshot.labelText;
				label.className = snapshot.labelClass;
				state.beforeStroke = null;
				state.current = [];
				renderInk();
				renderOverlay();
			}

			function renderInk() {
				inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
				inkCtx.strokeStyle = 'rgba(125, 211, 252, 0.95)';
				inkCtx.shadowColor = 'rgba(125, 211, 252, 0.5)';
				inkCtx.shadowBlur = 4;
				for (const stroke of [...state.strokes, state.current]) {
					if (stroke.length < 2) continue;
					inkCtx.beginPath();
					const scale = inkCanvas.width / 100;
					inkCtx.moveTo(stroke[0][0] * scale, stroke[0][1] * scale);
					for (let i = 1; i < stroke.length; i++) {
						inkCtx.lineTo(stroke[i][0] * scale, stroke[i][1] * scale);
					}
					inkCtx.stroke();
				}
				inkCtx.shadowBlur = 0;
			}

			function renderOverlay() {
				overlay.innerHTML = '';
				overlay.classList.toggle('visible', !!state.recognized);
				if (!state.recognized || !state.recognizedName) return;
				const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
				g.setAttribute('fill', COLORS[state.recognizedName] || '#fff');
				g.setAttribute('opacity', '0.5');
				const s = state.recognizedName;
				let shapeEl: SVGElement | null = null;
				if (s === 'triangle') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
					shapeEl.setAttribute('points', '50,7 94,90 6,90');
				} else if (s === 'square') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
					shapeEl.setAttribute('x', '10'); shapeEl.setAttribute('y', '10');
					shapeEl.setAttribute('width', '80'); shapeEl.setAttribute('height', '80'); shapeEl.setAttribute('rx', '5');
				} else if (s === 'heart') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					shapeEl.setAttribute('d', 'M50 91 11 52C-7 30 6 8 28 10c10 1 17 7 22 16 5-9 12-15 22-16 22-2 35 20 17 42Z');
				} else if (s === 'star') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
					shapeEl.setAttribute('points', '50,5 61,36 95,37 68,57 77,90 50,71 23,90 32,57 5,37 39,36');
				} else if (s === 'pentagon') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
					shapeEl.setAttribute('points', '50,5 95,38 78,91 22,91 5,38');
				} else if (s === 'hexagon') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
					shapeEl.setAttribute('points', '25,7 75,7 97,50 75,93 25,93 3,50');
				} else if (s === 'cross') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					shapeEl.setAttribute('d', 'M35 6h30v29h29v30H65v29H35V65H6V35h29Z');
				} else if (s === 'trapezoid') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
					shapeEl.setAttribute('points', '25,12 75,12 95,88 5,88');
				} else if (s === 'arrow') {
					shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					shapeEl.setAttribute('d', 'M55 7 96 50 55 93V68H5V32h50Z');
				}
				if (shapeEl) {
					g.appendChild(shapeEl);
					overlay.appendChild(g);
				}
			}

			function recognize() {
				if (recognitionPaused) return;
				const flat = state.strokes.flat();
				if (flat.length < 12) return;
				const result = recognizer.recognize(state.strokes);
				if (result.uncertain) {
					state.recognized = false;
					state.recognizedName = null;
					label.textContent = 'uncertain - keep drawing';
					label.className = 'label uncertain';
					renderOverlay();
					log(`Tile ${index + 1}: uncertain`);
					return;
				}
				state.recognized = true;
				state.recognizedName = result.name;
				label.textContent = result.name;
				label.className = 'label confident';
				renderOverlay();
				log(`Tile ${index + 1}: ${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
			}

			function startStroke(x: number, y: number) {
				if (state.pending) clearTimeout(state.pending);
				state.beforeStroke = saveState();
				state.current = [[x, y]];
				if (state.recognized) {
					state.recognized = false;
					state.recognizedName = null;
					renderOverlay();
					label.textContent = 'draw a shape';
					label.className = 'label';
				}
			}

			function addPoint(x: number, y: number) {
				state.current.push([x, y]);
				renderInk();
			}

			function endStroke() {
				if (state.current.length < 2) {
					state.current = [];
					return;
				}
				pushUndo(tile);
				state.strokes.push(state.current);
				state.beforeStroke = null;
				state.current = [];
				renderInk();
				if (state.pending) clearTimeout(state.pending);
				state.pending = setTimeout(recognize, RECOGNITION_PAUSE_MS);
			}

			function clear() {
				pushUndo(tile);
				state.strokes = [];
				state.current = [];
				state.recognized = false;
				state.recognizedName = null;
				renderInk();
				renderOverlay();
				label.textContent = 'draw a shape';
				label.className = 'label';
			}

			function eraseByScratch() {
				pushUndo(tile);
				state.beforeStroke = null;
				if (state.pending) clearTimeout(state.pending);
				state.strokes = [];
				state.current = [];
				state.recognized = false;
				state.recognizedName = null;
				renderInk();
				renderOverlay();
				label.textContent = 'erased';
				label.className = 'label';
				log(`Tile ${index + 1}: erased by scratch`);
			}

			const tile: TileApi = { el, state, saveState, restoreState, clear, eraseByScratch, renderInk, index };

			function getXY(e: PointerEvent) {
				const rect = el.getBoundingClientRect();
				return [
					((e.clientX - rect.left) / rect.width) * 100,
					((e.clientY - rect.top) / rect.height) * 100,
				];
			}

			function pointerDown(e: PointerEvent) {
				if (!penMode || e.pointerType !== 'pen') return;
				e.preventDefault();
				try { inkCanvas.setPointerCapture(e.pointerId); } catch {}
				startStroke(...getXY(e) as [number, number]);
			}
			function pointerMove(e: PointerEvent) {
				if (!penMode || e.pointerType !== 'pen' || state.current.length === 0) return;
				e.preventDefault();
				addPoint(...getXY(e) as [number, number]);
			}
			function pointerUp(e: PointerEvent) {
				if (!penMode || e.pointerType !== 'pen' || state.current.length === 0) return;
				e.preventDefault();
				try { inkCanvas.releasePointerCapture(e.pointerId); } catch {}
				addPoint(...getXY(e) as [number, number]);
				const scratchCandidate = state.current.length > 0 ? state.current : state.strokes[state.strokes.length - 1];
				if (state.strokes.length > 0 && isScratch(scratchCandidate)) {
					eraseByScratch();
					return;
				}
				endStroke();
			}

			inkCanvas.addEventListener('pointerdown', pointerDown);
			inkCanvas.addEventListener('pointermove', pointerMove);
			inkCanvas.addEventListener('pointerup', pointerUp);
			inkCanvas.addEventListener('pointercancel', pointerUp);

			renderInk();
			return tile;
		}

		for (let i = 0; i < 9; i++) tiles.push(createTile(i));

		penBtn.addEventListener('click', () => {
			penMode = true;
			penBtn.classList.add('active');
			mouseBtn.classList.remove('active');
			modeNote = 'Pen input active. Recognition paused: ' + (recognitionPaused ? 'on' : 'off');
		});
		mouseBtn.addEventListener('click', () => {
			penMode = false;
			mouseBtn.classList.add('active');
			penBtn.classList.remove('active');
			modeNote = 'Mouse test mode: pointer events are ignored by recognizer.';
		});
		pauseBtn.addEventListener('click', () => {
			recognitionPaused = !recognitionPaused;
			pauseBtn.classList.toggle('active', recognitionPaused);
			modeNote = 'Pen input active. Recognition paused: ' + (recognitionPaused ? 'on' : 'off');
		});
		undoBtn.addEventListener('click', () => {
			if (!undoStack.length) return;
			const { tile, previous } = undoStack.pop()!;
			tile.restoreState(previous);
			log(`Undo tile ${tile.index + 1}`);
			if (!undoStack.length) undoDisabled = true;
		});
		clearBtn.addEventListener('click', () => {
			const target = tiles.find(t => t.state.strokes.length) || tiles[0];
			target.clear();
			log(`Cleared tile ${target.index + 1}`);
		});

		return () => {
			// per-tile listeners are discarded with the DOM elements
		};
	});

	// Need module-level handlers referenced in cleanup, but function expressions are local in onMount.
	// Use dummy placeholders; actual cleanup done inside onMount closure is not accessible here.
	function pointerMove(e: PointerEvent) {}
	function pointerUp(e: PointerEvent) {}
</script>

<div class="lab-shell">
	<h1>Shape Sudoku Recognizer Lab</h1>
	<p class="subtitle">
		Draw one of the nine silhouettes in any tile. Pause to see a translucent canonical overlay.
		A continuous back-and-forth scribble over existing ink erases. This is an experimental feasibility lab, not the full game.
	</p>
	<div class="board" bind:this={boardEl}></div>
	<div class="controls">
		<button bind:this={penBtn} class="active" title="Pointer acts as pen">Pen input</button>
		<button bind:this={mouseBtn} title="Pointer acts as mouse test (no inking)">Mouse test mode</button>
		<button bind:this={pauseBtn} title="Pause/unpause recognition">Pause recognition</button>
		<button bind:this={undoBtn} disabled={undoDisabled}>Undo</button>
		<button bind:this={clearBtn}>Clear tile</button>
	</div>
	<p class="mode-note" bind:this={modeNoteEl}>{modeNote}</p>
	<div class="log" bind:this={logEl}>{logText}</div>
</div>

<style>
	.lab-shell {
		padding: 70px 16px 16px;
		min-height: 100vh;
		background: var(--bg, #1b1f23);
		color: var(--text, #e8eef2);
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	:global(:root) {
		--bg: #1b1f23;
		--panel: #252a2e;
		--ink: #7dd3fc;
		--ink-dim: rgba(125, 211, 252, 0.35);
		--text: #e8eef2;
		--muted: #9aa3ab;
		--accent: #f0abfc;
		--danger: #ef4444;
	}
	:global(body) { margin: 0; }
	h1 { font-size: 1.1rem; margin: 0 0 6px; text-align: center; }
	.subtitle { color: var(--muted); font-size: 0.85rem; margin-bottom: 14px; text-align: center; max-width: 520px; }
	.board {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-bottom: 14px;
		touch-action: pan-x pan-y;
		user-select: none;
	}
	.tile {
		position: relative;
		width: 112px;
		height: 112px;
		background: var(--panel);
		border-radius: 12px;
		border: 2px solid rgba(255,255,255,0.08);
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}
	.tile :global(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
	.tile :global(.overlay) {
		position: absolute; inset: 0; pointer-events: none; opacity: 0;
		transition: opacity 0.18s ease;
	}
	.tile :global(.overlay.visible) { opacity: 0.45; }
	.tile :global(.label) {
		position: absolute; bottom: 4px; left: 0; right: 0; text-align: center;
		font-size: 0.7rem; color: var(--muted); pointer-events: none;
	}
	.tile :global(.label.confident) { color: var(--accent); font-weight: 600; }
	.tile :global(.label.uncertain) { color: var(--muted); }
	.controls {
		display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 540px;
	}
	button {
		background: var(--panel); color: var(--text); border: 1px solid rgba(255,255,255,0.12);
		border-radius: 8px; padding: 8px 14px; font-size: 0.9rem; cursor: pointer;
	}
	button.active { outline: 2px solid var(--accent); }
	button:disabled { opacity: 0.45; cursor: not-allowed; }
	.log {
		margin-top: 14px; width: min(540px, 100%); min-height: 80px; max-height: 160px;
		overflow: auto; background: var(--panel); border-radius: 8px; padding: 10px 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem;
		color: var(--muted); white-space: pre-wrap;
	}
	.mode-note { margin-top: 8px; font-size: 0.8rem; color: var(--muted); text-align: center; }
	@media (max-width: 420px) {
		.tile { width: 92px; height: 92px; }
	}
</style>
