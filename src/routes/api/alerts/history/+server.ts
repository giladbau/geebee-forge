import type { RequestHandler } from './$types';
import { getCacheTTL } from '$lib/server/redalert-cache';

export const GET: RequestHandler = async ({ url, platform }) => {
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/stats/history${params ? `?${params}` : ''}`;

	try {
		const res = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${platform?.env.REDALERT_API_KEY}` }
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
		return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
