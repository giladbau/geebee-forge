import { normalizeHuggingFacePaper } from '../shared/normalize.mjs';
import { withinWindow } from '../shared/filter.mjs';

export async function collectHuggingFaceDailyPapers(config, { fetchedAt, rawRefBase }) {
	const response = await fetch('https://huggingface.co/api/daily_papers');
	if (!response.ok) {
		throw new Error(`HuggingFace daily papers fetch failed: ${response.status}`);
	}
	const json = await response.json();
	const papers = Array.isArray(json) ? json : (json?.papers || []);
	const filtered = papers.filter((paper) => ((paper.upvotes ?? paper.paper?.upvotes ?? 0) >= (config.min_upvotes ?? 0)));
	const items = filtered
		.map((paper) => normalizeHuggingFacePaper(paper, {
			fetchedAt,
			rawRef: `${rawRefBase}/huggingface-daily-papers.json`
		}))
		.filter((item) => withinWindow(item.published_at, fetchedAt, config.window_days));
	return {
		status: 'ok',
		raw: json,
		items
	};
}
