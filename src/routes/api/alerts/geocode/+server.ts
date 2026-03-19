import type { RequestHandler } from './$types';
import coordsData from '$lib/data/israel-cities-coords.json';

const staticCoords: Record<string, { lat: number; lng: number }> = coordsData;

// Strip neighborhood/area suffixes: "באר שבע - מזרח" → "באר שבע"
function normalizeCity(name: string): string {
	let base = name.split(' - ')[0].trim();
	base = base.split(', ')[0].trim();
	return base;
}

function geocodeCity(city: string): { lat: number; lng: number } | null {
	const normalized = normalizeCity(city);
	// Static lookup only — no external calls
	if (staticCoords[city]) return staticCoords[city];
	if (normalized !== city && staticCoords[normalized]) return staticCoords[normalized];
	return null;
}

function geocodeCities(cities: string[]): Record<string, { lat: number; lng: number } | null> {
	const results: Record<string, { lat: number; lng: number } | null> = {};
	for (const city of cities) {
		results[city] = geocodeCity(city);
	}
	return results;
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

	return new Response(JSON.stringify(geocodeCities(cities)), {
		headers: { 'Content-Type': 'application/json' }
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const { cities } = await request.json();
	if (!Array.isArray(cities) || cities.length === 0) {
		return new Response(JSON.stringify({ error: 'Missing cities array' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify(geocodeCities(cities)), {
		headers: { 'Content-Type': 'application/json' }
	});
};
