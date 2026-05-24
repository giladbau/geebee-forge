import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { createIssueId } from './shared/ids.mjs';
import { filterItemsNewerThan, loadPool, loadState, markCompileRun, resetPool, savePool, saveState } from './shared/pool.mjs';
import { buildPreviewDigest } from './shared/render.mjs';
import { filterDigestItems } from './shared/subjects.mjs';
import { nowIso } from './shared/time.mjs';
import { archiveIssueDigest, archiveIssueInput, archivePublishResult, ensureIssueDir } from './shared/archive.mjs';
import { publishDigestToRepo } from './shared/publish.mjs';
import { collectHuggingFaceDailyPapers } from './sources/huggingface-papers.mjs';
import { writeJson } from './shared/fs.mjs';
import path from 'node:path';

const paths = getStatePaths();
const config = await loadConfig();
await ensureDigestStateLayout();

const pool = await loadPool(paths.activePool);
const state = await loadState(paths.activeState);
const publishedAt = nowIso();
const issueId = createIssueId(publishedAt);
const issueDir = await ensureIssueDir(paths.issues, issueId);
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
if (filteredPool.accepted.length === 0 && !config.compile.allow_empty_publish) {
	console.error(JSON.stringify({
		ok: false,
		mode: 'compile',
		error: 'active pool is empty',
		note: 'Compile refuses to publish an empty digest.'
	}, null, 2));
	process.exit(1);
}

await archiveIssueInput(issueDir, filteredPool);

const digest = buildPreviewDigest({
	issueDate: issueId,
	publishedAt,
	compileWindowStartAt: state.last_compile_at,
	items: filteredPool.accepted,
	heroTopicTargetMax: config.compile.hero_topic_target_max,
	notableTargetMax: config.compile.notable_target_max,
	subjectConfig: config.subjects
});
await archiveIssueDigest(issueDir, digest);

try {
	const publishResult = await publishDigestToRepo({
		repoPath: config.repo_path,
		publishPath: config.publish_path,
		issueId,
		digest
	});
	await archivePublishResult(issueDir, publishResult);

	const nextState = markCompileRun(state, { at: publishedAt, publishCommit: `digest: publish ${issueId}` });
	nextState.source_health = {
		...(nextState.source_health ?? {}),
		...sourceHealth
	};
	await saveState(paths.activeState, nextState);
	await savePool(paths.activePool, resetPool());

	console.log(JSON.stringify({
		ok: true,
		mode: 'compile',
		issue_id: issueId,
		archived_issue_dir: issueDir,
		published_file: publishResult.file,
		source_health: sourceHealth,
		pool_cleared: true
	}, null, 2));
} catch (error) {
	await archivePublishResult(issueDir, {
		ok: false,
		issue_id: issueId,
		error: error.message
	});
	console.error(JSON.stringify({
		ok: false,
		mode: 'compile',
		issue_id: issueId,
		archived_issue_dir: issueDir,
		pool_cleared: false,
		error: error.message
	}, null, 2));
	process.exit(1);
}
