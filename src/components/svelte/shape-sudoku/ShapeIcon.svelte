<script module lang="ts">
	export const SHAPES = [
		{ name: 'triangle', color: '#D97872' },
		{ name: 'square', color: '#6489C4' },
		{ name: 'faceted heart', color: '#C8759E' },
		{ name: 'star', color: '#C99C43' },
		{ name: 'pentagon', color: '#6C9B79' },
		{ name: 'hexagon', color: '#8976B6' },
		{ name: 'cross', color: '#CE8559' },
		{ name: 'trapezoid', color: '#559995' },
		{ name: 'arrow', color: '#7376B5' },
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
		<path d="M50 91 11 52C-7 30 6 8 28 10c10 1 17 7 22 16 5-9 12-15 22-16 22-2 35 20 17 42Z" fill={shape.color} />
		<path d="m50 27-15 25 15 39 15-39Z" fill="rgba(255,255,255,.18)" />
		<path d="m11 52 24 0 15 39Z M89 52H65L50 91Z" fill="rgba(0,0,0,.1)" />
	{:else if symbol === 3}
		<polygon points="50,5 61,36 95,37 68,57 77,90 50,71 23,90 32,57 5,37 39,36" fill={shape.color} />
	{:else if symbol === 4}
		<polygon points="50,5 95,38 78,91 22,91 5,38" fill={shape.color} />
	{:else if symbol === 5}
		<polygon points="25,7 75,7 97,50 75,93 25,93 3,50" fill={shape.color} />
	{:else if symbol === 6}
		<path d="M35 6h30v29h29v30H65v29H35V65H6V35h29Z" fill={shape.color} />
	{:else if symbol === 7}
		<polygon points="25,12 75,12 95,88 5,88" fill={shape.color} />
	{:else}
		<path d="M55 7 96 50 55 93V68H5V32h50Z" fill={shape.color} />
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
