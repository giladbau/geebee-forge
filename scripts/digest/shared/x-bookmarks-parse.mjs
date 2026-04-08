import { normalizeXPost } from './normalize.mjs';

function firstSentence(text = '') {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) return 'Untitled X bookmark';
	return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function extractTweetResult(entry) {
	return entry?.content?.itemContent?.tweet_results?.result;
}

export function parseBookmarkSearchTimelineToItems(payload, { fetchedAt, rawRef }) {
	const instructions = payload?.data?.search_by_raw_query?.bookmarks_search_timeline?.timeline?.instructions || [];
	const items = [];

	for (const instruction of instructions) {
		for (const entry of instruction.entries || []) {
			const tweet = extractTweetResult(entry);
			const legacy = tweet?.legacy;
			const user = tweet?.core?.user_results?.result;
			const screenName = user?.core?.screen_name ? `@${user.core.screen_name}` : null;
			if (!tweet?.rest_id || !legacy) continue;
			const text = legacy.full_text || legacy.text || '';
			const mediaUrl = legacy.extended_entities?.media?.[0]?.media_url_https || legacy.entities?.media?.[0]?.media_url_https || null;
			items.push(normalizeXPost({
				id: tweet.rest_id,
				text,
				title: firstSentence(text),
				author: screenName,
				url: screenName ? `https://x.com/${screenName.slice(1)}/status/${tweet.rest_id}` : `https://x.com/i/web/status/${tweet.rest_id}`,
				published_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : fetchedAt,
				likes: legacy.favorite_count ?? 0,
				image_url: mediaUrl,
				tags: []
			}, { fetchedAt, subtype: 'bookmarks', rawRef }));
		}
	}

	return items;
}
