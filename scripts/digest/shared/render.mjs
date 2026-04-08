import { validateDigestContract } from './contract.mjs';

function rankScore(item) {
	const engagement = item.engagement || {};
	const sourceBase = item.source === 'x'
		? (item.source_subtype === 'bookmarks' ? 500 : 250)
		: item.source === 'huggingface_daily_papers'
			? 200
			: item.source === 'reddit'
				? 100
				: 0;
	const metric = engagement.likes || engagement.score || engagement.upvotes || 0;
	return sourceBase + metric;
}

export function buildPreviewDigest({ issueDate, publishedAt, items, heroTopicTargetMax = 4, notableTargetMax = 15 }) {
	const selected = [...items].sort((a, b) => rankScore(b) - rankScore(a)).slice(0, heroTopicTargetMax + notableTargetMax);
	const hero_topics = selected.slice(0, heroTopicTargetMax).map((item, index) => ({

		title: item.title ?? `Untitled item ${index + 1}`,
		slug: item.slug ?? `item-${index + 1}`,
		summary: item.summary ?? item.snippet ?? 'Pending summary',
		insight: item.insight ?? 'Pending insight',
		image_url: item.image_url ?? null,
		sources: item.sources ?? [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }],
		tags: item.tags ?? []
	}));
	const notable = selected.slice(heroTopicTargetMax, heroTopicTargetMax + notableTargetMax).map((item, index) => ({
		title: item.title ?? `Untitled notable ${index + 1}`,
		summary: item.summary ?? item.snippet ?? 'Pending summary',
		sources: item.sources ?? [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }],
		tags: item.tags ?? []
	}));

	const digest = {
		week: `${issueDate} to ${issueDate}`,
		published_at: publishedAt,
		hero_topics,
		notable
	};

	const validation = validateDigestContract(digest);
	if (!validation.ok) {
		throw new Error(`Generated digest failed contract validation: ${validation.errors.join('; ')}`);
	}

	return digest;
}
