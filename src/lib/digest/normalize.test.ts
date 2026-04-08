import { describe, expect, it } from 'vitest';
import {
	normalizeHuggingFacePaper,
	normalizeRedditPost,
	normalizeXPost
} from '../../../scripts/digest/shared/normalize.mjs';

describe('digest normalization', () => {
	it('normalizes a reddit post into the canonical item shape', () => {
		const item = normalizeRedditPost({
			id: 'abc123',
			title: 'Claude can now use your computer',
			permalink: '/r/ClaudeAI/comments/abc123/claude_can_now_use_your_computer/',
			author: 'testuser',
			created_utc: 1712568000,
			score: 123,
			selftext: 'body text'
		}, { fetchedAt: '2026-04-08T13:00:00Z', subreddit: 'ClaudeAI', rawRef: 'raw/run/reddit.json' });

		expect(item).toMatchObject({
			id: 'reddit:abc123',
			source: 'reddit',
			source_subtype: 'subreddit',
			source_item_id: 'abc123',
			author: 'testuser',
			title: 'Claude can now use your computer',
			url: 'https://reddit.com/r/ClaudeAI/comments/abc123/claude_can_now_use_your_computer/',
			raw_ref: 'raw/run/reddit.json'
		});
		expect(item.dedupe_keys).toContain('reddit:abc123');
	});

	it('normalizes an X post into the canonical item shape', () => {
		const item = normalizeXPost({
			id: '2031558590754894104',
			text: 'Great pipeline',
			author: '@alexfredo87',
			url: 'https://x.com/alexfredo87/status/2031558590754894104',
			published_at: '2026-03-29T08:20:00Z',
			likes: 42
		}, { fetchedAt: '2026-04-08T13:00:00Z', subtype: 'bookmarks', rawRef: 'raw/run/x-bookmarks.json' });

		expect(item).toMatchObject({
			id: 'x:bookmarks:2031558590754894104',
			source: 'x',
			source_subtype: 'bookmarks',
			source_item_id: '2031558590754894104',
			author: '@alexfredo87',
			url: 'https://x.com/alexfredo87/status/2031558590754894104',
			raw_ref: 'raw/run/x-bookmarks.json'
		});
		expect(item.dedupe_keys).toContain('x:2031558590754894104');
	});

	it('normalizes a HuggingFace paper into the canonical item shape', () => {
		const item = normalizeHuggingFacePaper({
			id: '2603.03269',
			title: 'LoGeR',
			summary: 'Long-context 3D reconstruction',
			url: 'https://huggingface.co/papers/2603.03269',
			published_at: '2026-03-29T08:20:00Z',
			upvotes: 115
		}, { fetchedAt: '2026-04-08T13:00:00Z', rawRef: 'raw/run/hf.json' });

		expect(item).toMatchObject({
			id: 'huggingface_daily_papers:2603.03269',
			source: 'huggingface_daily_papers',
			source_subtype: 'daily_papers',
			source_item_id: '2603.03269',
			title: 'LoGeR',
			url: 'https://huggingface.co/papers/2603.03269',
			raw_ref: 'raw/run/hf.json'
		});
		expect(item.dedupe_keys).toContain('hf:2603.03269');
	});
});
