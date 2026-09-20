<script module lang="ts">
	// Canonical order matches the nine-class trained recognizer. Keep symbol IDs stable.
	export const SHAPES = [
		{ name: 'triangle', color: '#D97872' },
		{ name: 'square', color: '#6489C4' },
		{ name: 'star', color: '#C8759E' },
		{ name: 'circle', color: '#C99C43' },
		{ name: 'sun', color: '#6C9B79' },
		{ name: 'crescent', color: '#8976B6' },
		{ name: 'cloud', color: '#CE8559' },
		{ name: 'lightning', color: '#559995' },
		{ name: 'rainbow', color: '#7376B5' },
	] as const;
</script>

<script lang="ts">
	let { symbol }: { symbol: number } = $props();
	const shape = $derived(SHAPES[symbol]);
</script>

<svg class="shape-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
	{#if symbol === 0}
		<polygon points="50,7 94,90 6,90" fill={shape.color} />
	{:else if symbol === 1}
		<rect x="10" y="10" width="80" height="80" rx="5" fill={shape.color} />
	{:else if symbol === 2}
		<polygon points="50,5 61,36 95,37 68,57 77,90 50,71 23,90 32,57 5,37 39,36" fill={shape.color} />
	{:else if symbol === 3}
		<circle cx="50" cy="50" r="40" fill={shape.color} />
	{:else if symbol === 4}
		<circle cx="50" cy="50" r="23" fill={shape.color} />
		<path d="M50 6v12 M50 82v12 M6 50h12 M82 50h12 M19 19l9 9 M72 72l9 9 M19 81l9-9 M72 28l9-9" fill="none" stroke={shape.color} stroke-width="7" stroke-linecap="round" />
	{:else if symbol === 5}
		<path d="M68 7C31-1 5 24 9 55c4 32 33 47 61 34C44 83 31 61 37 39 41 23 52 12 68 7Z" fill={shape.color} />
	{:else if symbol === 6}
		<path d="M25 80C12 80 5 72 5 60c0-11 8-20 19-21C26 22 37 14 51 17c12 2 20 11 22 23 13-2 23 8 23 20 0 12-9 20-22 20Z" fill={shape.color} />
	{:else if symbol === 7}
		<path d="M57 5 15 56h30L34 95 86 39H57L70 5Z" fill={shape.color} />
	{:else if symbol === 8}
		<path d="M8 83a42 58 0 0 1 84 0 M23 83a27 42 0 0 1 54 0 M38 83a12 26 0 0 1 24 0" fill="none" stroke={shape.color} stroke-width="7" stroke-linecap="round" />
	{/if}
</svg>

<style>
	.shape-icon {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		filter: drop-shadow(0 1px 0 rgba(38, 51, 49, 0.12));
	}
</style>
