import type { Env } from '../index';
import { getCacheTTL } from '../lib/redalert-cache';

export async function handleSummary(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/stats/summary${params ? `?${params}` : ''}`;

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
		return new Response(JSON.stringify({ error: 'Failed to fetch summary' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
