import { normalizeRedditPost } from '../shared/normalize.mjs';
import { withinWindow } from '../shared/filter.mjs';
import { dedupeItems } from '../shared/dedupe.mjs';

const LISTING_MODES = ['hot', 'new'];

export async function collectRedditSource(config, { fetchedAt, rawRefBase }) {
	const subreddits = config.subreddits || [];
	const raw = { subreddits: {} };
	const items = [];

	if (subreddits.length === 0) {
		return { status: 'skipped:no-subreddits', raw, items };
	}

	for (const subreddit of subreddits) {
		raw.subreddits[subreddit] = {};
		for (const listingMode of LISTING_MODES) {
			const url = `https://www.reddit.com/r/${subreddit}/${listingMode}.json?limit=25`;
			const response = await fetch(url, {
				headers: { 'User-Agent': 'HermesDigestBot/1.0' }
			});
			if (!response.ok) {
				throw new Error(`Reddit fetch failed for r/${subreddit}/${listingMode}: ${response.status}`);
			}
			const json = await response.json();
			raw.subreddits[subreddit][listingMode] = json;
			const posts = json?.data?.children?.map((child) => child.data) || [];
			for (const post of posts) {
				if ((post.score ?? 0) < (config.min_score ?? 0)) continue;
				const normalized = normalizeRedditPost(post, {
					fetchedAt,
					subreddit,
					rawRef: `${rawRefBase}/reddit.json`
				});
				if (!withinWindow(normalized.published_at, fetchedAt, config.window_days)) continue;
				items.push(normalized);
			}
		}
	}

	return { status: 'ok', raw, items: dedupeItems(items) };
}
