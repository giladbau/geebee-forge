import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCacheTTL, fetchFromUpstream, fetchAllHistory, type Alert } from './redalert-cache';

function makeAlert(overrides: Partial<Alert> = {}): Alert {
	return {
		timestamp: '2026-03-15T10:00:00Z',
		type: 'missiles',
		cities: [{ id: 1, name: 'TestCity', zone: 'TestZone' }],
		origin: 'TestOrigin',
		...overrides
	};
}

function makeUpstreamResponse(data: Alert[], hasMore = false) {
	return new Response(JSON.stringify({ data, pagination: { hasMore } }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('getCacheTTL', () => {
	it('returns 300 for null endDate', () => {
		expect(getCacheTTL(null)).toBe(300);
	});

	it('returns 86400 for historical endDate (>1h ago)', () => {
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		expect(getCacheTTL(twoHoursAgo)).toBe(86400);
	});

	it('returns 300 for recent endDate (<1h ago)', () => {
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		expect(getCacheTTL(tenMinutesAgo)).toBe(300);
	});

	it('returns 300 for future endDate', () => {
		const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
		expect(getCacheTTL(future)).toBe(300);
	});
});

describe('fetchFromUpstream', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches single page of results', async () => {
		const alerts = [makeAlert()];
		// BATCH_SIZE=3: all 3 slots in the first batch get called
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.complete).toBe(true);
		expect(result.alerts).toHaveLength(1);
		expect(result.alerts[0].type).toBe('missiles');
	});

	it('paginates across multiple batches', async () => {
		const page1 = Array.from({ length: 100 }, (_, i) => makeAlert({ timestamp: `2026-03-15T${String(i).padStart(2, '0')}:00:00Z` }));
		const page2 = [makeAlert({ timestamp: '2026-03-16T00:00:00Z' })];

		// First batch: 3 pages (BATCH_SIZE=3), first has more
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(page1, true))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			// Second batch: page with remaining data
			.mockResolvedValueOnce(makeUpstreamResponse(page2, false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.complete).toBe(true);
		expect(result.alerts).toHaveLength(101);
	});

	it('marks result as incomplete when a batch request fails', async () => {
		const alerts = [makeAlert()];
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false))
			.mockRejectedValueOnce(new Error('Network error'))
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false));

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.complete).toBe(false);
		// Still returns data from successful batches
		expect(result.alerts).toHaveLength(2);
	});

	it('marks result as incomplete on non-ok HTTP response', async () => {
		fetchMock
			.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.complete).toBe(false);
		expect(result.alerts).toHaveLength(0);
	});

	it('marks result as complete when upstream returns empty data', async () => {
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.complete).toBe(true);
		expect(result.alerts).toHaveLength(0);
	});

	it('sends Authorization header', async () => {
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		await fetchFromUpstream(new URLSearchParams(), 'my-secret-key');

		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: { Authorization: 'Bearer my-secret-key' }
			})
		);
	});

	it('caps at 5000 alerts', async () => {
		const bigPage = Array.from({ length: 100 }, () => makeAlert());
		// Return hasMore=true for many pages to trigger cap
		fetchMock.mockImplementation(() =>
			Promise.resolve(makeUpstreamResponse(bigPage, true))
		);

		const result = await fetchFromUpstream(new URLSearchParams(), 'test-key');

		expect(result.alerts.length).toBeGreaterThanOrEqual(5000);
		// Should stop after reaching 5000 (may slightly exceed due to batch completion)
		expect(result.alerts.length).toBeLessThanOrEqual(5100);
	});
});

describe('fetchAllHistory', () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let cachePut: ReturnType<typeof vi.fn>;
	let cacheMatch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		cachePut = vi.fn().mockResolvedValue(undefined);
		cacheMatch = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('caches', {
			default: { match: cacheMatch, put: cachePut }
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns cached data on cache hit without calling upstream', async () => {
		const cachedAlerts = [makeAlert()];
		cacheMatch.mockResolvedValueOnce(
			new Response(JSON.stringify(cachedAlerts), {
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await fetchAllHistory(new URLSearchParams({ endDate: '2026-03-10' }), 'key');

		expect(result).toEqual(cachedAlerts);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(cachePut).not.toHaveBeenCalled();
	});

	it('fetches from upstream and caches on complete result', async () => {
		const alerts = [makeAlert()];
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const params = new URLSearchParams({ endDate: '2026-03-10T00:00:00Z' });
		const result = await fetchAllHistory(params, 'key');

		expect(result).toHaveLength(1);
		expect(cachePut).toHaveBeenCalledTimes(1);
	});

	it('does NOT cache incomplete results from partial upstream failure', async () => {
		const alerts = [makeAlert()];
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false))
			.mockRejectedValueOnce(new Error('fail'))
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false));

		const result = await fetchAllHistory(new URLSearchParams({ endDate: '2026-03-10' }), 'key');

		// Still returns whatever data we got
		expect(result).toHaveLength(2);
		// But does NOT cache it
		expect(cachePut).not.toHaveBeenCalled();
	});

	it('does NOT cache when upstream is fully down', async () => {
		fetchMock.mockRejectedValue(new Error('Network error'));

		const result = await fetchAllHistory(new URLSearchParams({ endDate: '2026-03-10' }), 'key');

		expect(result).toHaveLength(0);
		expect(cachePut).not.toHaveBeenCalled();
	});

	it('caches legitimate empty results (upstream healthy, no data)', async () => {
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchAllHistory(new URLSearchParams({ endDate: '2026-03-10' }), 'key');

		expect(result).toHaveLength(0);
		expect(cachePut).toHaveBeenCalledTimes(1);
	});

	it('deduplicates concurrent identical calls', async () => {
		const alerts = [makeAlert()];
		fetchMock.mockResolvedValue(makeUpstreamResponse(alerts, false));

		const params = new URLSearchParams({ endDate: '2026-03-10' });
		// Fire two identical calls concurrently
		const [result1, result2] = await Promise.all([
			fetchAllHistory(new URLSearchParams(params), 'key'),
			fetchAllHistory(new URLSearchParams(params), 'key')
		]);

		expect(result1).toEqual(result2);
		// Only one set of upstream fetches should have been made (BATCH_SIZE=3 per batch)
		// Without dedup this would be 6 calls (2 × 3), with dedup it's 3
		expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
	});

	it('uses sorted params for deterministic cache keys', async () => {
		const alerts = [makeAlert()];
		fetchMock.mockResolvedValue(makeUpstreamResponse(alerts, false));

		const params1 = new URLSearchParams();
		params1.set('endDate', '2026-03-10');
		params1.set('startDate', '2026-03-01');

		const params2 = new URLSearchParams();
		params2.set('startDate', '2026-03-01');
		params2.set('endDate', '2026-03-10');

		// Both should produce the same cache key
		const [r1, r2] = await Promise.all([
			fetchAllHistory(params1, 'key'),
			fetchAllHistory(params2, 'key')
		]);

		expect(r1).toEqual(r2);
		// Should deduplicate (same sorted params)
		expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
	});

	it('works without CF Cache API (dev mode)', async () => {
		// Remove caches global to simulate non-Workers env
		vi.stubGlobal('caches', undefined);

		const alerts = [makeAlert()];
		fetchMock
			.mockResolvedValueOnce(makeUpstreamResponse(alerts, false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false))
			.mockResolvedValueOnce(makeUpstreamResponse([], false));

		const result = await fetchAllHistory(new URLSearchParams({ endDate: '2026-03-10' }), 'key');

		expect(result).toHaveLength(1);
	});
});
