import { loadXAuthToken, fetchHomeTimeline } from '../shared/x-client.mjs';
import { parseHomeTimelineToItems } from '../shared/x-parse.mjs';
import { withinWindow } from '../shared/filter.mjs';

export async function collectXFollowing(_config, { fetchedAt, rawRefBase }) {
	const authToken = await loadXAuthToken();
	const raw = await fetchHomeTimeline(authToken, 40);
	const items = parseHomeTimelineToItems(raw, {
		fetchedAt,
		rawRef: `${rawRefBase}/x-following.json`,
		subtype: 'following'
	}).filter((item) => withinWindow(item.published_at, fetchedAt, _config.window_days));
	return {
		status: 'ok',
		raw,
		items
	};
}
