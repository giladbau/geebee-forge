import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index';

const env = { REDALERT_API_KEY: 'test-key' };

function makeRequest(path: string, method = 'GET', body?: unknown): Request {
	const init: RequestInit = { method, headers: { Origin: 'https://geebee-forge.pages.dev' } };
	if (body) {
		init.body = JSON.stringify(body);
		init.headers = { ...init.headers, 'Content-Type': 'application/json' };
	}
	return new Request(`https://worker.test${path}`, init);
}

describe('Worker routing', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('caches', undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 404 for unknown routes', async () => {
		const res = await worker.fetch(makeRequest('/unknown'), env);
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data).toEqual({ error: 'Not found' });
	});

	it('handles CORS preflight', async () => {
		const req = new Request('https://worker.test/api/alerts/summary', {
			method: 'OPTIONS',
			headers: { Origin: 'https://geebee-forge.pages.dev' }
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://geebee-forge.pages.dev');
		expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
	});

	it('adds CORS headers to all responses', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ total: 5 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const res = await worker.fetch(makeRequest('/api/alerts/summary?startDate=2026-03-01'), env);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://geebee-forge.pages.dev');
	});

	it('routes /api/alerts/summary correctly', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ total: 10 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const res = await worker.fetch(makeRequest('/api/alerts/summary?startDate=2026-03-01'), env);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ total: 10 });
	});

	it('routes /api/alerts/geocode GET correctly', async () => {
		const res = await worker.fetch(makeRequest('/api/alerts/geocode?cities=תל אביב'), env);
		expect(res.status).toBe(200);
		const data = await res.json() as Record<string, unknown>;
		// Should return a result (may or may not find the city in coords data)
		expect(typeof data).toBe('object');
	});

	it('routes /api/alerts/geocode POST correctly', async () => {
		const res = await worker.fetch(
			makeRequest('/api/alerts/geocode', 'POST', { cities: ['תל אביב'] }),
			env
		);
		expect(res.status).toBe(200);
	});

	it('returns 400 for geocode without cities param', async () => {
		const res = await worker.fetch(makeRequest('/api/alerts/geocode'), env);
		expect(res.status).toBe(400);
	});

	it('routes /api/alerts/cities correctly', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [], pagination: {} }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const res = await worker.fetch(makeRequest('/api/alerts/cities?limit=10'), env);
		expect(res.status).toBe(200);
	});

	it('routes /api/alerts/zone-summary correctly', async () => {
		// zone-summary uses fetchAllHistory which calls fetch multiple times
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ data: [], pagination: { hasMore: false } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const res = await worker.fetch(
			makeRequest('/api/alerts/zone-summary?startDate=2026-03-01T00:00:00Z&endDate=2026-03-10T00:00:00Z&include=topCities'),
			env
		);
		expect(res.status).toBe(200);
		const data = await res.json() as Record<string, unknown>;
		expect(data).toHaveProperty('totals');
	});

	it('routes /api/alerts/zone-distribution correctly', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ data: [], pagination: { hasMore: false } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const res = await worker.fetch(
			makeRequest('/api/alerts/zone-distribution?startDate=2026-03-01T00:00:00Z&endDate=2026-03-10T00:00:00Z'),
			env
		);
		expect(res.status).toBe(200);
		const data = await res.json() as Record<string, unknown>;
		expect(data).toHaveProperty('data');
		expect(data).toHaveProperty('totalAlerts');
	});
});
