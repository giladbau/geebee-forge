import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const params = url.searchParams.toString();
	const apiUrl = `https://redalert.orielhaim.com/api/stats/history${params ? `?${params}` : ''}`;

	try {
		const res = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${platform?.env.REDALERT_API_KEY}` }
		});
		const text = await res.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			return new Response(JSON.stringify({ 
				error: 'Upstream returned non-JSON', 
				status: res.status,
				hasKey: !!platform?.env.REDALERT_API_KEY,
				body: text.slice(0, 500)
			}), {
				status: 502,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify(data), {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to fetch history', detail: String(e) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
