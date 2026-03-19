import type { RequestHandler } from './$types';
import coordsData from '$lib/data/israel-cities-coords.json';

const staticCoords: Record<string, { lat: number; lng: number }> = coordsData;

// Strip neighborhood/area suffixes: "באר שבע - מזרח" → "באר שבע"
function normalizeCity(name: string): string {
	let base = name.split(' - ')[0].trim();
	base = base.split(', ')[0].trim();
	return base;
}

// In-memory cache for Nominatim lookups (persists within a single CF worker instance)
const nominatimCache = new Map<string, { lat: number; lng: number } | null>();

// Simple queue to rate-limit Nominatim requests (1/sec)
let lastNominatimCall = 0;

async function geocodeViaNominatim(
	city: string
): Promise<{ lat: number; lng: number } | null> {
	// Rate limit: 1 request per second
	const now = Date.now();
	const wait = Math.max(0, 1000 - (now - lastNominatimCall));
	if (wait > 0) {
		await new Promise((r) => setTimeout(r, wait));
	}
	lastNominatimCall = Date.now();

	try {
		const q = encodeURIComponent(`${city}, Israel`);
		const res = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
			{
				headers: {
					'User-Agent': 'GeeBeeForge-AlertsDashboard/1.0 (https://geebee-forge.pages.dev)'
				}
			}
		);
		if (!res.ok) return null;
		const data = await res.json();
		if (data && data.length > 0) {
			return {
				lat: parseFloat(data[0].lat),
				lng: parseFloat(data[0].lon)
			};
		}
		return null;
	} catch {
		return null;
	}
}

async function geocodeCity(
	city: string
): Promise<{ lat: number; lng: number } | null> {
	const normalized = normalizeCity(city);

	// 1. Check static coords (exact, then normalized)
	if (staticCoords[city]) return staticCoords[city];
	if (normalized !== city && staticCoords[normalized]) return staticCoords[normalized];

	// 2. Check in-memory cache (exact, then normalized)
	if (nominatimCache.has(city)) return nominatimCache.get(city) ?? null;
	if (normalized !== city && nominatimCache.has(normalized)) return nominatimCache.get(normalized) ?? null;

	// 3. Fallback to Nominatim with normalized name
	const result = await geocodeViaNominatim(normalized);
	nominatimCache.set(normalized, result);
	return result;
}

export const GET: RequestHandler = async ({ url }) => {
	const citiesParam = url.searchParams.get('cities');
	if (!citiesParam) {
		return new Response(JSON.stringify({ error: 'Missing cities parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const cities = citiesParam.split(',').map((c) => c.trim()).filter(Boolean);
	const results: Record<string, { lat: number; lng: number } | null> = {};

	// Geocode all cities (sequential for Nominatim rate limiting, but static lookups are instant)
	for (const city of cities) {
		results[city] = await geocodeCity(city);
	}

	return new Response(JSON.stringify(results), {
		headers: { 'Content-Type': 'application/json' }
	});
};
