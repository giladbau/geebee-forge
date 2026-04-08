import digest20260329 from '../digest-data/2026-03-29.json';
import { describe, expect, it } from 'vitest';
import { validateDigestContract } from './contract';

describe('digest contract', () => {
	it('accepts the current published digest JSON shape', () => {
		const result = validateDigestContract(digest20260329);

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('requires top-level digest fields', () => {
		const result = validateDigestContract({});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('missing top-level field: week');
		expect(result.errors).toContain('missing top-level field: published_at');
		expect(result.errors).toContain('missing top-level field: hero_topics');
		expect(result.errors).toContain('missing top-level field: notable');
	});

	it('requires hero topics to contain the frontend fields', () => {
		const result = validateDigestContract({
			week: '2026-03-23 to 2026-03-29',
			published_at: '2026-03-29T08:20:00Z',
			hero_topics: [{ title: 'Only title' }],
			notable: []
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('hero_topics[0].missing field: slug');
		expect(result.errors).toContain('hero_topics[0].missing field: summary');
		expect(result.errors).toContain('hero_topics[0].missing field: insight');
		expect(result.errors).toContain('hero_topics[0].missing field: sources');
		expect(result.errors).toContain('hero_topics[0].missing field: tags');
	});

	it('requires notable items to contain the frontend fields', () => {
		const result = validateDigestContract({
			week: '2026-03-23 to 2026-03-29',
			published_at: '2026-03-29T08:20:00Z',
			hero_topics: [],
			notable: [{ title: 'Only title' }]
		});

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('notable[0].missing field: summary');
		expect(result.errors).toContain('notable[0].missing field: sources');
		expect(result.errors).toContain('notable[0].missing field: tags');
	});
});
