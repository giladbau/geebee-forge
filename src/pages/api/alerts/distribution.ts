import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getCacheTTL } from '$lib/server/redalert-cache';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/stats/distribution${params ? `?${params}` : ''}`;

	try {
		const res = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${env.REDALERT_API_KEY}` }
		});
		const data = await res.json();
		const ttl = getCacheTTL(url.searchParams.get('endDate'));
		return new Response(JSON.stringify(data), {
			status: res.status,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': `public, max-age=${ttl}`
			}
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to fetch distribution' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
