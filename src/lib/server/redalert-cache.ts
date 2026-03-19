const REDALERT_BASE = 'https://redalert.orielhaim.com/api/stats/history';
const PAGE_SIZE = 100;
const BATCH_SIZE = 3;

export const ACTIVE_ALERT_TYPES = ['missiles', 'hostileAircraftIntrusion', 'terroristInfiltration'];

export interface AlertCity {
	id: number;
	name: string;
	zone: string;
}

export interface Alert {
	timestamp: string;
	type?: string;
	cities: AlertCity[];
	origin?: string | null;
	[key: string]: unknown;
}

/**
 * Determine cache TTL based on the date range.
 * If endDate is more than 1 hour in the past, data is historical → 24h cache.
 * Otherwise → 5 minute cache.
 */
export function getCacheTTL(endDate: string | null): number {
	if (!endDate) return 300;
	const end = new Date(endDate).getTime();
	const oneHourAgo = Date.now() - 60 * 60 * 1000;
	return end < oneHourAgo ? 86400 : 300;
}

async function fetchFromUpstream(
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

		// Safety: cap at 5000 alerts to stay within CF execution limits
		if (allAlerts.length >= 5000) break;
	}

	return allAlerts;
}

/**
 * Fetch all history alerts with CF Cache API caching.
 * Cache key is built from query params; TTL depends on whether the date range is historical.
 */
export async function fetchAllHistory(
	params: URLSearchParams,
	apiKey: string
): Promise<Alert[]> {
	// Build a deterministic cache key from sorted params
	const sorted = new URLSearchParams([...params.entries()].sort());
	const cacheUrl = `https://cache.internal/alerts/history?${sorted.toString()}`;
	const cacheKey = new Request(cacheUrl);

	// Try CF Cache API (only available in Workers runtime)
	// caches.default is a CF Workers extension not in standard TS types
	let cache: Cache | undefined;
	try {
		cache = (caches as unknown as { default: Cache }).default;
	} catch {
		// Not in CF Workers runtime (e.g. dev mode) — skip caching
	}

	if (cache) {
		const cached = await cache.match(cacheKey);
		if (cached) {
			return cached.json() as Promise<Alert[]>;
		}
	}

	const alerts = await fetchFromUpstream(params, apiKey);

	if (cache) {
		const ttl = getCacheTTL(params.get('endDate'));
		await cache.put(
			cacheKey,
			new Response(JSON.stringify(alerts), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': `public, max-age=${ttl}`
				}
			})
		);
	}

	return alerts;
}
