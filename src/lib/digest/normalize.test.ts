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

	it('keeps external evidence links embedded in reddit selftext', () => {
		const item = normalizeRedditPost({
			id: '1sll638',
			title: 'Tencent HY-World 2.0 appears to be dropping',
			url_overridden_by_dest: 'https://v.redd.it/g91l2x98w7vg1',
			permalink: '/r/StableDiffusion/comments/1sll638/tencent_hyworld_20_appears_to_be_dropping_on/',
			author: 'thefi3nd',
			created_utc: 1776199877,
			score: 481,
			selftext: 'Tencent Hunyuan posted an engine-ready World Model [Source](https://x.com/DylanTFWang/status/2043952886166761519). Launch page: https://3d-models.hunyuan.tencent.com/world/'
		}, { fetchedAt: '2026-04-15T21:01:07Z', subreddit: 'StableDiffusion', rawRef: 'raw/run/reddit.json' });

		expect(item.sources).toEqual([
			{ title: 'Tencent HY-World 2.0 appears to be dropping', url: 'https://v.redd.it/g91l2x98w7vg1', type: 'reddit' },
			{ title: 'x.com', url: 'https://x.com/DylanTFWang/status/2043952886166761519', type: 'twitter' },
			{ title: '3d-models.hunyuan.tencent.com', url: 'https://3d-models.hunyuan.tencent.com/world/', type: 'official' }
		]);
		expect(item.dedupe_keys).toContain('url:https://3d-models.hunyuan.tencent.com/world/');
	});

	it('unwraps redirect wrappers and cleans code-style markdown labels', () => {
		const item = normalizeRedditPost({
			id: '1wrapper',
			title: 'Wrapper-heavy source post',
			permalink: '/r/Claude/comments/1wrapper/wrapper_heavy_source_post/',
			author: 'testuser',
			created_utc: 1776199877,
			score: 220,
			selftext: 'Free access: [Mirror](https://clearthis.page/?u=https%3A%2F%2Fwww.tomshardware.com%2Fstory) and `/extract-design` [`https://stripe.com`](https://stripe.com)'
		}, { fetchedAt: '2026-04-15T21:01:07Z', subreddit: 'Claude', rawRef: 'raw/run/reddit.json' });

		expect(item.sources).toEqual([
			{ title: 'Wrapper-heavy source post', url: 'https://reddit.com/r/Claude/comments/1wrapper/wrapper_heavy_source_post/', type: 'reddit' },
			{ title: 'Mirror', url: 'https://www.tomshardware.com/story', type: 'project' },
			{ title: 'stripe.com', url: 'https://stripe.com/', type: 'project' }
		]);
		expect(item.dedupe_keys).toContain('url:https://www.tomshardware.com/story');
		expect(item.dedupe_keys).not.toContain('url:https://clearthis.page/?u=https%3A%2F%2Fwww.tomshardware.com%2Fstory');
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
