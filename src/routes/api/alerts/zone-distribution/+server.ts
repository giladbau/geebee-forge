import type { RequestHandler } from './$types';

const REDALERT_BASE = 'https://redalert.orielhaim.com/api/stats/history';
const PAGE_SIZE = 100;
const BATCH_SIZE = 3;

interface AlertCity {
	id: number;
	name: string;
	zone: string;
}

interface Alert {
	timestamp: string;
	type?: string;
	cities: AlertCity[];
	origin?: string | null;
	[key: string]: unknown;
}

async function fetchAllHistory(
	params: URLSearchParams,
	apiKey: string
): Promise<Alert[]> {
	const allAlerts: Alert[] = [];
	let offset = 0;
	let hasMore = true;

	while (hasMore) {
		const batch: Promise<{ data: Alert[]; hasMore: boolean }>[] = [];
		for (let i = 0; i < BATCH_SIZE && hasMore; i++) {
			const p = new URLSearchParams(params);
			p.set('limit', String(PAGE_SIZE));
			p.set('offset', String(offset + i * PAGE_SIZE));
			const url = `${REDALERT_BASE}?${p.toString()}`;
			batch.push(
				fetch(url, {
					headers: { Authorization: `Bearer ${apiKey}` }
				})
					.then(async (res) => {
						if (!res.ok) return { data: [], hasMore: false };
						const json = await res.json();
						const data = json?.data || [];
						return { data, hasMore: json?.pagination?.hasMore ?? false };
					})
					.catch(() => ({ data: [], hasMore: false }))
			);
		}

		const results = await Promise.all(batch);
		let anyHasMore = false;
		for (const r of results) {
			allAlerts.push(...r.data);
			if (r.hasMore) anyHasMore = true;
		}

		offset += BATCH_SIZE * PAGE_SIZE;
		hasMore = anyHasMore;

		if (allAlerts.length >= 5000) break;
	}

	return allAlerts;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const zone = url.searchParams.get('zone');

	const apiKey = platform?.env.REDALERT_API_KEY || '';
	const groupBy = url.searchParams.get('groupBy') || 'origin';

	const historyParams = new URLSearchParams();
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate') || new Date().toISOString();
	if (startDate) historyParams.set('startDate', startDate);
	historyParams.set('endDate', endDate);
	const origin = url.searchParams.get('origin');
	const category = url.searchParams.get('category');
	const cityName = url.searchParams.get('cityName');
	if (origin) historyParams.set('origin', origin);
	if (category) historyParams.set('category', category);
	if (cityName) historyParams.set('cityName', cityName);

	try {
		const allAlerts = await fetchAllHistory(historyParams, apiKey);
		const filtered = zone
			? allAlerts.filter((a) => a.cities?.some((c) => c.zone === zone))
			: allAlerts;

		const counts = new Map<string, number>();
		for (const alert of filtered) {
			const key = (groupBy === 'category' ? (alert.type || 'Unknown') : (alert.origin || 'Unknown'));
			counts.set(key, (counts.get(key) || 0) + 1);
		}

		const data = [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([label, count]) => ({ label, count }));

		const totalAlerts = filtered.length;

		return new Response(JSON.stringify({ data, totalAlerts, pagination: { total: data.length, limit: data.length, offset: 0, hasMore: false } }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to compute zone distribution' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
