<script lang="ts">
	import { onMount } from 'svelte';
	import boundaryData from '$lib/data/israel-city-boundaries.json';
	import { normalizeCity } from '$lib/utils/city-names';

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
	let cachedHeatPoints: [number, number, number][] = [];

	let heatPluginLoaded = false;

	async function loadHeatPlugin() {
		if (heatPluginLoaded) return;
		// leaflet.heat is a legacy plugin that uses bare `L` references to
		// register L.heatLayer. Vite wraps ESM imports in strict module scope
		// where bare globals are inaccessible, so we inline the source and
		// execute it as a classic <script> tag in global scope.
		(window as any).L = L;
		const heatSrc = (await import('leaflet.heat/dist/leaflet-heat.js?raw')).default;
		const script = document.createElement('script');
		script.textContent = heatSrc;
		document.head.appendChild(script);
		heatPluginLoaded = true;
	}

	async function initMap() {
		// Dynamic import — Leaflet has no SSR support
		const leaflet = await import('leaflet');
		L = leaflet.default || leaflet;

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
	}

	async function updateMarkers(cities: CityData[]) {
		if (!map || !L || !markersLayer) return;
		if (!cities || cities.length === 0) {
			markersLayer.clearLayers();
			if (polygonLayer) polygonLayer.clearLayers();
			return;
		}

		// Geocode cities
		const cityNames = cities.map((c) => c.city);
		let coords: Record<string, { lat: number; lng: number } | null> = {};
		try {
			const res = await fetch('/api/alerts/geocode', {
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

		// Build heat points from aggregated data
		cachedHeatPoints = [];
		for (const agg of aggregated.values()) {
			cachedHeatPoints.push([agg.lat, agg.lng, agg.count]);
		}

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
			// Hide pins + polygons
			if (markersLayer && map.hasLayer(markersLayer)) map.removeLayer(markersLayer);
			if (polygonLayer && map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);

			// Remove old heat layer
			if (heatLayer) {
				map.removeLayer(heatLayer);
				heatLayer = null;
			}

			if (cachedHeatPoints.length > 0) {
				await loadHeatPlugin();
				const maxCount = Math.max(...cachedHeatPoints.map((p) => p[2]));
				heatLayer = (L as any).heatLayer(cachedHeatPoints, {
					radius: 25,
					blur: 15,
					maxZoom: 12,
					max: maxCount,
					minOpacity: 0.3,
					gradient: {
						0.2: '#2563eb',
						0.4: '#7c3aed',
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
		if (map) {
			syncLayers().catch((err) => console.error('[AlertsMap] syncLayers failed:', err));
		}
	});
</script>

<section class="map-section">
	<div class="map-header">
		<h2>Alert Map</h2>
		<div class="mode-toggle">
			<button class:active={mapMode === 'pins'} onclick={() => mapMode = 'pins'}>Pins</button>
			<button class:active={mapMode === 'heat'} onclick={() => mapMode = 'heat'}>Heat Map</button>
		</div>
	</div>
	<div class="map-container" bind:this={mapContainer}></div>
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

	.map-container {
		height: 400px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #2a2a2a;
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
