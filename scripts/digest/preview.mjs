import path from 'node:path';
import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { ensureDir, writeJson } from './shared/fs.mjs';
import { loadPool } from './shared/pool.mjs';
import { buildPreviewDigest } from './shared/render.mjs';
import { createIssueId } from './shared/ids.mjs';
import { filterDigestItems } from './shared/subjects.mjs';
import { nowIso } from './shared/time.mjs';

const paths = getStatePaths();
const config = await loadConfig();
await ensureDigestStateLayout();

const pool = await loadPool(paths.activePool);
const publishedAt = nowIso();
const issueId = createIssueId(publishedAt);
const issueDir = path.join(paths.issues, issueId);
await ensureDir(issueDir);

const filteredPool = filterDigestItems(pool.items, config.subjects);

const digest = buildPreviewDigest({
	issueDate: issueId,
	publishedAt,
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
	hero_topics: digest.hero_topics.length,
	notable: digest.notable.length
}, null, 2));
