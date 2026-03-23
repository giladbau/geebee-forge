import coordsData from '../data/israel-cities-coords.json';
import { normalizeCity } from '../lib/city-names';

const staticCoords: Record<string, { lat: number; lng: number }> = coordsData;

function geocodeCity(city: string): { lat: number; lng: number } | null {
	const normalized = normalizeCity(city);
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

export async function handleGeocode(request: Request): Promise<Response> {
	if (request.method === 'POST') {
		return handleGeocodePost(request);
	}
	return handleGeocodeGet(request);
}

async function handleGeocodeGet(request: Request): Promise<Response> {
	const url = new URL(request.url);
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
}

async function handleGeocodePost(request: Request): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const cities = (body as Record<string, unknown>)?.cities;
	if (!Array.isArray(cities) || cities.length === 0) {
		return new Response(JSON.stringify({ error: 'Missing cities array' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify(geocodeCities(cities)), {
		headers: { 'Content-Type': 'application/json' }
	});
}
