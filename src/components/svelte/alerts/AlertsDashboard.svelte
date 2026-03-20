<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import { onMount } from 'svelte';
	import AlertsMap from './AlertsMap.svelte';

	Chart.register(...registerables);

	// --- Filters ---
	let startDate = $state('2026-02-28');
	let endDate = $state(new Date().toISOString().slice(0, 10));
	let selectedZone = $state('');
	let selectedOrigin = $state('');
	let selectedCategory = $state('');
	let selectedCity = $state('');
	let citySearch = $state('');
	let citySearchOpen = $state(false);
	let timelineGroup = $state<'day' | 'week' | 'month'>('day');

	// --- Data ---
	let summary: any = $state(null);
	let hourlyTimeline: any[] = $state([]);
	let distribution: any[] = $state([]);
	let categoryDistribution: any[] = $state([]);
	let zones: string[] = $state([]);
	let citiesList: any[] = $state([]);
	let loading = $state(true);
	let mapCities: { city: string; zone: string; count: number }[] = $state([]);

	// Only real siren alert types (exclude newsFlash, endAlert)
	const SIREN_CATEGORIES = 'missiles,hostileAircraftIntrusion,terroristInfiltration';

	// --- Time-of-day config ---
	const TOD_PERIODS = [
		{ label: 'Night (00–06)', min: 0, max: 5, color: 'rgba(148, 103, 189, 0.7)', border: 'rgba(148, 103, 189, 1)' },
		{ label: 'Morning (06–12)', min: 6, max: 11, color: 'rgba(255, 193, 7, 0.7)', border: 'rgba(255, 193, 7, 1)' },
		{ label: 'Noon (12–18)', min: 12, max: 17, color: 'rgba(255, 127, 14, 0.7)', border: 'rgba(255, 127, 14, 1)' },
		{ label: 'Evening (18–24)', min: 18, max: 23, color: 'rgba(107, 163, 255, 0.7)', border: 'rgba(107, 163, 255, 1)' }
	] as const;

	// --- Charts ---
	let timelineCanvas: HTMLCanvasElement;
	let distributionCanvas: HTMLCanvasElement;
	let timelineChart: Chart | null = null;
	let distributionChart: Chart | null = null;

	function toISO(date: string, endOfDay = false) {
		if (endOfDay) {
			// Use start of next day for inclusive end date
			const d = new Date(date + 'T00:00:00Z');
			d.setUTCDate(d.getUTCDate() + 1);
			return d.toISOString().slice(0, 19) + 'Z';
		}
		return `${date}T00:00:00Z`;
	}

	function buildParams(extra: Record<string, string> = {}) {
		const p = new URLSearchParams({
			startDate: toISO(startDate),
			endDate: toISO(endDate, true),
			...extra
		});
		if (selectedZone) p.set('zone', selectedZone);
		if (selectedOrigin) p.set('origin', selectedOrigin);
		if (selectedCategory) p.set('category', selectedCategory);
		if (selectedCity) p.set('cityName', selectedCity);
		return p.toString();
	}

	async function fetchJSON(url: string) {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	async function loadAllData() {
		loading = true;
		try {
			// Always use history-based endpoints for consistent data
			const summaryBase = '/api/alerts/zone-summary';
			const distBase = '/api/alerts/zone-distribution';

			const mapPromise = selectedCity
				? Promise.resolve(null)
				: fetchJSON(`${summaryBase}?${buildParams({ include: 'topCities', topLimit: '2000', categories: SIREN_CATEGORIES })}`);

			const [summaryData, hourlyData, distData, catDistData, mapData] = await Promise.all([
				fetchJSON(`${summaryBase}?${buildParams({ include: 'topCities,topZones,topOrigins,peak', topLimit: '5' })}`),
				fetchJSON(`${summaryBase}?${buildParams({ include: 'timeline', timelineGroup: 'hour' })}`),
				fetchJSON(`${distBase}?${buildParams({ groupBy: 'origin' })}`),
				fetchJSON(`${distBase}?${buildParams({ groupBy: 'category' })}`),
				mapPromise
			]);
			summary = summaryData;
			hourlyTimeline = hourlyData?.timeline || [];
			distribution = distData?.data || [];
			categoryDistribution = catDistData?.data || [];

			if (selectedCity) {
				mapCities = [{
					city: selectedCity,
					zone: selectedZone || '',
					count: summaryData?.totals?.range ?? 0
				}];
			} else {
				mapCities = mapData?.topCities || [];
			}
			renderTimelineChart();
			renderDistributionChart(distribution);
		} catch (e) {
			console.error('Failed to load alert data:', e);
		} finally {
			loading = false;
		}
	}

	async function loadZones() {
		try {
			let allCities: any[] = [];
			let offset = 0;
			const MAX_PAGES = 20;
			for (let page_i = 0; page_i < MAX_PAGES; page_i++) {
				const page = await fetchJSON(`/api/alerts/cities?limit=500&offset=${offset}`);
				const cities = page?.data || [];
				allCities = allCities.concat(cities);
				if (!page?.pagination?.hasMore) break;
				offset += 500;
			}
			citiesList = allCities;
			const zoneSet = new Set<string>();
			for (const c of allCities) {
				if (c.zone) zoneSet.add(c.zone);
			}
			zones = [...zoneSet].sort();
		} catch (e) {
			console.error('Failed to load zones:', e);
		}
	}

	// --- City search ---
	let filteredCities = $derived(
		citySearch.length >= 1
			? citiesList
					.filter((c: any) => c.name?.toLowerCase().includes(citySearch.toLowerCase()))
					.slice(0, 15)
			: []
	);

	function selectCity(cityName: string) {
		selectedCity = cityName;
		citySearch = cityName;
		citySearchOpen = false;
	}

	function clearCity() {
		selectedCity = '';
		citySearch = '';
		citySearchOpen = false;
	}

	function handleCityBlur() {
		// Delay to allow click on dropdown item
		setTimeout(() => { citySearchOpen = false; }, 200);
	}

	function getBucketKey(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
		const d = new Date(dateStr);
		if (granularity === 'month') {
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		}
		if (granularity === 'week') {
			const day = d.getDay();
			const diff = (day === 0 ? -6 : 1) - day;
			const monday = new Date(d);
			monday.setDate(d.getDate() + diff);
			return monday.toISOString().slice(0, 10);
		}
		return d.toISOString().slice(0, 10);
	}

	function getTodPeriodIndex(hour: number): number {
		if (hour < 6) return 0;
		if (hour < 12) return 1;
		if (hour < 18) return 2;
		return 3;
	}

	function buildStackedData() {
		const bucketMap = new Map<string, [number, number, number, number]>();

		for (const entry of hourlyTimeline) {
			const period = entry.period;
			const count = entry.count ?? 0;
			const hour = new Date(period).getHours();
			const key = getBucketKey(period, timelineGroup);
			const todIdx = getTodPeriodIndex(hour);

			if (!bucketMap.has(key)) {
				bucketMap.set(key, [0, 0, 0, 0]);
			}
			bucketMap.get(key)![todIdx] += count;
		}

		const sortedKeys = [...bucketMap.keys()].sort();
		const stacks: [number[], number[], number[], number[]] = [[], [], [], []];
		for (const key of sortedKeys) {
			const vals = bucketMap.get(key)!;
			for (let i = 0; i < 4; i++) stacks[i].push(vals[i]);
		}

		return { labels: sortedKeys, stacks };
	}

	function renderTimelineChart() {
		if (!timelineCanvas || !hourlyTimeline.length) return;
		if (timelineChart) timelineChart.destroy();

		const { labels, stacks } = buildStackedData();

		timelineChart = new Chart(timelineCanvas, {
			type: 'bar',
			data: {
				labels,
				datasets: TOD_PERIODS.map((p, i) => ({
					label: p.label,
					data: stacks[i],
					backgroundColor: p.color,
					borderColor: p.border,
					borderWidth: 1
				}))
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { labels: { color: '#e0e0e0' } },
					tooltip: { mode: 'index' as const }
				},
				scales: {
					x: {
						stacked: true,
						ticks: { color: '#999', maxRotation: 45 },
						grid: { color: 'rgba(255,255,255,0.05)' }
					},
					y: {
						stacked: true,
						ticks: { color: '#999' },
						grid: { color: 'rgba(255,255,255,0.05)' }
					}
				}
			}
		});
	}

	function renderDistributionChart(data: any[] = distribution) {
		if (!distributionCanvas || !data.length) return;
		if (distributionChart) distributionChart.destroy();

		// Filter out null/empty/undefined labels
		const filtered = data.filter((d: any) => d.label && d.label !== 'null');
		const labels = filtered.map((d: any) => d.label);
		const values = filtered.map((d: any) => d.count ?? 0);
		const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#e11d48'];

		distributionChart = new Chart(distributionCanvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{
					data: values,
					backgroundColor: colors.slice(0, labels.length),
					borderColor: '#1a1a1a',
					borderWidth: 2
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#e0e0e0', padding: 16 }
					}
				}
			}
		});
	}

	onMount(() => {
		loadZones();
		return () => {
			if (timelineChart) timelineChart.destroy();
			if (distributionChart) distributionChart.destroy();
		};
	});

	// Re-fetch data when filters change (not timelineGroup — that's display-only)
	$effect(() => {
		startDate; endDate; selectedZone; selectedOrigin; selectedCategory; selectedCity;
		if (!timelineCanvas) return;
		loadAllData();
	});

	// Re-render timeline chart when grouping or data changes (no re-fetch)
	$effect(() => {
		timelineGroup;
		if (hourlyTimeline.length && timelineCanvas) renderTimelineChart();
	});

	// Derived data (Svelte 5 syntax — no generic params, no function wrappers)
	let topCities = $derived(summary?.topCities || []);
	let topZones = $derived(summary?.topZones || []);
	let origins = $derived(distribution.map((d: any) => d.label).filter(Boolean));
	let categories = $derived(categoryDistribution.map((d: any) => d.label).filter(Boolean));
</script>

<div class="alerts-page">
	<header>
		<a href="/" class="back-link">&larr; Home</a>
		<h1>Rocket Alert Dashboard</h1>
		<p class="subtitle">Israel rocket alert statistics &mdash; powered by RedAlert API</p>
	</header>

	<!-- Filters -->
	<section class="filters">
		<div class="filter-group">
			<label for="start-date">From</label>
			<input id="start-date" type="date" bind:value={startDate} />
		</div>
		<div class="filter-group">
			<label for="end-date">To</label>
			<div class="date-with-now">
				<input id="end-date" type="date" bind:value={endDate} />
				<button class="now-btn" onclick={() => endDate = new Date().toISOString().slice(0, 10)}>Now</button>
			</div>
		</div>
		<div class="filter-group">
			<label for="zone-select">Zone</label>
			<select id="zone-select" bind:value={selectedZone}>
				<option value="">All Zones</option>
				{#each zones as zone}
					<option value={zone}>{zone}</option>
				{/each}
			</select>
		</div>
		<div class="filter-group city-search">
			<label for="city-input">City</label>
			<div class="search-wrapper">
				<input
					id="city-input"
					type="text"
					placeholder="Search cities..."
					bind:value={citySearch}
					onfocus={() => { citySearchOpen = true; }}
					oninput={() => { citySearchOpen = true; selectedCity = ''; }}
					onblur={handleCityBlur}
					autocomplete="off"
				/>
				{#if selectedCity}
					<button class="clear-btn" onclick={clearCity}>&times;</button>
				{/if}
				{#if citySearchOpen && filteredCities.length > 0 && !selectedCity}
					<div class="search-dropdown">
						{#each filteredCities as c}
							<button class="search-option" onmousedown={() => selectCity(c.name)}>
								<span>{c.name}</span>
								<span class="zone-tag">{c.zone}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div class="filter-group">
			<label for="origin-select">Origin</label>
			<select id="origin-select" bind:value={selectedOrigin}>
				<option value="">All Origins</option>
				{#each origins as origin}
					<option value={origin}>{origin}</option>
				{/each}
			</select>
		</div>
		<div class="filter-group">
			<label for="category-select">Category</label>
			<select id="category-select" bind:value={selectedCategory}>
				<option value="">All Categories</option>
				{#each categories as cat}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</div>
	</section>

	{#if loading}
		<div class="loading">Loading alert data...</div>
	{/if}

	<!-- Alert Map -->
	{#if mapCities.length > 0}
		<AlertsMap topCities={mapCities} />
	{/if}

	<!-- Summary Cards -->
	{#if summary}
		<section class="summary-cards">
			<div class="stat-card">
				<div class="stat-value">{summary.totals?.range?.toLocaleString() ?? '—'}</div>
				<div class="stat-label">Total Alerts</div>
				<div class="stat-badge">Active alerts only</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.totals?.last24h?.toLocaleString() ?? '—'}</div>
				<div class="stat-label">Last 24h</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.totals?.last7d?.toLocaleString() ?? '—'}</div>
				<div class="stat-label">Last 7 Days</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.uniqueCities?.toLocaleString() ?? '—'}</div>
				<div class="stat-label">Unique Cities</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.uniqueZones?.toLocaleString() ?? '—'}</div>
				<div class="stat-label">Unique Zones</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.peak?.period ? `${String(new Date(summary.peak.period).getUTCHours()).padStart(2, '0')}:00` : '—'}</div>
				<div class="stat-label">Peak Hour</div>
			</div>
		</section>
	{/if}

	<!-- Timeline Chart -->
	<section class="chart-section">
		<div class="chart-header">
			<h2>Alert Timeline</h2>
			<div class="granularity-toggle">
				<button class:active={timelineGroup === 'day'} onclick={() => timelineGroup = 'day'}>Day</button>
				<button class:active={timelineGroup === 'week'} onclick={() => timelineGroup = 'week'}>Week</button>
				<button class:active={timelineGroup === 'month'} onclick={() => timelineGroup = 'month'}>Month</button>
			</div>
		</div>
		<div class="chart-container">
			<canvas bind:this={timelineCanvas}></canvas>
		</div>
	</section>

	<div class="two-col">
		<!-- Top Cities -->
		<section class="data-section">
			<h2>Top Targeted Cities</h2>
			{#if topCities.length}
				<div class="data-table">
					<div class="table-header">
						<span>#</span>
						<span>City</span>
						<span>Alerts</span>
					</div>
					{#each topCities.slice(0, 10) as city, i}
						<div class="table-row">
							<span class="rank">{i + 1}</span>
							<span class="name">{city.city}</span>
							<span class="count">{(city.count ?? 0).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="no-data">No city data available</p>
			{/if}
		</section>

		<!-- Top Zones -->
		<section class="data-section">
			<h2>Top Targeted Zones</h2>
			{#if topZones.length}
				<div class="data-table">
					<div class="table-header">
						<span>#</span>
						<span>Zone</span>
						<span>Alerts</span>
					</div>
					{#each topZones.slice(0, 10) as zone, i}
						<div class="table-row">
							<span class="rank">{i + 1}</span>
							<span class="name">{zone.zone}</span>
							<span class="count">{(zone.count ?? 0).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="no-data">No zone data available</p>
			{/if}
		</section>
	</div>

	<!-- Distribution Chart -->
	<section class="chart-section">
		<h2>Distribution by Origin</h2>
		<div class="chart-container chart-small">
			<canvas bind:this={distributionCanvas}></canvas>
		</div>
	</section>
</div>

<style>
	.alerts-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	header {
		margin-bottom: 2rem;
	}

	.back-link {
		color: #6ba3ff;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 2rem;
		margin: 0.5rem 0 0.25rem;
		color: #e0e0e0;
	}

	.subtitle {
		color: #888;
		margin: 0;
		font-size: 0.9rem;
	}

	/* Filters */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1.25rem;
		background: #1a1a1a;
		border-radius: 10px;
		border: 1px solid #2a2a2a;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		min-width: 140px;
	}

	.filter-group label {
		font-size: 0.75rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.filter-group input,
	.filter-group select {
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 0.5rem 0.6rem;
		color: #e0e0e0;
		font-size: 0.85rem;
	}

	.filter-group input:focus,
	.filter-group select:focus {
		outline: none;
		border-color: #6ba3ff;
	}

	/* Date with Now button */
	.date-with-now {
		display: flex;
		gap: 0.35rem;
		align-items: stretch;
	}

	.date-with-now input {
		flex: 1;
		min-width: 0;
	}

	.now-btn {
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		color: #6ba3ff;
		font-size: 0.75rem;
		padding: 0 0.6rem;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s;
	}

	.now-btn:hover {
		background: #1a1a1a;
		border-color: #6ba3ff;
	}

	/* City Search */
	.city-search {
		position: relative;
	}

	.search-wrapper {
		position: relative;
	}

	.search-wrapper input {
		width: 100%;
		box-sizing: border-box;
		padding-right: 2rem;
	}

	.clear-btn {
		position: absolute;
		right: 0.4rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #888;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.25rem;
		line-height: 1;
	}

	.clear-btn:hover {
		color: #e0e0e0;
	}

	.search-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #0a0a0a;
		border: 1px solid #333;
		border-top: none;
		border-radius: 0 0 6px 6px;
		max-height: 200px;
		overflow-y: auto;
		z-index: 100;
	}

	.search-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.45rem 0.6rem;
		background: none;
		border: none;
		border-bottom: 1px solid #1a1a1a;
		color: #e0e0e0;
		font-size: 0.82rem;
		cursor: pointer;
		text-align: left;
	}

	.search-option:hover {
		background: #1a1a1a;
	}

	.zone-tag {
		font-size: 0.7rem;
		color: #666;
		margin-left: 0.5rem;
		white-space: nowrap;
	}

	/* Loading */
	.loading {
		text-align: center;
		padding: 2rem;
		color: #888;
	}

	/* Summary Cards */
	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 10px;
		padding: 1.25rem;
		text-align: center;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: #ef4444;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.35rem;
	}

	.stat-badge {
		font-size: 0.65rem;
		color: #10b981;
		margin-top: 0.35rem;
		opacity: 0.8;
	}

	/* Charts */
	.chart-section {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 10px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.chart-section h2 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
		color: #e0e0e0;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.chart-header h2 {
		margin: 0;
	}

	.granularity-toggle {
		display: flex;
		gap: 0.25rem;
	}

	.granularity-toggle button {
		background: #0a0a0a;
		border: 1px solid #333;
		color: #999;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.granularity-toggle button.active {
		background: #ef4444;
		border-color: #ef4444;
		color: #fff;
	}

	.chart-container {
		height: 350px;
		position: relative;
	}

	.chart-small {
		height: 300px;
		max-width: 450px;
		margin: 0 auto;
	}

	/* Two Column */
	.two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	/* Data Tables */
	.data-section {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 10px;
		padding: 1.5rem;
	}

	.data-section h2 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
		color: #e0e0e0;
	}

	.data-table {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.table-header,
	.table-row {
		display: grid;
		grid-template-columns: 2rem 1fr 5rem;
		padding: 0.5rem 0.25rem;
		align-items: center;
	}

	.table-header {
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #2a2a2a;
	}

	.table-row {
		border-bottom: 1px solid #1f1f1f;
		font-size: 0.85rem;
	}

	.table-row:last-child {
		border-bottom: none;
	}

	.rank {
		color: #666;
	}

	.name {
		color: #e0e0e0;
	}

	.count {
		text-align: right;
		color: #ef4444;
		font-weight: 600;
	}

	.no-data {
		color: #666;
		font-size: 0.85rem;
	}

	/* Responsive */
	@media (max-width: 700px) {
		.two-col {
			grid-template-columns: 1fr;
		}

		.summary-cards {
			grid-template-columns: repeat(2, 1fr);
		}

		.filters {
			flex-direction: column;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}
	}
</style>
