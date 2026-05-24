import { loadXAuthToken, fetchBookmarkSearchTimeline } from '../shared/x-client.mjs';
import { parseBookmarkSearchTimelineToItems } from '../shared/x-bookmarks-parse.mjs';
import { dedupeItems } from '../shared/dedupe.mjs';
import { withinWindow } from '../shared/filter.mjs';

const QUERIES = ['a','e','i','o','u','s','t','r','n','l','m','d','y','ה','ו','י','ל','מ','ר','ת'];

export async function collectXBookmarks(_config, { fetchedAt, rawRefBase }) {
	const authToken = await loadXAuthToken();
	const raw = {};
	const items = [];

	for (const query of QUERIES) {
		const payload = await fetchBookmarkSearchTimeline(authToken, query, 40);
		raw[query] = payload;
		items.push(...parseBookmarkSearchTimelineToItems(payload, {
			fetchedAt,
			rawRef: `${rawRefBase}/x-bookmarks.json`
		}));
	}

	return {
		status: 'ok',
		raw,
		items: dedupeItems(items).filter((item) => withinWindow(item.published_at, fetchedAt, _config.window_days))
	};
}
