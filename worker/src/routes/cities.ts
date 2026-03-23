import type { Env } from '../index';

export async function handleCities(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/data/cities${params ? `?${params}` : ''}`;

	try {
		const res = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${env.REDALERT_API_KEY}` }
		});
		const data = await res.json();
		return new Response(JSON.stringify(data), {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to fetch cities' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
