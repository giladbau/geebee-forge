import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { createIssueId } from './shared/ids.mjs';
import { loadPool, loadState, markCompileRun, resetPool, savePool, saveState } from './shared/pool.mjs';
import { buildPreviewDigest } from './shared/render.mjs';
import { filterDigestItems } from './shared/subjects.mjs';
import { nowIso } from './shared/time.mjs';
import { archiveIssueDigest, archiveIssueInput, archivePublishResult, ensureIssueDir } from './shared/archive.mjs';
import { publishDigestToRepo } from './shared/publish.mjs';

const paths = getStatePaths();
const config = await loadConfig();
await ensureDigestStateLayout();

const pool = await loadPool(paths.activePool);
const state = await loadState(paths.activeState);
const filteredPool = filterDigestItems(pool.items, config.subjects);
if (filteredPool.accepted.length === 0 && !config.compile.allow_empty_publish) {
	console.error(JSON.stringify({
		ok: false,
		mode: 'compile',
		error: 'active pool is empty',
		note: 'Compile refuses to publish an empty digest.'
	}, null, 2));
	process.exit(1);
}

const publishedAt = nowIso();
const issueId = createIssueId(publishedAt);
const issueDir = await ensureIssueDir(paths.issues, issueId);
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
	await saveState(paths.activeState, nextState);
	await savePool(paths.activePool, resetPool());

	console.log(JSON.stringify({
		ok: true,
		mode: 'compile',
		issue_id: issueId,
		archived_issue_dir: issueDir,
		published_file: publishResult.file,
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
