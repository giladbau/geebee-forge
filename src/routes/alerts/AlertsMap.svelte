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

		const maxCount = Math.max(...[...aggregated.values()].map((a) => a.count), 1);

		for (const agg of aggregated.values()) {
			// Radius: log-scaled, 6–30px
			const radius = Math.max(6, Math.min(30, 6 + Math.log(agg.count + 1) * 4));

			// Color: interpolate from orange to red based on intensity
			const intensity = agg.count / maxCount;
			const r = 239;
			const g = Math.round(160 * (1 - intensity) + 50 * intensity);
			const b = Math.round(50 * (1 - intensity));
			const color = `rgb(${r}, ${g}, ${b})`;

			const marker = L.circleMarker([agg.lat, agg.lng], {
				radius,
				fillColor: color,
				color: 'rgba(239, 68, 68, 0.6)',
				weight: 1,
				fillOpacity: 0.7
			});

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

		// Auto-fit map bounds to visible markers
		const validCoords = cities
			.map((c) => coords[c.city])
			.filter((loc): loc is { lat: number; lng: number } => loc !== null);

		if (validCoords.length > 0) {
			const bounds = L.latLngBounds(validCoords.map((c: { lat: number; lng: number }) => [c.lat, c.lng]));
			map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
		} else {
			map.setView([31.5, 34.8], 8);
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
