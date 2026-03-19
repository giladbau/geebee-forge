<script lang="ts">
	import { onMount } from 'svelte';

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
	let L: any = null;

	// Track previous city data to avoid unnecessary updates
	let prevCityKeys = '';

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
			return;
		}

		// Dedupe check
		const key = cities.map((c) => `${c.city}:${c.count}`).join('|');
		if (key === prevCityKeys) return;
		prevCityKeys = key;

		// Geocode cities
		const cityNames = cities.map((c) => c.city);
		let coords: Record<string, { lat: number; lng: number } | null> = {};
		try {
			const res = await fetch(
				`/api/alerts/geocode?cities=${encodeURIComponent(cityNames.join(','))}`
			);
			if (res.ok) {
				coords = await res.json();
			}
		} catch {
			// Geocoding failed — show map without markers
			return;
		}

		markersLayer.clearLayers();

		const maxCount = Math.max(...cities.map((c) => c.count), 1);

		for (const city of cities) {
			const loc = coords[city.city];
			if (!loc) continue;

			// Radius: log-scaled, 6–30px
			const radius = Math.max(6, Math.min(30, 6 + Math.log(city.count + 1) * 4));

			// Color: interpolate from orange to red based on intensity
			const intensity = city.count / maxCount;
			const r = 239;
			const g = Math.round(160 * (1 - intensity) + 50 * intensity);
			const b = Math.round(50 * (1 - intensity));
			const color = `rgb(${r}, ${g}, ${b})`;

			const marker = L.circleMarker([loc.lat, loc.lng], {
				radius,
				fillColor: color,
				color: 'rgba(239, 68, 68, 0.6)',
				weight: 1,
				fillOpacity: 0.7
			});

			marker.bindPopup(
				`<div style="font-family: system-ui; font-size: 13px; color: #222;">
					<strong>${city.city}</strong>
					${city.zone ? `<br><span style="color: #666; font-size: 11px;">${city.zone}</span>` : ''}
					<br><span style="color: #ef4444; font-weight: 600;">${city.count.toLocaleString()} alerts</span>
				</div>`
			);

			marker.addTo(markersLayer);
		}
	}

	onMount(() => {
		initMap().then(() => {
			if (topCities?.length) {
				updateMarkers(topCities);
			}
		});

		return () => {
			if (map) {
				map.remove();
				map = null;
			}
		};
	});

	$effect(() => {
		if (topCities && map) {
			updateMarkers(topCities);
		}
	});
</script>

<section class="map-section">
	<h2>Alert Map</h2>
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

	.map-section h2 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
		color: #e0e0e0;
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
</style>
