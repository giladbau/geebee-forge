<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import L from 'leaflet';

	// ── Flight constants ──────────────────────────────────────────────
	const FLIGHT = 'LY90';
	const CALLSIGN = 'ELY90';
	const ORIGIN = { code: 'HKT', city: 'Phuket', lat: 8.1132, lon: 98.3169 };
	const DEST = { code: 'TLV', city: 'Tel Aviv', lat: 32.0114, lon: 34.8867 };
	const AIRCRAFT = 'Boeing 777-200';
	const SCHED_DEP_UTC = '15:35';
	const SCHED_ARR_UTC = '01:40';
	const DEP_LOCAL = '22:35';
	const ARR_LOCAL = '04:40';
	const API_URL = `https://api.adsb.lol/v2/callsign/${CALLSIGN}`;
	const REFRESH_MS = 30_000;

	// ── State ─────────────────────────────────────────────────────────
	type AcData = {
		flight: string;
		lat: number;
		lon: number;
		alt_baro: number;
		gs: number;
		track: number;
		t?: string;
	};

	let acData: AcData | null = $state(null);
	let status: 'Not Departed' | 'Airborne' | 'Landed' = $state('Not Departed');
	let lastUpdated: string = $state('—');
	let intervalId: ReturnType<typeof setInterval> | undefined;

	// ── Map refs (set in onMount) ─────────────────────────────────────
	let mapEl: HTMLDivElement;
	let leafletMap: any;
	let planeMarker: any;

	// ── Derived display values ────────────────────────────────────────
	let altitude = $derived(acData ? acData.alt_baro.toLocaleString() : '—');
	let speed = $derived(acData ? String(acData.gs) : '—');
	let heading = $derived(acData ? String(acData.track) : '—');

	function statusColor(s: string) {
		if (s === 'Airborne') return '#22c55e';
		if (s === 'Landed') return '#eab308';
		return '#888';
	}

	// ── Determine status from empty ac array + time ───────────────────
	function resolveEmptyStatus(): 'Not Departed' | 'Landed' {
		const now = new Date();
		const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
		const depUTC = new Date(`${today}T15:35:00Z`);
		// arrival is next day
		const tomorrow = new Date(depUTC.getTime() + 86_400_000).toISOString().slice(0, 10);
		const arrUTC = new Date(`${tomorrow}T01:40:00Z`);
		if (now.getTime() < depUTC.getTime()) return 'Not Departed';
		if (now.getTime() > arrUTC.getTime()) return 'Landed';
		// Between dep and arr with no signal — could be either; default to "Not Departed"
		return 'Not Departed';
	}

	// ── Fetch ADSB data ───────────────────────────────────────────────
	async function fetchFlight() {
		try {
			const res = await fetch(API_URL);
			const data = await res.json();
			if (data.ac && data.ac.length > 0) {
				acData = data.ac[0];
				status = 'Airborne';
				lastUpdated = new Date().toLocaleTimeString();
				updatePlaneMarker();
			} else {
				acData = null;
				status = resolveEmptyStatus();
				lastUpdated = new Date().toLocaleTimeString();
			}
		} catch {
			// Keep previous state on error
		}
	}

	// ── Leaflet helpers ───────────────────────────────────────────────
	function updatePlaneMarker() {
		if (!planeMarker || !acData) return;
		planeMarker.setLatLng([acData.lat, acData.lon]);
		if (leafletMap) {
			leafletMap.flyTo([acData.lat, acData.lon], leafletMap.getZoom(), { duration: 1 });
		}
	}

	function greatCirclePoints(
		lat1d: number, lon1d: number,
		lat2d: number, lon2d: number,
		segments = 100
	): [number, number][] {
		const toRad = (d: number) => (d * Math.PI) / 180;
		const toDeg = (r: number) => (r * 180) / Math.PI;
		const lat1 = toRad(lat1d), lon1 = toRad(lon1d);
		const lat2 = toRad(lat2d), lon2 = toRad(lon2d);
		const d = 2 * Math.asin(
			Math.sqrt(
				Math.sin((lat2 - lat1) / 2) ** 2 +
				Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
			)
		);
		const pts: [number, number][] = [];
		for (let i = 0; i <= segments; i++) {
			const f = i / segments;
			const A = Math.sin((1 - f) * d) / Math.sin(d);
			const B = Math.sin(f * d) / Math.sin(d);
			const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
			const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
			const z = A * Math.sin(lat1) + B * Math.sin(lat2);
			pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
		}
		return pts;
	}

	function initMap() {
		leafletMap = L.map(mapEl).setView([20, 65], 4);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
			attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 19,
		}).addTo(leafletMap);

		// Origin marker
		L.marker([ORIGIN.lat, ORIGIN.lon], {
			icon: L.divIcon({
				className: 'airport-marker',
				html: `<div class="airport-dot"></div><span class="airport-label">${ORIGIN.code}</span>`,
				iconSize: [40, 20],
				iconAnchor: [20, 10],
			}),
		}).addTo(leafletMap);

		// Destination marker
		L.marker([DEST.lat, DEST.lon], {
			icon: L.divIcon({
				className: 'airport-marker',
				html: `<div class="airport-dot"></div><span class="airport-label">${DEST.code}</span>`,
				iconSize: [40, 20],
				iconAnchor: [20, 10],
			}),
		}).addTo(leafletMap);

		// Great-circle route
		const routePts = greatCirclePoints(ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
		L.polyline(routePts, {
			color: '#4a7fff',
			weight: 2,
			opacity: 0.5,
			dashArray: '8 6',
		}).addTo(leafletMap);

		// Plane marker (hidden until airborne)
		planeMarker = L.marker([0, 0], {
			icon: L.divIcon({
				className: 'plane-marker',
				html: '<div class="plane-icon">✈</div>',
				iconSize: [24, 24],
				iconAnchor: [12, 12],
			}),
		});

		if (acData) {
			planeMarker.setLatLng([acData.lat, acData.lon]);
			planeMarker.addTo(leafletMap);
		}
	}

	$effect(() => {
		if (acData && planeMarker && leafletMap) {
			planeMarker.addTo(leafletMap);
			planeMarker.setLatLng([acData.lat, acData.lon]);
		}
	});

	onMount(async () => {
		await fetchFlight();
		intervalId = setInterval(fetchFlight, REFRESH_MS);
		if (typeof window !== 'undefined') {
			initMap();
		}
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
		if (leafletMap) leafletMap.remove();
	});
</script>

<svelte:head>
	<title>LY90 Flight Tracker</title>
	<link
		rel="stylesheet"
		href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
		crossorigin=""
	/>
</svelte:head>

<div class="dashboard">
	<!-- ── Flight Header ─────────────────────────────────────────── -->
	<header class="flight-header">
		<div class="flight-id">
			<h1>{FLIGHT}</h1>
			<span class="airline">El Al</span>
			<span class="aircraft">{AIRCRAFT}</span>
		</div>

		<div class="route">
			<div class="airport origin">
				<span class="code">{ORIGIN.code}</span>
				<span class="city">{ORIGIN.city}</span>
				<span class="time">Dep {DEP_LOCAL} ICT</span>
				<span class="utc">{SCHED_DEP_UTC} UTC</span>
			</div>
			<div class="route-arrow">→</div>
			<div class="airport dest">
				<span class="code">{DEST.code}</span>
				<span class="city">{DEST.city}</span>
				<span class="time">Arr {ARR_LOCAL} IST</span>
				<span class="utc">{SCHED_ARR_UTC} UTC</span>
			</div>
		</div>

		<div class="status-badge" data-testid="status-badge" style="background: {statusColor(status)}20; color: {statusColor(status)}; border-color: {statusColor(status)}40">
			{status}
		</div>
	</header>

	<!-- ── Live Data ─────────────────────────────────────────────── -->
	<section class="live-data" data-testid="live-data" class:dimmed={status !== 'Airborne'}>
		<div class="metric">
			<span class="metric-value">{altitude}</span>
			<span class="metric-label">Altitude (ft)</span>
		</div>
		<div class="metric">
			<span class="metric-value">{speed}</span>
			<span class="metric-label">Speed (kts)</span>
		</div>
		<div class="metric">
			<span class="metric-value">{heading}</span>
			<span class="metric-label">Heading (°)</span>
		</div>
		<div class="metric updated">
			<span class="metric-value small">{lastUpdated}</span>
			<span class="metric-label">Last Updated</span>
		</div>
	</section>

	<!-- ── Map ───────────────────────────────────────────────────── -->
	<section class="map-section">
		<div bind:this={mapEl} data-testid="map-container" id="map"></div>
	</section>

	<a href="/" class="back-link">← Back to GeeBee Forge</a>
</div>

<style>
	.dashboard {
		min-height: 100vh;
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	/* ── Flight Header ──────────────────────────────────────────── */
	.flight-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.flight-id h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0;
		color: #fff;
		letter-spacing: -0.02em;
	}

	.airline {
		display: block;
		color: #4a7fff;
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.aircraft {
		display: block;
		color: #666;
		font-size: 0.8rem;
		margin-top: 0.15rem;
	}

	.route {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex: 1;
		justify-content: center;
	}

	.airport {
		text-align: center;
	}

	.code {
		display: block;
		font-size: 1.6rem;
		font-weight: 700;
		color: #e0e0e0;
	}

	.city {
		display: block;
		color: #888;
		font-size: 0.8rem;
	}

	.time {
		display: block;
		color: #6ba3ff;
		font-size: 0.75rem;
		margin-top: 0.35rem;
	}

	.utc {
		display: block;
		color: #555;
		font-size: 0.7rem;
	}

	.route-arrow {
		font-size: 1.5rem;
		color: #4a7fff;
		opacity: 0.7;
	}

	.status-badge {
		padding: 0.4rem 1rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 600;
		border: 1px solid;
		white-space: nowrap;
	}

	/* ── Live Data ──────────────────────────────────────────────── */
	.live-data {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		padding: 1.5rem;
		background: #151515;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		margin-bottom: 2rem;
		transition: opacity 0.3s;
	}

	.live-data.dimmed {
		opacity: 0.35;
	}

	.metric {
		text-align: center;
	}

	.metric-value {
		display: block;
		font-size: 1.8rem;
		font-weight: 700;
		color: #fff;
		font-variant-numeric: tabular-nums;
	}

	.metric-value.small {
		font-size: 1rem;
		color: #888;
	}

	.metric-label {
		display: block;
		color: #666;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 0.25rem;
	}

	/* ── Map ─────────────────────────────────────────────────────── */
	.map-section {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid #2a2a2a;
		margin-bottom: 2rem;
	}

	#map {
		height: 450px;
		width: 100%;
		background: #0d0d0d;
	}

	/* ── Leaflet custom markers ──────────────────────────────────── */
	:global(.airport-marker) {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	:global(.airport-dot) {
		width: 8px;
		height: 8px;
		background: #4a7fff;
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(74, 127, 255, 0.5);
	}

	:global(.airport-label) {
		color: #e0e0e0;
		font-size: 11px;
		font-weight: 700;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}

	:global(.plane-marker) {
		background: none !important;
		border: none !important;
	}

	:global(.plane-icon) {
		font-size: 20px;
		filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.6));
		line-height: 1;
	}

	/* ── Back link ───────────────────────────────────────────────── */
	.back-link {
		display: inline-block;
		color: #6ba3ff;
		text-decoration: none;
		font-size: 0.85rem;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.back-link:hover {
		opacity: 1;
	}

	/* ── Responsive ──────────────────────────────────────────────── */
	@media (max-width: 640px) {
		.flight-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.live-data {
			grid-template-columns: repeat(2, 1fr);
		}

		#map {
			height: 300px;
		}
	}
</style>
