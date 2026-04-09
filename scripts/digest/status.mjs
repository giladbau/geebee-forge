import { ensureDigestStateLayout, getStatePaths, loadConfig } from './shared/config.mjs';
import { loadPool, loadState } from './shared/pool.mjs';
import { collectSubjectCounts } from './shared/subjects.mjs';

function collectSourceCounts(items) {
  return (items || []).reduce((acc, item) => {
    const key = item.source ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

const paths = getStatePaths();
await ensureDigestStateLayout();
await loadConfig();

const [pool, state] = await Promise.all([
  loadPool(paths.activePool),
  loadState(paths.activeState)
]);

console.log(JSON.stringify({
  ok: true,
  mode: 'status',
  pool_items: pool.items.length,
  source_counts: collectSourceCounts(pool.items),
  subject_counts: collectSubjectCounts(pool.items),
  last_accumulation_at: state.last_accumulation_at,
  last_compile_at: state.last_compile_at,
  last_publish_commit: state.last_publish_commit,
  source_health: state.source_health
}, null, 2));
