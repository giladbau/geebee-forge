import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/stats/summary${params ? `?${params}` : ''}`;

	try {
		const res = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${platform?.env.REDALERT_API_KEY}` }
		});
		const data = await res.json();
		return new Response(JSON.stringify(data), {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to fetch summary' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
