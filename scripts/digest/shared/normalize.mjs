function canonicalUrl(url, fallback = 'about:blank') {
	return url || fallback;
}

function isoFromUnixSeconds(value) {
	return new Date(value * 1000).toISOString();
}

export function normalizeRedditPost(post, { fetchedAt, subreddit, rawRef }) {
	const url = canonicalUrl(
		post.url_overridden_by_dest || (post.permalink ? `https://reddit.com${post.permalink}` : null)
	);
	return {
		id: `reddit:${post.id}`,
		source: 'reddit',
		source_subtype: 'subreddit',
		source_item_id: post.id,
		url,
		title: post.title,
		summary: post.selftext || '',
		author: post.author,
		published_at: post.created_utc ? isoFromUnixSeconds(post.created_utc) : fetchedAt,
		fetched_at: fetchedAt,
		dedupe_keys: [`reddit:${post.id}`, `url:${url}`],
		tags: [subreddit.toLowerCase()],
		engagement: { score: post.score ?? 0 },
		raw_ref: rawRef,
		sources: [{ title: post.title, url, type: 'reddit' }]
	};
}

export function normalizeXPost(post, { fetchedAt, subtype, rawRef }) {
	const url = canonicalUrl(post.url);
	return {
		id: `x:${subtype}:${post.id}`,
		source: 'x',
		source_subtype: subtype,
		source_item_id: post.id,
		url,
		title: post.title || post.text || 'Untitled X post',
		summary: post.text || '',
		author: post.author || null,
		published_at: post.published_at || fetchedAt,
		fetched_at: fetchedAt,
		dedupe_keys: [`x:${post.id}`, `url:${url}`],
		tags: post.tags || [],
		engagement: { likes: post.likes ?? 0 },
		raw_ref: rawRef,
		image_url: post.image_url || null,
		sources: [{ title: post.title || post.text || 'X post', url, type: 'twitter' }]
	};
}

export function normalizeHuggingFacePaper(paper, { fetchedAt, rawRef }) {
	const nested = paper.paper || {};
	const paperId = paper.id || nested.id;
	const title = paper.title || nested.title;
	const summary = paper.summary || nested.summary || '';
	const publishedAt = paper.published_at || paper.publishedAt || nested.published_at || nested.publishedAt || fetchedAt;
	const author = paper.author || nested.author || nested.submittedOnDailyBy?.name || null;
	const url = canonicalUrl(paper.url || nested.url || (paperId ? `https://huggingface.co/papers/${paperId}` : null));
	const tags = paper.tags || nested.ai_keywords || [];
	const imageUrl = paper.thumbnail || nested.mediaUrls?.[0] || null;
	return {
		id: `huggingface_daily_papers:${paperId}`,
		source: 'huggingface_daily_papers',
		source_subtype: 'daily_papers',
		source_item_id: paperId,
		url,
		title,
		summary,
		author,
		published_at: publishedAt,
		fetched_at: fetchedAt,
		dedupe_keys: [`hf:${paperId}`, `url:${url}`],
		tags,
		engagement: { upvotes: paper.upvotes ?? nested.upvotes ?? 0 },
		raw_ref: rawRef,
		image_url: imageUrl,
		sources: [{ title, url, type: 'paper' }]
	};
}
