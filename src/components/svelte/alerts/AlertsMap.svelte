<script lang="ts">
	import { onMount } from 'svelte';
	import boundaryData from '$lib/data/israel-city-boundaries.json';
	import { normalizeCity } from '$lib/utils/city-names';
	import { buildAreaHeatPoints } from '$lib/alerts/heat-points';
	import {
		buildAlertIntensityLegend,
		normalizeAlertIntensity
	} from '$lib/alerts/heat-intensity';

	interface CityData {
		city: string;
		zone: string;
		count: number;
	}

	interface Props {
		topCities: CityData[];
	}

	let { topCities }: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: any = null;
	let markersLayer: any = null;
	let polygonLayer: any = null;
	let heatLayer: any = null;
	let L: any = null;
	let mapMode = $state<'pins' | 'heat'>('pins');
	let expanded = $state(false);
	let cachedHeatPoints: [number, number, number][] = [];
	let heatPluginReady = false;
	let heatLegendItems = $state<{ label: string; min: number; max: number; color: string }[]>([]);
	let maxHeatCount = 0;
	let maxHeatPointWeight = 0;

	async function loadHeatPlugin(): Promise<void> {
		if (heatPluginReady) return;
		if (typeof (L as any).heatLayer === 'function') {
			heatPluginReady = true;
			return;
		}
		return new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
			script.onload = () => { heatPluginReady = true; resolve(); };
			script.onerror = () => reject(new Error('Failed to load leaflet.heat'));
			document.head.appendChild(script);
		});
	}

	/** Dynamic heatmap radius/blur based on zoom — smaller at low zoom to prevent blob formation */
	function getHeatOptions(zoom: number): { radius: number; blur: number } {
		const radius = Math.max(10, Math.min(25, zoom * 2 - 4));
		const blur = Math.round(radius * 0.7);
		return { radius, blur };
	}

	async function initMap() {
		// Dynamic import — Leaflet has no SSR support
		const leaflet = await import('leaflet');
		L = leaflet.default || leaflet;
		(window as any).L = L;

		// Inject Leaflet CSS
		if (!document.querySelector('link[href*="leaflet"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);
		}

		map = L.map(mapContainer, {
			center: [31.5, 34.8],
			zoom: 8,
			zoomControl: true,
			attributionControl: true
		});

		// CartoDB dark matter tiles
		L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(map);

		markersLayer = L.layerGroup().addTo(map);

		map.on('zoomend', () => {
			if (heatLayer && mapMode === 'heat') {
				const opts = getHeatOptions(map.getZoom());
				heatLayer.setOptions(opts);
			}
		});
	}

	async function updateMarkers(cities: CityData[]) {
		if (!map || !L || !markersLayer) return;
		if (!cities || cities.length === 0) {
			markersLayer.clearLayers();
			if (polygonLayer) polygonLayer.clearLayers();
			heatLegendItems = [];
			maxHeatCount = 0;
			maxHeatPointWeight = 0;
			return;
		}

		// Geocode cities
		const cityNames = cities.map((c) => c.city);
		let coords: Record<string, { lat: number; lng: number } | null> = {};
		const API_BASE = import.meta.env.PUBLIC_API_URL || '';
		try {
			const res = await fetch(`${API_BASE}/api/alerts/geocode`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cities: cityNames })
			});
			if (res.ok) {
				coords = await res.json();
			}
		} catch {
			// Geocoding failed — show map without markers
			return;
		}

		markersLayer.clearLayers();

		// Add polygon boundaries for matching cities
		if (polygonLayer) {
			polygonLayer.clearLayers();
			map.removeLayer(polygonLayer);
			polygonLayer = null;
		}

		// Aggregate counts by normalized base city name (for polygon matching)
		const normalizedCountMap = new Map<string, number>();
		for (const c of cities) {
			const base = normalizeCity(c.city);
			normalizedCountMap.set(base, (normalizedCountMap.get(base) || 0) + c.count);
		}

		const matchingFeatures = (boundaryData as any).features.filter(
			(f: any) => normalizedCountMap.has(f.properties.name)
		);
		const areaAlertCounts = Array.from(normalizedCountMap.values());
		const maxAreaAlertCount = Math.max(0, ...areaAlertCounts);
		heatLegendItems = buildAlertIntensityLegend(areaAlertCounts);
		maxHeatCount = maxAreaAlertCount;
		const featureByName = new Map(
			matchingFeatures.map((feature: any) => [feature.properties.name, feature])
		);

		if (matchingFeatures.length > 0) {
			polygonLayer = L.geoJSON(
				{ type: 'FeatureCollection', features: matchingFeatures },
				{
					style: {
						fillColor: '#ef4444',
						fillOpacity: 0.15,
						color: '#ef4444',
						weight: 1,
						opacity: 0.3
					},
					onEachFeature: (feature: any, layer: any) => {
						const name = feature.properties.name;
						const count = normalizedCountMap.get(name) || 0;
						layer.bindPopup(
							`<div style="font-family: system-ui; font-size: 13px; color: #222;">
								<strong>${name}</strong>
								<br><span style="color: #ef4444; font-weight: 600;">${count.toLocaleString()} alerts</span>
							</div>`
						);
					}
				}
			).addTo(map);

		}

		// Aggregate cities that share the same coordinates (same base city after normalization)
		const aggregated = new Map<string, { lat: number; lng: number; count: number; entries: CityData[] }>();
		for (const city of cities) {
			const loc = coords[city.city];
			if (!loc) continue;
			const key = `${loc.lat},${loc.lng}`;
			if (!aggregated.has(key)) {
				aggregated.set(key, { lat: loc.lat, lng: loc.lng, count: 0, entries: [] });
			}
			const agg = aggregated.get(key)!;
			agg.count += city.count;
			agg.entries.push(city);
		}

		// Build heat points from aggregated data, spreading each city's intensity across
		// a few samples inside its boundary so heat mode reflects area intensity instead
		// of just one hotspot per pin/centroid.
		cachedHeatPoints = [];
		for (const agg of aggregated.values()) {
			const normalizedName = normalizeCity(agg.entries[0]?.city || '');
			const feature = featureByName.get(normalizedName);
			cachedHeatPoints.push(...buildAreaHeatPoints({
				lat: agg.lat,
				lng: agg.lng,
				count: agg.count,
				geometry: feature?.geometry ?? null
			}));
		}
		maxHeatPointWeight = Math.max(0, ...cachedHeatPoints.map(([, , weight]) => weight));

		const pinIcon = L.divIcon({
			className: 'alert-pin',
			html: '<div class="pin"></div>',
			iconSize: [12, 12],
			iconAnchor: [6, 6],
			popupAnchor: [0, -8]
		});

		for (const agg of aggregated.values()) {
			const marker = L.marker([agg.lat, agg.lng], { icon: pinIcon });

			// Build popup: if multiple sub-areas, list them
			let popupHtml: string;
			if (agg.entries.length === 1) {
				const city = agg.entries[0];
				popupHtml = `<div style="font-family: system-ui; font-size: 13px; color: #222;">
					<strong>${city.city}</strong>
					${city.zone ? `<br><span style="color: #666; font-size: 11px;">${city.zone}</span>` : ''}
					<br><span style="color: #ef4444; font-weight: 600;">${city.count.toLocaleString()} alerts</span>
				</div>`;
			} else {
				const subList = agg.entries
					.map((e) => `<li>${e.city} — ${e.count.toLocaleString()}</li>`)
					.join('');
				popupHtml = `<div style="font-family: system-ui; font-size: 13px; color: #222;">
					<strong>${agg.entries[0].city.split(' - ')[0].trim()}</strong>
					<br><span style="color: #ef4444; font-weight: 600;">${agg.count.toLocaleString()} alerts total</span>
					<ul style="margin: 4px 0 0; padding-left: 1.2em; font-size: 11px; color: #444;">${subList}</ul>
				</div>`;
			}

			marker.bindPopup(popupHtml);
			marker.addTo(markersLayer);
		}

		// Auto-fit map bounds to visible markers + polygons
		const validCoords = cities
			.map((c) => coords[c.city])
			.filter((loc): loc is { lat: number; lng: number } => loc != null);

		let bounds: any = null;
		if (validCoords.length > 0) {
			bounds = L.latLngBounds(validCoords.map((c: { lat: number; lng: number }) => [c.lat, c.lng]));
		}
		if (polygonLayer) {
			const polyBounds = polygonLayer.getBounds();
			if (polyBounds.isValid()) {
				bounds = bounds ? bounds.extend(polyBounds) : polyBounds;
			}
		}

		if (bounds && bounds.isValid()) {
			if (validCoords.length === 1 && !polygonLayer) {
				map.setView([validCoords[0].lat, validCoords[0].lng], 13);
			} else {
				map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
			}
		} else {
			map.setView([31.5, 34.8], 8);
		}

		syncLayers();
	}

	async function syncLayers() {
		if (!map || !L) return;

		if (mapMode === 'heat') {
			// Hide pins + polygons; show the heat layer only.
			if (markersLayer && map.hasLayer(markersLayer)) map.removeLayer(markersLayer);
			if (polygonLayer && map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);

			// Remove old heat layer
			if (heatLayer) {
				map.removeLayer(heatLayer);
				heatLayer = null;
			}

			if (cachedHeatPoints.length > 0) {
				await loadHeatPlugin();
				if (typeof (L as any).heatLayer !== 'function') {
					console.error('[AlertsMap] L.heatLayer not available after loading plugin');
					return;
				}
				const normalizedPoints: [number, number, number][] = cachedHeatPoints.map(
					([lat, lng, count]) => [lat, lng, normalizeAlertIntensity(count, maxHeatPointWeight)]
				);
				const { radius, blur } = getHeatOptions(map.getZoom());
				heatLayer = (L as any).heatLayer(normalizedPoints, {
					radius,
					blur,
					maxZoom: 15,
					max: 1,
					minOpacity: 0.3,
					gradient: {
						0.15: '#2563eb',
						0.35: '#7c3aed',
						0.6: '#f59e0b',
						0.8: '#ef4444',
						1.0: '#fef08a'
					}
				}).addTo(map);
			}
		} else {
			// Pins mode: remove heat, restore markers + polygons
			if (heatLayer) {
				map.removeLayer(heatLayer);
				heatLayer = null;
			}
			if (markersLayer && !map.hasLayer(markersLayer)) markersLayer.addTo(map);
			if (polygonLayer && !map.hasLayer(polygonLayer)) polygonLayer.addTo(map);
		}
	}

	onMount(() => {
		initMap().then(() => {
			if (topCities?.length) {
				updateMarkers(topCities);
			}
		});

		return () => {
			if (heatLayer) { map?.removeLayer(heatLayer); heatLayer = null; }
			if (map) { map.remove(); map = null; }
		};
	});

	$effect(() => {
		if (topCities && map) {
			updateMarkers(topCities);
		}
	});

	$effect(() => {
		mapMode;
		if (map) syncLayers();
	});

	$effect(() => {
		expanded;
		if (map) {
			setTimeout(() => map.invalidateSize({ animate: true }), 310);
		}
	});
</script>

<section class="map-section">
	<div class="map-header">
		<h2>Alert Map</h2>
		<div class="map-controls">
			<div class="mode-toggle">
				<button class:active={mapMode === 'pins'} onclick={() => mapMode = 'pins'}>Pins</button>
				<button class:active={mapMode === 'heat'} onclick={() => mapMode = 'heat'}>Heat Map</button>
			</div>
			<button
				class="expand-toggle"
				onclick={() => expanded = !expanded}
				title={expanded ? 'Collapse map' : 'Expand map'}
			>
				{expanded ? '\u2195 Collapse' : '\u2195 Expand'}
			</button>
		</div>
	</div>
	<div class="map-container" class:expanded bind:this={mapContainer}></div>
	{#if mapMode === 'heat' && heatLegendItems.length > 0}
		<div class="heat-legend">
			<div class="heat-legend-copy">
				<strong>Area intensity</strong>
				<span>The heat map now spreads each area's alert total across its mapped footprint, so hotter regions reflect intensity rather than just stacked pins.</span>
			</div>
			<div class="heat-legend-scale">
				{#each heatLegendItems as item}
					<div class="legend-item">
						<span class="legend-swatch" style={`background:${item.color}`}></span>
						<span>{item.label}: {item.min.toLocaleString()}{item.max > item.min ? `–${item.max.toLocaleString()}` : '+'}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.map-section {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 10px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.map-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.map-header h2 {
		margin: 0;
		font-size: 1.1rem;
		color: #e0e0e0;
	}

	.map-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.mode-toggle {
		display: flex;
		gap: 0.25rem;
	}

	.mode-toggle button {
		background: #0a0a0a;
		border: 1px solid #333;
		color: #999;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.mode-toggle button:hover {
		border-color: #555;
		color: #ccc;
	}

	.mode-toggle button.active {
		background: #ef4444;
		border-color: #ef4444;
		color: #fff;
	}

	.expand-toggle {
		background: #0a0a0a;
		border: 1px solid #333;
		color: #999;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.expand-toggle:hover {
		border-color: #555;
		color: #ccc;
	}

	.map-container {
		height: 400px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #2a2a2a;
		transition: height 0.3s ease;
	}

	.map-container.expanded {
		height: 700px;
	}

	.heat-legend {
		margin-top: 0.9rem;
		display: grid;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		background: #121212;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
	}

	.heat-legend-copy {
		display: grid;
		gap: 0.3rem;
	}

	.heat-legend-copy strong {
		color: #f5f5f5;
		font-size: 0.9rem;
	}

	.heat-legend-copy span {
		color: #a3a3a3;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.heat-legend-scale {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1rem;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: #d4d4d4;
		font-size: 0.8rem;
	}

	.legend-swatch {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
		flex: 0 0 auto;
	}

	/* Override Leaflet controls for dark theme */
	.map-container :global(.leaflet-control-zoom a) {
		background: #1a1a1a !important;
		color: #e0e0e0 !important;
		border-color: #333 !important;
	}

	.map-container :global(.leaflet-control-attribution) {
		background: rgba(26, 26, 26, 0.8) !important;
		color: #666 !important;
	}

	.map-container :global(.leaflet-control-attribution a) {
		color: #6ba3ff !important;
	}

	.map-container :global(.alert-pin .pin) {
		width: 10px;
		height: 10px;
		background: #ef4444;
		border: 1.5px solid #991b1b;
		border-radius: 50%;
		box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
	}
</style>
