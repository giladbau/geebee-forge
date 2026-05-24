function canonicalUrl(url, fallback = 'about:blank') {
	return url || fallback;
}

function decodeBasicEntities(value) {
	let decoded = String(value || '');
	for (let index = 0; index < 3; index += 1) {
		const next = decoded
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
		if (next === decoded) break;
		decoded = next;
	}
	return decoded;
}

function isoFromUnixSeconds(value) {
	return new Date(value * 1000).toISOString();
}

function uniqueBy(items, keyFn) {
	const output = [];
	const seen = new Set();
	for (const item of items) {
		const key = keyFn(item);
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(item);
	}
	return output;
}

function normalizeCandidateUrl(value, depth = 0) {
	const trimmed = decodeBasicEntities(value)
		.trim()
		.replace(/[),.;\]]+$/g, '');
	try {
		const parsed = new URL(trimmed);
		if (depth < 2) {
			for (const key of ['u', 'url', 'target', 'dest', 'destination', 'redirect', 'redirect_url']) {
				const nested = parsed.searchParams.get(key);
				if (nested && /^https?:\/\//i.test(decodeBasicEntities(nested).trim())) {
					return normalizeCandidateUrl(nested, depth + 1) || parsed.toString();
				}
			}
		}
		return parsed.toString();
	} catch {
		return null;
	}
}

function hostnameFor(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function sourceTypeForUrl(url) {
	const host = hostnameFor(url);
	if (host === 'github.com') return 'github';
	if (host === 'arxiv.org') return 'paper';
	if (host === 'huggingface.co') return 'huggingface';
	if (host === 'x.com' || host === 'twitter.com') return 'twitter';
	if (host.endsWith('reddit.com') || host === 'redd.it') return 'reddit';
	if (/(^|\.)((anthropic|openai|nvidia|tencent|apple|microsoft|meta)\.com|deepmind\.google|google\.com|blog\.google|ai\.google)$/.test(host)) {
		return 'official';
	}
	return 'project';
}

function isExternalEvidenceUrl(url) {
	const host = hostnameFor(url);
	if (!host) return false;
	if (host === 'i.redd.it' || host === 'v.redd.it' || host === 'preview.redd.it') return false;
	if (host.endsWith('reddit.com') || host === 'redd.it') return false;
	return true;
}

function sourceTitleForUrl(label, url) {
	const host = hostnameFor(url) || url;
	const cleanLabel = decodeBasicEntities(label)
		.replace(/`+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleanLabel) return host;
	if (normalizeCandidateUrl(cleanLabel)) return host;
	if (/^[\W_]+$/.test(cleanLabel)) return host;
	if (/^(source|link|article|read more|view post)$/i.test(cleanLabel)) return host;
	return cleanLabel;
}

function extractExternalSourcesFromText(text) {
	const decoded = decodeBasicEntities(text);
	const sources = [];
	const markdownPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
	const textWithoutMarkdown = decoded.replace(markdownPattern, (_match, label, rawUrl) => {
		const url = normalizeCandidateUrl(rawUrl);
		if (url && isExternalEvidenceUrl(url)) {
			sources.push({
				title: sourceTitleForUrl(label, url),
				url,
				type: sourceTypeForUrl(url)
			});
		}
		return ' ';
	});

	for (const match of textWithoutMarkdown.matchAll(/https?:\/\/[^\s<>"']+/g)) {
		const url = normalizeCandidateUrl(match[0]);
		if (!url || !isExternalEvidenceUrl(url)) continue;
		sources.push({
			title: sourceTitleForUrl('', url),
			url,
			type: sourceTypeForUrl(url)
		});
	}

	return uniqueBy(sources, (source) => source.url);
}

export function normalizeRedditPost(post, { fetchedAt, subreddit, rawRef }) {
	const url = canonicalUrl(
		post.url_overridden_by_dest || (post.permalink ? `https://reddit.com${post.permalink}` : null)
	);
	const sources = uniqueBy([
		{ title: post.title, url, type: 'reddit' },
		...extractExternalSourcesFromText(post.selftext || '')
	], (source) => source.url);
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
		dedupe_keys: uniqueBy([`reddit:${post.id}`, `url:${url}`, ...sources.slice(1).map((source) => `url:${source.url}`)], (value) => value),
		tags: [subreddit.toLowerCase()],
		engagement: { score: post.score ?? 0 },
		raw_ref: rawRef,
		sources
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
