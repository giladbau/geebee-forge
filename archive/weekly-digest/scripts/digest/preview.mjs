import path from 'node:path';
import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { ensureDir, writeJson } from './shared/fs.mjs';
import { loadPool, loadState } from './shared/pool.mjs';
import { buildPreviewDigest } from './shared/render.mjs';
import { createIssueId } from './shared/ids.mjs';
import { filterDigestItems } from './shared/subjects.mjs';
import { nowIso } from './shared/time.mjs';
import { collectHuggingFaceDailyPapers } from './sources/huggingface-papers.mjs';
import { filterItemsNewerThan } from './shared/pool.mjs';

const paths = getStatePaths();
const config = await loadConfig();
await ensureDigestStateLayout();

const pool = await loadPool(paths.activePool);
const state = await loadState(paths.activeState);
const publishedAt = nowIso();
const issueId = createIssueId(publishedAt);
const issueDir = path.join(paths.issues, issueId);
await ensureDir(issueDir);

const compileItems = [...pool.items];
const sourceHealth = {};
if (config.sources.huggingface_daily_papers?.enabled && config.sources.huggingface_daily_papers?.mode === 'compile') {
	try {
		const result = await collectHuggingFaceDailyPapers(config.sources.huggingface_daily_papers, {
			fetchedAt: publishedAt,
			rawRefBase: issueDir
		});
		await writeJson(path.join(issueDir, 'huggingface-daily-papers.json'), result.raw);
		compileItems.push(...filterItemsNewerThan(result.items, state.last_compile_at));
		sourceHealth.huggingface_daily_papers = `ok:${result.items.length}`;
	} catch (error) {
		sourceHealth.huggingface_daily_papers = `error: ${error.message}`;
	}
}

const filteredPool = filterDigestItems(compileItems, config.subjects);

const digest = buildPreviewDigest({
	issueDate: issueId,
	publishedAt,
	compileWindowStartAt: state.last_compile_at,
	items: filteredPool.accepted,
	heroTopicTargetMax: config.compile.hero_topic_target_max,
	notableTargetMax: config.compile.notable_target_max,
	subjectConfig: config.subjects
});

const previewPath = path.join(issueDir, 'preview.json');
await writeJson(previewPath, digest);

console.log(JSON.stringify({
	ok: true,
	mode: 'preview',
	issue_id: issueId,
	preview_path: previewPath,
	pool_items: filteredPool.accepted.length,
	source_health: sourceHealth,
	hero_topics: digest.hero_topics.length,
	notable: digest.notable.length
}, null, 2));
