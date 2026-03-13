<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	Chart.register(...registerables);

	interface AlertRow {
		time: Date;
		dateStr: string;
		city: string;
		threat: string;
		id: string;
		description: string;
		origin: string;
	}

	let loading = $state(true);
	let error = $state<string | null>(null);
	let allRows = $state<AlertRow[]>([]);

	// Filters
	let cityFilter = $state('');
	let citySearch = $state('');
	let showCityDropdown = $state(false);
	let startDate = $state('2023-10-07');
	let endDate = $state(new Date().toISOString().slice(0, 10));
	let originFilter = $state('');
	let threatFilter = $state('');
	let granularity = $state<'day' | 'week' | 'month'>('month');

	// Canvas refs
	let barCanvas = $state<HTMLCanvasElement>();
	let lineCanvas = $state<HTMLCanvasElement>();

	// Unique values for dropdowns
	let uniqueOrigins = $derived(
		[...new Set(allRows.map((r) => r.origin).filter(Boolean))].sort()
	);
	let uniqueThreats = $derived(
		[...new Set(allRows.map((r) => r.description).filter(Boolean))].sort()
	);
	let allCities = $derived([...new Set(allRows.map((r) => r.city).filter(Boolean))].sort());

	// City search suggestions
	let citySuggestions = $derived(
		citySearch ? allCities.filter((c) => c.includes(citySearch)).slice(0, 20) : []
	);

	// Filtered data
	let filteredRows = $derived.by(() => {
		let rows = allRows;
		if (cityFilter) rows = rows.filter((r) => r.city === cityFilter);
		if (originFilter) rows = rows.filter((r) => r.origin === originFilter);
		if (threatFilter) rows = rows.filter((r) => r.description === threatFilter);

		const start = new Date(startDate + 'T00:00:00');
		const end = new Date(endDate + 'T23:59:59');
		rows = rows.filter((r) => r.time >= start && r.time <= end);

		return rows;
	});

	// Stats (single pass)
	let stats = $derived.by(() => {
		const uniqueIds = new Set<string>();
		const uniqueCities = new Set<string>();
		const cityIdSets = new Map<string, Set<string>>();
		const dayIdSets = new Map<string, Set<string>>();

		for (const r of filteredRows) {
			uniqueIds.add(r.id);
			uniqueCities.add(r.city);

			let citySet = cityIdSets.get(r.city);
			if (!citySet) {
				citySet = new Set();
				cityIdSets.set(r.city, citySet);
			}
			citySet.add(r.id);

			let daySet = dayIdSets.get(r.dateStr);
			if (!daySet) {
				daySet = new Set();
				dayIdSets.set(r.dateStr, daySet);
			}
			daySet.add(r.id);
		}

		let mostHitCity = '';
		let mostHitCount = 0;
		for (const [city, ids] of cityIdSets) {
			if (ids.size > mostHitCount) {
				mostHitCount = ids.size;
				mostHitCity = city;
			}
		}

		let peakDay = '';
		let peakCount = 0;
		for (const [day, ids] of dayIdSets) {
			if (ids.size > peakCount) {
				peakCount = ids.size;
				peakDay = day;
			}
		}

		return {
			totalAlerts: uniqueIds.size,
			totalCities: uniqueCities.size,
			mostHitCity: mostHitCity ? `${mostHitCity} (${mostHitCount.toLocaleString()})` : '\u2014',
			peakDay: peakDay ? `${peakDay} (${peakCount.toLocaleString()})` : '\u2014'
		};
	});

	// Bucket key helper
	function getBucketKey(dateStr: string, date: Date, gran: 'day' | 'week' | 'month'): string {
		if (gran === 'day') return dateStr;
		if (gran === 'month') return dateStr.slice(0, 7);
		// week: Monday of the week
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1);
		d.setDate(diff);
		return d.toISOString().slice(0, 10);
	}

	// Bar chart data
	let barChartData = $derived.by(() => {
		const buckets = new Map<string, Set<string>>();
		for (const r of filteredRows) {
			const key = getBucketKey(r.dateStr, r.time, granularity);
			let bucket = buckets.get(key);
			if (!bucket) {
				bucket = new Set();
				buckets.set(key, bucket);
			}
			bucket.add(r.id);
		}
		const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		return {
			labels: sorted.map(([k]) => k),
			data: sorted.map(([, ids]) => ids.size)
		};
	});

	// Line chart data (cumulative unique alerts)
	let lineChartData = $derived.by(() => {
		const dayIds = new Map<string, Set<string>>();
		for (const r of filteredRows) {
			let daySet = dayIds.get(r.dateStr);
			if (!daySet) {
				daySet = new Set();
				dayIds.set(r.dateStr, daySet);
			}
			daySet.add(r.id);
		}

		const sortedDays = [...dayIds.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		const seenIds = new Set<string>();
		const labels: string[] = [];
		const data: number[] = [];

		for (const [day, ids] of sortedDays) {
			for (const id of ids) seenIds.add(id);
			labels.push(day);
			data.push(seenIds.size);
		}

		return { labels, data };
	});

	// Chart instances
	let barChart: Chart | null = null;
	let lineChart: Chart | null = null;

	const chartColors = {
		bar: 'rgba(107, 163, 255, 0.7)',
		barBorder: '#6ba3ff',
		line: '#6ba3ff',
		lineFill: 'rgba(107, 163, 255, 0.1)',
		text: '#e0e0e0',
		tick: '#888',
		grid: '#1a1a1a'
	};

	const commonScaleOpts = {
		x: {
			ticks: { color: chartColors.tick, maxRotation: 45, autoSkip: true, maxTicksLimit: 30 },
			grid: { color: chartColors.grid }
		},
		y: {
			ticks: { color: chartColors.tick },
			grid: { color: chartColors.grid },
			beginAtZero: true
		}
	};

	$effect(() => {
		if (!barCanvas || loading) return;
		const bd = barChartData;

		if (barChart) {
			barChart.data.labels = bd.labels;
			barChart.data.datasets![0].data = bd.data;
			barChart.update('none');
		} else {
			barChart = new Chart(barCanvas, {
				type: 'bar',
				data: {
					labels: bd.labels,
					datasets: [
						{
							label: 'Alerts',
							data: bd.data,
							backgroundColor: chartColors.bar,
							borderColor: chartColors.barBorder,
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: commonScaleOpts,
					plugins: { legend: { labels: { color: chartColors.text } } }
				}
			});
		}
	});

	$effect(() => {
		if (!lineCanvas || loading) return;
		const ld = lineChartData;

		if (lineChart) {
			lineChart.data.labels = ld.labels;
			lineChart.data.datasets![0].data = ld.data;
			lineChart.update('none');
		} else {
			lineChart = new Chart(lineCanvas, {
				type: 'line',
				data: {
					labels: ld.labels,
					datasets: [
						{
							label: 'Cumulative Alerts',
							data: ld.data,
							borderColor: chartColors.line,
							backgroundColor: chartColors.lineFill,
							fill: true,
							tension: 0.1,
							pointRadius: 0
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: commonScaleOpts,
					plugins: { legend: { labels: { color: chartColors.text } } }
				}
			});
		}
	});

	// CSV parsing
	function parseCSVLine(line: string): string[] {
		const fields: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"') {
					if (line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = false;
					}
				} else {
					current += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				fields.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
		fields.push(current);
		return fields;
	}

	function parseCSV(text: string): AlertRow[] {
		const lines = text.split('\n');
		const rows: AlertRow[] = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;
			const fields = parseCSVLine(line);
			if (fields.length >= 6) {
				const time = new Date(fields[0]);
				rows.push({
					time,
					dateStr: fields[0].slice(0, 10),
					city: fields[1],
					threat: fields[2],
					id: fields[3],
					description: fields[4],
					origin: fields[5]
				});
			}
		}
		return rows;
	}

	onMount(async () => {
		try {
			const res = await fetch(
				'https://raw.githubusercontent.com/yuval-harpaz/alarms/master/data/alarms.csv'
			);
			if (!res.ok) throw new Error(`Failed to fetch data: HTTP ${res.status}`);
			const text = await res.text();
			allRows = parseCSV(text);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}

		return () => {
			barChart?.destroy();
			lineChart?.destroy();
		};
	});

	function selectCity(city: string) {
		cityFilter = city;
		citySearch = city;
		showCityDropdown = false;
	}

	function clearCityFilter() {
		cityFilter = '';
		citySearch = '';
	}

	let dropdownTimeout: ReturnType<typeof setTimeout>;

	function handleCityBlur() {
		dropdownTimeout = setTimeout(() => {
			showCityDropdown = false;
		}, 200);
	}

	function handleCityFocus() {
		clearTimeout(dropdownTimeout);
		showCityDropdown = true;
	}
</script>

<svelte:head>
	<title>Rocket Alert Statistics - GeeBee Forge</title>
</svelte:head>

<div class="dashboard">
	<header>
		<a href="/" class="back">&larr; Home</a>
		<h1>Israel Rocket Alert Statistics</h1>
		<p class="subtitle">
			Data from <a
				href="https://github.com/yuval-harpaz/alarms"
				target="_blank"
				rel="noopener noreferrer">yuval-harpaz/alarms</a
			>
		</p>
	</header>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading alert data (~11 MB)...</p>
		</div>
	{:else if error}
		<div class="error">Error: {error}</div>
	{:else}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{stats.totalAlerts.toLocaleString()}</div>
				<div class="stat-label">Total Alerts</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalCities.toLocaleString()}</div>
				<div class="stat-label">Cities Affected</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.mostHitCity}</div>
				<div class="stat-label">Most-Hit City</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.peakDay}</div>
				<div class="stat-label">Peak Day</div>
			</div>
		</div>

		<div class="filters">
			<div class="filter-group">
				<label for="city-search">City</label>
				<div class="city-search">
					<input
						id="city-search"
						type="text"
						placeholder="Search city..."
						bind:value={citySearch}
						onfocus={handleCityFocus}
						onblur={handleCityBlur}
					/>
					{#if cityFilter}
						<button class="clear-btn" onclick={clearCityFilter}>&times;</button>
					{/if}
					{#if showCityDropdown && citySuggestions.length > 0}
						<ul class="city-dropdown">
							{#each citySuggestions as city}
								<li>
									<button onmousedown={() => selectCity(city)}>{city}</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div class="filter-group">
				<label for="start-date">From</label>
				<input id="start-date" type="date" bind:value={startDate} />
			</div>

			<div class="filter-group">
				<label for="end-date">To</label>
				<input id="end-date" type="date" bind:value={endDate} />
			</div>

			<div class="filter-group">
				<label for="origin-select">Origin</label>
				<select id="origin-select" bind:value={originFilter}>
					<option value="">All</option>
					{#each uniqueOrigins as origin}
						<option value={origin}>{origin}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="threat-select">Threat Type</label>
				<select id="threat-select" bind:value={threatFilter}>
					<option value="">All</option>
					{#each uniqueThreats as threat}
						<option value={threat}>{threat}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="chart-section">
			<div class="chart-header">
				<h2>Alerts Over Time</h2>
				<div class="granularity">
					<button class:active={granularity === 'day'} onclick={() => (granularity = 'day')}
						>Day</button
					>
					<button
						class:active={granularity === 'week'}
						onclick={() => (granularity = 'week')}>Week</button
					>
					<button
						class:active={granularity === 'month'}
						onclick={() => (granularity = 'month')}>Month</button
					>
				</div>
			</div>
			<div class="chart-container">
				<canvas bind:this={barCanvas}></canvas>
			</div>
		</div>

		<div class="chart-section">
			<h2>Cumulative Alert Count</h2>
			<div class="chart-container">
				<canvas bind:this={lineCanvas}></canvas>
			</div>
		</div>
	{/if}
</div>

<style>
	.dashboard {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: 100vh;
	}

	header {
		margin-bottom: 2rem;
	}

	.back {
		color: #6ba3ff;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 1.8rem;
		margin: 0.5rem 0 0.25rem;
		color: #e0e0e0;
	}

	.subtitle {
		color: #666;
		font-size: 0.85rem;
		margin: 0;
	}

	.subtitle a {
		color: #6ba3ff;
		text-decoration: none;
	}

	.subtitle a:hover {
		text-decoration: underline;
	}

	/* Loading */
	.loading {
		text-align: center;
		padding: 6rem 2rem;
		color: #888;
	}

	.loading p {
		margin-top: 1rem;
		font-size: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #2a2a2a;
		border-top-color: #6ba3ff;
		border-radius: 50%;
		margin: 0 auto;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		text-align: center;
		padding: 4rem;
		color: #ff6b6b;
		font-size: 1.1rem;
	}

	/* Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: #151515;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		padding: 1.25rem;
		text-align: center;
	}

	.stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: #6ba3ff;
		margin-bottom: 0.25rem;
		word-break: break-word;
	}

	.stat-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Filters */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding: 1.25rem;
		background: #151515;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 150px;
	}

	.filter-group label {
		font-size: 0.7rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.filter-group input,
	.filter-group select {
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 0.5rem;
		color: #e0e0e0;
		font-size: 0.85rem;
		font-family: inherit;
	}

	.filter-group input:focus,
	.filter-group select:focus {
		outline: none;
		border-color: #6ba3ff;
	}

	.filter-group select {
		cursor: pointer;
	}

	/* City search dropdown */
	.city-search {
		position: relative;
	}

	.city-search input {
		width: 100%;
	}

	.clear-btn {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #888;
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem;
		line-height: 1;
	}

	.clear-btn:hover {
		color: #e0e0e0;
	}

	.city-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		max-height: 200px;
		overflow-y: auto;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 6px;
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		z-index: 10;
	}

	.city-dropdown li button {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		text-align: right;
		background: none;
		border: none;
		color: #e0e0e0;
		cursor: pointer;
		font-size: 0.85rem;
		font-family: inherit;
	}

	.city-dropdown li button:hover {
		background: #252525;
	}

	/* Charts */
	.chart-section {
		margin-bottom: 1.5rem;
		background: #151515;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		padding: 1.5rem;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.chart-section h2 {
		font-size: 1.05rem;
		margin: 0 0 1rem;
		color: #e0e0e0;
		font-weight: 600;
	}

	.chart-header h2 {
		margin: 0;
	}

	.granularity {
		display: flex;
		gap: 0.25rem;
	}

	.granularity button {
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 4px;
		padding: 0.3rem 0.75rem;
		color: #888;
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.granularity button:hover {
		border-color: #6ba3ff;
		color: #e0e0e0;
	}

	.granularity button.active {
		background: #6ba3ff;
		border-color: #6ba3ff;
		color: #fff;
	}

	.chart-container {
		height: 350px;
		position: relative;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.dashboard {
			padding: 1rem;
		}

		h1 {
			font-size: 1.3rem;
		}

		.stats-grid {
			grid-template-columns: 1fr 1fr;
		}

		.stat-value {
			font-size: 1.1rem;
		}

		.filters {
			flex-direction: column;
		}

		.filter-group {
			min-width: 100%;
		}

		.chart-container {
			height: 250px;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}
</style>
