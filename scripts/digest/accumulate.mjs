import path from 'node:path';
import { ensureDir, writeJson } from './shared/fs.mjs';
import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { loadPool, loadState, markAccumulationRun, mergePoolItems, savePool, saveState } from './shared/pool.mjs';
import { compactTimestamp, nowIso } from './shared/time.mjs';
import { filterDigestItems } from './shared/subjects.mjs';
import { collectRedditSource } from './sources/reddit.mjs';
import { collectHuggingFaceDailyPapers } from './sources/huggingface-papers.mjs';
import { collectXFollowing } from './sources/x-following.mjs';
import { collectXBookmarks } from './sources/x-bookmarks.mjs';

const runAt = nowIso();
const timestamp = compactTimestamp(runAt);
const paths = getStatePaths();

await ensureDigestStateLayout();
const config = await loadConfig();

const rawRunDir = path.join(paths.raw, timestamp);
await ensureDir(rawRunDir);

const sourceHealth = {
  reddit: null,
  x_following: null,
  x_bookmarks: null,
  huggingface_daily_papers: null
};

const allItems = [];
const collectors = [
  ['reddit', () => collectRedditSource(config.sources.reddit, { fetchedAt: runAt, rawRefBase: rawRunDir })],
  ['x_following', () => collectXFollowing(config.sources.x_following, { fetchedAt: runAt, rawRefBase: rawRunDir })],
  ['x_bookmarks', () => collectXBookmarks(config.sources.x_bookmarks, { fetchedAt: runAt, rawRefBase: rawRunDir })],
  ['huggingface_daily_papers', () => collectHuggingFaceDailyPapers(config.sources.huggingface_daily_papers, { fetchedAt: runAt, rawRefBase: rawRunDir })]
];

for (const [name, runCollector] of collectors) {
  try {
    const result = await runCollector();
    await writeJson(path.join(rawRunDir, `${name}.json`), result.raw);
    allItems.push(...(result.items || []));
    sourceHealth[name] = result.status || 'ok';
  } catch (error) {
    sourceHealth[name] = `error: ${error.message}`;
    await writeJson(path.join(rawRunDir, `${name}.error.json`), {
      run_at: runAt,
      source: name,
      error: error.message
    });
  }
}

const filtered = filterDigestItems(allItems, config.subjects);

await writeJson(path.join(rawRunDir, 'run.json'), {
  run_at: runAt,
  mode: 'accumulate',
  collected_items: allItems.length,
  accepted_items: filtered.accepted.length,
  subject_counts: filtered.subject_counts
});

const pool = await loadPool(paths.activePool);
const existingFiltered = filterDigestItems(pool.items, config.subjects);
const merged = mergePoolItems({ items: existingFiltered.accepted }, filtered.accepted);
await savePool(paths.activePool, merged);

const state = await loadState(paths.activeState);
const nextState = markAccumulationRun(state, {
  at: runAt,
  sourceHealth,
  subjectCounts: filtered.subject_counts
});
await saveState(paths.activeState, nextState);

console.log(JSON.stringify({
  ok: true,
  mode: 'accumulate',
  run_at: runAt,
  raw_run_dir: rawRunDir,
  collected_items: allItems.length,
  accepted_items: filtered.accepted.length,
  pool_items: merged.items.length,
  source_health: sourceHealth,
  subject_counts: filtered.subject_counts
}, null, 2));
