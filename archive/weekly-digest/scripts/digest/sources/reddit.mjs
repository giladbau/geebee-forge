import { normalizeRedditPost } from '../shared/normalize.mjs';
import { withinWindow } from '../shared/filter.mjs';
import { dedupeItems } from '../shared/dedupe.mjs';

const LISTING_MODES = ['hot', 'new'];
const USER_AGENT = 'geebee-forge-digest/0.1 read-only personal weekly AI digest';

function decodeXml(text = '') {
	return String(text)
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'");
}

function stripHtml(text = '') {
	return decodeXml(text)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function firstMatch(text, pattern) {
	return pattern.exec(text)?.[1] || '';
}

function parseRedditRss(xml, { subreddit, fetchedAt }) {
	const entries = [...String(xml).matchAll(/<entry[\s\S]*?<\/entry>/g)].map((match) => match[0]);
	return entries.map((entry) => {
		const link = decodeXml(firstMatch(entry, /<link\b[^>]*href=["']([^"']+)["'][^>]*>/));
		const atomId = stripHtml(firstMatch(entry, /<id[^>]*>([\s\S]*?)<\/id>/));
		const idFromLink = /\/comments\/([^/]+)/.exec(link)?.[1];
		const postId = atomId.replace(/^t3_/, '') || idFromLink || link;
		const updated = stripHtml(firstMatch(entry, /<updated[^>]*>([\s\S]*?)<\/updated>/));
		const content = firstMatch(entry, /<content[^>]*>([\s\S]*?)<\/content>/);
		const publishedMs = Date.parse(updated);
		return {
			id: postId,
			title: stripHtml(firstMatch(entry, /<title[^>]*>([\s\S]*?)<\/title>/)) || 'Untitled Reddit post',
			selftext: stripHtml(content),
			author: stripHtml(firstMatch(entry, /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/)) || null,
			score: 0,
			created_utc: Number.isFinite(publishedMs) ? Math.floor(publishedMs / 1000) : null,
			permalink: link ? new URL(link).pathname : `/r/${subreddit}/comments/${postId}/`,
			url_overridden_by_dest: link
		};
	});
}

async function fetchJsonListing(subreddit, listingMode) {
	const url = `https://www.reddit.com/r/${subreddit}/${listingMode}.json?limit=25`;
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) {
		throw new Error(`Reddit fetch failed for r/${subreddit}/${listingMode}: ${response.status}`);
	}
	return { url, json: await response.json() };
}

async function fetchRssListing(subreddit, listingMode, fetchedAt) {
	const url = `https://www.reddit.com/r/${subreddit}/${listingMode}/.rss`;
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) {
		throw new Error(`Reddit RSS fetch failed for r/${subreddit}/${listingMode}: ${response.status}`);
	}
	const xml = await response.text();
	return { url, xml, posts: parseRedditRss(xml, { subreddit, fetchedAt }) };
}

export async function collectRedditSource(config, { fetchedAt, rawRefBase }) {
	const subreddits = config.subreddits || [];
	const raw = { subreddits: {} };
	const items = [];
	let usedRssFallback = false;

	if (subreddits.length === 0) {
		return { status: 'skipped:no-subreddits', raw, items };
	}

	for (const subreddit of subreddits) {
		raw.subreddits[subreddit] = {};
		for (const listingMode of LISTING_MODES) {
			let posts = [];
			try {
				const { json } = await fetchJsonListing(subreddit, listingMode);
				raw.subreddits[subreddit][listingMode] = { format: 'json', payload: json };
				posts = json?.data?.children?.map((child) => child.data) || [];
			} catch (jsonError) {
				const rss = await fetchRssListing(subreddit, listingMode, fetchedAt);
				usedRssFallback = true;
				raw.subreddits[subreddit][listingMode] = {
					format: 'rss',
					json_error: jsonError.message,
					url: rss.url,
					payload: rss.xml
				};
				posts = rss.posts;
			}

			for (const post of posts) {
				if (post.score !== 0 && (post.score ?? 0) < (config.min_score ?? 0)) continue;
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

	return { status: usedRssFallback ? 'ok:rss-fallback' : 'ok', raw, items: dedupeItems(items) };
}
