import { normalizeXPost } from './normalize.mjs';

function firstSentence(text = '') {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) return 'Untitled X post';
	return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function parseHomeTimelineToItems(timeline, { fetchedAt, rawRef, subtype }) {
	const tweets = Object.values(timeline?.globalObjects?.tweets || {});
	const users = timeline?.globalObjects?.users || {};
	return tweets
		.filter((tweet) => !tweet.retweeted_status_id_str)
		.map((tweet) => {
			const user = users[tweet.user_id_str] || {};
			const screenName = user.screen_name ? `@${user.screen_name}` : null;
			const text = tweet.full_text || tweet.text || '';
			const mediaUrl = tweet.extended_entities?.media?.[0]?.media_url_https || tweet.entities?.media?.[0]?.media_url_https || null;
			return normalizeXPost({
				id: tweet.id_str,
				text,
				title: firstSentence(text),
				author: screenName,
				url: screenName ? `https://x.com/${screenName.slice(1)}/status/${tweet.id_str}` : `https://x.com/i/web/status/${tweet.id_str}`,
				published_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : fetchedAt,
				likes: tweet.favorite_count ?? 0,
				image_url: mediaUrl
			}, { fetchedAt, subtype, rawRef });
		});
}
