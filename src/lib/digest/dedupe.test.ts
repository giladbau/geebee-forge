import { describe, expect, it } from 'vitest';
import { dedupeItems } from '../../../scripts/digest/shared/dedupe.mjs';

describe('digest dedupe', () => {
	it('collapses exact duplicate source ids', () => {
		const items = [
			{ id: 'reddit:1', url: 'https://reddit.com/1', title: 'one', dedupe_keys: ['reddit:1'] },
			{ id: 'reddit:1', url: 'https://reddit.com/1', title: 'one duplicate', dedupe_keys: ['reddit:1'] }
		];

		expect(dedupeItems(items)).toHaveLength(1);
	});

	it('collapses duplicate canonical urls', () => {
		const items = [
			{ id: 'x:1', url: 'https://x.com/a/status/1', title: 'same url', dedupe_keys: ['x:1'] },
			{ id: 'blog:2', url: 'https://x.com/a/status/1', title: 'same url elsewhere', dedupe_keys: ['blog:2'] }
		];

		expect(dedupeItems(items)).toHaveLength(1);
	});

	it('keeps distinct items', () => {
		const items = [
			{ id: 'x:1', url: 'https://x.com/a/status/1', title: 'one', dedupe_keys: ['x:1'] },
			{ id: 'x:2', url: 'https://x.com/a/status/2', title: 'two', dedupe_keys: ['x:2'] }
		];

		expect(dedupeItems(items)).toHaveLength(2);
	});
});
