import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { fetchAllHistory, ACTIVE_ALERT_TYPES, type Alert } from '$lib/server/redalert-cache';

export const prerender = false;

function filterByZone(alerts: Alert[], zone: string): Alert[] {
	return alerts.filter((a) =>
		a.cities?.some((c) => c.zone === zone)
	);
}

function getBucketKey(
	dateStr: string,
	group: string
): string {
	const d = new Date(dateStr);
	if (group === 'month') {
		return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
	}
	if (group === 'week') {
		const day = d.getUTCDay();
		const diff = (day === 0 ? -6 : 1) - day;
		const monday = new Date(d);
		monday.setUTCDate(d.getUTCDate() + diff);
		return monday.toISOString().slice(0, 10);
	}
	if (group === 'hour') {
		return dateStr;
	}
	return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const zone = url.searchParams.get('zone');

	const apiKey = env.REDALERT_API_KEY || '';
	const timelineGroup = url.searchParams.get('timelineGroup') || 'day';
	const topLimit = parseInt(url.searchParams.get('topLimit') || '10', 10);
	const include = url.searchParams.get('include') || '';

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

	const categoriesFilter = url.searchParams.get('categories');
	const allowedTypes = categoriesFilter
		? new Set(categoriesFilter.split(',').map((c) => c.trim()))
		: null;

	try {
		const allAlerts = await fetchAllHistory(historyParams, apiKey);
		const typeFilter = allowedTypes ?? new Set(ACTIVE_ALERT_TYPES);
		const activeAlerts = allAlerts.filter(a => a.type && typeFilter.has(a.type));
		const filtered = zone ? filterByZone(activeAlerts, zone) : activeAlerts;

		const now = Date.now();
		const ms24h = 24 * 60 * 60 * 1000;
		const ms7d = 7 * ms24h;
		const ms30d = 30 * ms24h;

		let last24h = 0;
		let last7d = 0;
		let last30d = 0;
		const cityCount = new Map<string, number>();
		const cityZoneMap = new Map<string, string>();
		const zoneCount = new Map<string, number>();
		const timelineBuckets = new Map<string, number>();
		const hourlyBuckets = new Map<string, number>();

		for (const alert of filtered) {
			const ts = new Date(alert.timestamp).getTime();
			const age = now - ts;
			if (age <= ms24h) last24h++;
			if (age <= ms7d) last7d++;
			if (age <= ms30d) last30d++;

			for (const c of alert.cities || []) {
				if (!zone || c.zone === zone) {
					cityCount.set(c.name, (cityCount.get(c.name) || 0) + 1);
					if (c.zone && !cityZoneMap.has(c.name)) {
						cityZoneMap.set(c.name, c.zone);
					}
				}
				if (!zone && c.zone) {
					zoneCount.set(c.zone, (zoneCount.get(c.zone) || 0) + 1);
				}
			}

			const bucketKey = getBucketKey(alert.timestamp, timelineGroup);
			timelineBuckets.set(bucketKey, (timelineBuckets.get(bucketKey) || 0) + 1);

			const hourKey = alert.timestamp;
			hourlyBuckets.set(hourKey, (hourlyBuckets.get(hourKey) || 0) + 1);
		}

		const topCities = [...cityCount.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, topLimit)
			.map(([city, count]) => ({ city, zone: cityZoneMap.get(city) || zone || '', count }));

		const timeline = [...timelineBuckets.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([period, count]) => ({ period, count }));

		let peakPeriod = '';
		let peakCount = 0;
		for (const [period, count] of hourlyBuckets) {
			if (count > peakCount) {
				peakCount = count;
				peakPeriod = period;
			}
		}

		const result: Record<string, unknown> = {
			totals: {
				range: filtered.length,
				last24h,
				last7d,
				last30d
			},
			uniqueCities: cityCount.size,
			uniqueZones: zone ? 1 : zoneCount.size,
			uniqueOrigins: new Set(filtered.map(a => a.origin).filter(Boolean)).size
		};

		const includes = include.split(',');
		if (includes.includes('topCities')) {
			result.topCities = topCities;
		}
		if (includes.includes('topZones')) {
			if (zone) {
				result.topZones = [{ zone, count: filtered.length }];
			} else {
				result.topZones = [...zoneCount.entries()]
					.sort((a, b) => b[1] - a[1])
					.slice(0, topLimit)
					.map(([z, count]) => ({ zone: z, count }));
			}
		}
		if (includes.includes('topOrigins')) {
			const originCounts = new Map<string, number>();
			for (const alert of filtered) {
				if (!alert.origin) continue;
				originCounts.set(alert.origin, (originCounts.get(alert.origin) || 0) + 1);
			}
			result.topOrigins = [...originCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, topLimit)
				.map(([name, count]) => ({ origin: name, count }));
		}
		if (includes.includes('timeline')) {
			result.timeline = timeline;
		}
		if (includes.includes('peak')) {
			result.peak = peakPeriod
				? { period: peakPeriod, count: peakCount }
				: null;
		}

		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		const detail = e instanceof Error ? e.message : 'Unknown error';
		return new Response(JSON.stringify({ error: 'Failed to compute zone summary', detail }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
