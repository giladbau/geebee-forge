import type { RequestHandler } from './$types';
import { fetchAllHistory, ACTIVE_ALERT_TYPES } from '$lib/server/redalert-cache';

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
		const activeTypes = new Set(ACTIVE_ALERT_TYPES);
		const activeAlerts = allAlerts.filter(a => a.type && activeTypes.has(a.type));
		const filtered = zone
			? activeAlerts.filter((a) => a.cities?.some((c) => c.zone === zone))
			: activeAlerts;

		const counts = new Map<string, number>();
		for (const alert of filtered) {
			const key = groupBy === 'category' ? alert.type : alert.origin;
			if (!key) continue; // skip alerts with null/empty origin or category
			counts.set(key, (counts.get(key) || 0) + 1);
		}

		const data = [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([label, count]) => ({ label, count }));

		const totalAlerts = filtered.length;

		return new Response(JSON.stringify({ data, totalAlerts }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Failed to compute zone distribution' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
