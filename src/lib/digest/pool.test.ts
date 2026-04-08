import { describe, expect, it } from 'vitest';
import {
	createEmptyPool,
	mergePoolItems,
	resetPool,
	createEmptyState,
	markAccumulationRun,
	markCompileRun
} from '../../../scripts/digest/shared/pool.mjs';

describe('digest pool helpers', () => {
	it('creates an empty active pool', () => {
		expect(createEmptyPool()).toEqual({ items: [] });
	});

	it('merges new items without dropping existing unique items', () => {
		const existing = {
			items: [
				{ id: 'reddit:1', url: 'https://reddit.com/1', title: 'one', dedupe_keys: ['reddit:1'] }
			]
		};
		const incoming = [
			{ id: 'reddit:1', url: 'https://reddit.com/1', title: 'duplicate', dedupe_keys: ['reddit:1'] },
			{ id: 'x:2', url: 'https://x.com/2', title: 'two', dedupe_keys: ['x:2'] }
		];

		const merged = mergePoolItems(existing, incoming);

		expect(merged.items).toHaveLength(2);
		expect(merged.items.map((item) => item.id)).toEqual(['reddit:1', 'x:2']);
	});

	it('resets the pool after successful compile', () => {
		const pool = {
			items: [{ id: 'x:2', url: 'https://x.com/2', title: 'two', dedupe_keys: ['x:2'] }]
		};

		expect(resetPool(pool)).toEqual({ items: [] });
	});

	it('tracks accumulation and compile metadata in state', () => {
		const accumulated = markAccumulationRun(createEmptyState(), {
			at: '2026-04-08T12:00:00Z',
			sourceHealth: { reddit: 'ok', x_following: 'ok' }
		});
		const compiled = markCompileRun(accumulated, {
			at: '2026-04-12T08:00:00Z',
			publishCommit: 'abc123'
		});

		expect(compiled).toEqual({
			last_accumulation_at: '2026-04-08T12:00:00Z',
			last_compile_at: '2026-04-12T08:00:00Z',
			last_publish_commit: 'abc123',
			source_health: {
				reddit: 'ok',
				x_following: 'ok',
				x_bookmarks: null,
				huggingface_daily_papers: null
			}
		});
	});
});
