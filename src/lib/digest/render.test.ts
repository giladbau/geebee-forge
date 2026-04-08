import { describe, expect, it } from 'vitest';
import { buildPreviewDigest } from '../../../scripts/digest/shared/render.mjs';

const items = [
	{
		id: 'x:1',
		source: 'x',
		slug: 'item-1',
		title: 'Item 1',
		summary: 'Summary 1',
		insight: 'Insight 1',
		url: 'https://x.com/1',
		sources: [{ title: 'Item 1', url: 'https://x.com/1', type: 'twitter' }],
		tags: ['agents']
	},
	{
		id: 'x:2',
		source: 'x',
		slug: 'item-2',
		title: 'Item 2',
		summary: 'Summary 2',
		insight: 'Insight 2',
		url: 'https://x.com/2',
		sources: [{ title: 'Item 2', url: 'https://x.com/2', type: 'twitter' }],
		tags: ['vision']
	},
	{
		id: 'x:3',
		source: 'x',
		slug: 'item-3',
		title: 'Item 3',
		summary: 'Summary 3',
		insight: 'Insight 3',
		url: 'https://x.com/3',
		sources: [{ title: 'Item 3', url: 'https://x.com/3', type: 'twitter' }],
		tags: ['tools']
	}
];

describe('digest render', () => {
	it('produces geebee-forge-compatible digest output', () => {
		const digest = buildPreviewDigest({
			issueDate: '2026-04-08',
			publishedAt: '2026-04-08T13:00:00Z',
			items,
			heroTopicTargetMax: 2,
			notableTargetMax: 5
		});

		expect(digest.week).toBe('2026-04-08 to 2026-04-08');
		expect(digest.hero_topics).toHaveLength(2);
		expect(digest.notable).toHaveLength(1);
		expect(digest.hero_topics[0]).toMatchObject({
			title: 'Item 1',
			slug: 'item-1',
			summary: 'Summary 1',
			insight: 'Insight 1'
		});
	});

	it('respects hero and notable limits', () => {
		const digest = buildPreviewDigest({
			issueDate: '2026-04-08',
			publishedAt: '2026-04-08T13:00:00Z',
			items,
			heroTopicTargetMax: 1,
			notableTargetMax: 1
		});

		expect(digest.hero_topics).toHaveLength(1);
		expect(digest.notable).toHaveLength(1);
	});
});
