import { describe, expect, it } from 'vitest';
import { collectHuggingFaceDailyPapers } from '../../../scripts/digest/sources/huggingface-papers.mjs';
import { collectRedditSource } from '../../../scripts/digest/sources/reddit.mjs';
import { parseBookmarkSearchTimelineToItems } from '../../../scripts/digest/shared/x-bookmarks-parse.mjs';

describe('digest source collectors', () => {
	it('extracts HuggingFace paper ids from the real nested daily papers shape', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ([
				{
					paper: {
						id: '2604.04979',
						title: 'Squeez',
						summary: 'Summary',
						publishedAt: '2026-04-04T00:00:00.000Z'
					},
					title: 'Squeez',
					summary: 'Summary',
					publishedAt: '2026-04-03T20:00:00.000Z',
					upvotes: 12
				}
			])
		}) as typeof fetch;

		try {
			const result = await collectHuggingFaceDailyPapers({ min_upvotes: 0 }, {
				fetchedAt: '2026-04-08T13:00:00Z',
				rawRefBase: 'raw/run'
			});

			expect(result.status).toBe('ok');
			expect(result.items).toHaveLength(1);
			expect(result.items[0].source_item_id).toBe('2604.04979');
			expect(result.items[0].url).toBe('https://huggingface.co/papers/2604.04979');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('marks reddit collection as skipped when no subreddits are configured', async () => {
		const result = await collectRedditSource({ subreddits: [], min_score: 50 }, {
			fetchedAt: '2026-04-08T13:00:00Z',
			rawRefBase: 'raw/run'
		});

		expect(result.status).toBe('skipped:no-subreddits');
		expect(result.items).toEqual([]);
	});

	it('collects from multiple reddit listing modes to improve coverage without duplicating posts', async () => {
		const originalFetch = globalThis.fetch;
		const seenUrls: string[] = [];
		globalThis.fetch = async (url) => {
			seenUrls.push(String(url));
			return {
				ok: true,
				json: async () => ({
					data: {
						children: [{
							data: {
								id: 'abc123',
								title: 'Gaussian splatting update',
								selftext: 'Scene reconstruction notes',
								author: 'alice',
								score: 100,
								created_utc: 1775650000,
								permalink: '/r/GaussianSplatting/comments/abc123/test/'
							}
						}]
					}
				})
			} as Response;
		};

		try {
			const result = await collectRedditSource({ subreddits: ['GaussianSplatting'], min_score: 50, window_days: 30 }, {
				fetchedAt: '2026-04-08T13:00:00Z',
				rawRefBase: 'raw/run'
			});

			expect(seenUrls.some((url) => url.includes('/hot.json'))).toBe(true);
			expect(seenUrls.some((url) => url.includes('/new.json'))).toBe(true);
			expect(result.items).toHaveLength(1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('falls back to reddit RSS when JSON API listing is blocked', async () => {
		const originalFetch = globalThis.fetch;
		const seenUrls: string[] = [];
		globalThis.fetch = async (url) => {
			seenUrls.push(String(url));
			if (String(url).endsWith('.json?limit=25')) {
				return { ok: false, status: 403 } as Response;
			}
			return {
				ok: true,
				text: async () => `<?xml version="1.0" encoding="UTF-8"?>
					<feed xmlns="http://www.w3.org/2005/Atom">
						<entry>
							<id>t3_rss123</id>
							<title>Open model serving benchmark</title>
							<author><name>bob</name></author>
							<updated>2026-04-08T12:00:00+00:00</updated>
							<link href="https://www.reddit.com/r/LocalLLaMA/comments/rss123/open_model_serving_benchmark/" />
							<content type="html">Benchmark notes with https://github.com/example/server</content>
						</entry>
					</feed>`
			} as Response;
		};

		try {
			const result = await collectRedditSource({ subreddits: ['LocalLLaMA'], min_score: 50, window_days: 30 }, {
				fetchedAt: '2026-04-08T13:00:00Z',
				rawRefBase: 'raw/run'
			});

			expect(seenUrls.some((url) => url.includes('/hot.json'))).toBe(true);
			expect(seenUrls.some((url) => url.includes('/hot/.rss'))).toBe(true);
			expect(result.status).toBe('ok:rss-fallback');
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				source: 'reddit',
				source_item_id: 'rss123',
				title: 'Open model serving benchmark',
				author: 'bob'
			});
			expect(result.items[0].sources.some((source) => source.url === 'https://github.com/example/server')).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('parses bookmark search timeline tweets into canonical X items', () => {
		const items = parseBookmarkSearchTimelineToItems({
			data: {
				search_by_raw_query: {
					bookmarks_search_timeline: {
						timeline: {
							instructions: [{
								entries: [{
									content: {
										itemContent: {
											tweet_results: {
												result: {
													rest_id: '2040470801506541998',
													legacy: {
														full_text: 'A useful bookmarked post',
														created_at: 'Tue Apr 08 13:00:00 +0000 2026',
														favorite_count: 123,
														extended_entities: { media: [{ media_url_https: 'https://pbs.twimg.com/media/example.jpg' }] }
													},
													core: { user_results: { result: { core: { screen_name: 'karpathy' } } } }
												}
											}
										}
									}
								}]
							}]
						}
					}
				}
			}
		}, {
			fetchedAt: '2026-04-08T13:30:00Z',
			rawRef: 'raw/run/x-bookmarks.json'
		});

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			id: 'x:bookmarks:2040470801506541998',
			source: 'x',
			source_subtype: 'bookmarks',
			url: 'https://x.com/karpathy/status/2040470801506541998'
		});
	});
});
