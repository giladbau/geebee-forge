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
		// Build batch of concurrent requests
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

		// Safety: cap at 5000 alerts to stay within CF execution limits
		if (allAlerts.length >= 5000) break;
	}

	return allAlerts;
}

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

export const GET: RequestHandler = async ({ url, platform }) => {
	const zone = url.searchParams.get('zone');
	if (!zone) {
		return new Response(JSON.stringify({ error: 'zone parameter required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const apiKey = platform?.env.REDALERT_API_KEY || '';
	const timelineGroup = url.searchParams.get('timelineGroup') || 'day';
	const topLimit = parseInt(url.searchParams.get('topLimit') || '10', 10);
	const include = url.searchParams.get('include') || '';

	// Build params for RedAlert history API
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
		const filtered = filterByZone(allAlerts, zone);

		const now = Date.now();
		const ms24h = 24 * 60 * 60 * 1000;
		const ms7d = 7 * ms24h;
		const ms30d = 30 * ms24h;

		let last24h = 0;
		let last7d = 0;
		let last30d = 0;
		const cityCount = new Map<string, number>();
		const timelineBuckets = new Map<string, number>();
		const hourlyBuckets = new Map<string, number>();

		for (const alert of filtered) {
			const ts = new Date(alert.timestamp).getTime();
			const age = now - ts;
			if (age <= ms24h) last24h++;
			if (age <= ms7d) last7d++;
			if (age <= ms30d) last30d++;

			// Count cities within the zone
			for (const c of alert.cities || []) {
				if (c.zone === zone) {
					cityCount.set(c.name, (cityCount.get(c.name) || 0) + 1);
				}
			}

			// Timeline bucketing
			const bucketKey = getBucketKey(alert.timestamp, timelineGroup);
			timelineBuckets.set(bucketKey, (timelineBuckets.get(bucketKey) || 0) + 1);

			// Hourly bucketing (always compute for peak)
			const hourKey = alert.timestamp;
			hourlyBuckets.set(hourKey, (hourlyBuckets.get(hourKey) || 0) + 1);
		}

		// Build topCities
		const topCities = [...cityCount.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, topLimit)
			.map(([city, count]) => ({ city, zone, count }));

		// Build timeline
		const timeline = [...timelineBuckets.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([period, count]) => ({ period, count }));

		// Find peak
		let peakPeriod = '';
		let peakCount = 0;
		for (const [period, count] of hourlyBuckets) {
			if (count > peakCount) {
				peakCount = count;
				peakPeriod = period;
			}
		}
		const peakHour = peakPeriod ? new Date(peakPeriod).getUTCHours() : null;

		const result: Record<string, unknown> = {
			totals: {
				range: filtered.length,
				last24h,
				last7d,
				last30d
			},
			uniqueCities: cityCount.size,
			uniqueZones: 1,
			uniqueOrigins: new Set(filtered.map(a => a.origin).filter(Boolean)).size
		};

		const includes = include.split(',');
		if (includes.includes('topCities')) {
			result.topCities = topCities;
		}
		if (includes.includes('topZones')) {
			result.topZones = [{ zone, count: filtered.length }];
		}
		if (includes.includes('topOrigins')) {
			const originCounts = new Map<string, number>();
			for (const alert of filtered) {
				const o = alert.origin || 'Unknown';
				originCounts.set(o, (originCounts.get(o) || 0) + 1);
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
		return new Response(JSON.stringify({ error: 'Failed to compute zone summary' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
