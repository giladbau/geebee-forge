import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, readJson, writeJson } from './fs.mjs';
import { getDefaultSubjectsConfig } from './subjects.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const stateRoot = process.env.DIGEST_STATE_ROOT || '/home/gilad/work/geebee-forge-digest';
const configPath = path.join(stateRoot, 'config.json');

export const DEFAULT_CONFIG = {
  repo_path: repoRoot,
  publish_path: 'src/lib/digest-data',
  sources: {
    reddit: { enabled: true, subreddits: [], min_score: 50, window_days: 7 },
    x_following: { enabled: true, window_days: 7 },
    x_bookmarks: { enabled: true, window_days: 7 },
    huggingface_daily_papers: { enabled: true, window_days: 7, min_upvotes: 0 }
  },
  subjects: getDefaultSubjectsConfig(),
  compile: {
    hero_topic_target_min: 2,
    hero_topic_target_max: 4,
    notable_target_max: 15,
    allow_empty_publish: false
  }
};

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeArrays(defaults, existing) {
  if (!Array.isArray(existing) || existing.length === 0) return defaults;
  if (defaults.every((item) => typeof item === 'string') && existing.every((item) => typeof item === 'string')) {
    return [...new Set([...defaults, ...existing])];
  }
  if (defaults.every(isRecord) && existing.every(isRecord) && defaults.every((item) => item.id) && existing.every((item) => item.id)) {
    const byId = new Map(defaults.map((item) => [item.id, item]));
    for (const item of existing) {
      byId.set(item.id, mergeWithDefaults(byId.get(item.id) || {}, item));
    }
    return [...byId.values()];
  }
  return existing;
}

function mergeWithDefaults(defaults, existing) {
  if (Array.isArray(defaults)) {
    return mergeArrays(defaults, existing);
  }

  if (!isRecord(defaults)) {
    return existing ?? defaults;
  }

  const merged = { ...defaults };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    merged[key] = mergeWithDefaults(defaultValue, existing?.[key]);
  }

  for (const [key, value] of Object.entries(existing || {})) {
    if (!(key in merged)) merged[key] = value;
  }

  return merged;
}

export function getStatePaths() {
  return {
    root: stateRoot,
    config: configPath,
    raw: path.join(stateRoot, 'raw'),
    active: path.join(stateRoot, 'active'),
    issues: path.join(stateRoot, 'issues'),
    logs: path.join(stateRoot, 'logs'),
    activePool: path.join(stateRoot, 'active', 'pool.json'),
    activeState: path.join(stateRoot, 'active', 'state.json')
  };
}

export async function ensureDigestStateLayout() {
  const paths = getStatePaths();
  await Promise.all([
    ensureDir(paths.root),
    ensureDir(paths.raw),
    ensureDir(paths.active),
    ensureDir(paths.issues),
    ensureDir(paths.logs)
  ]);
  return paths;
}

export async function loadConfig() {
  await ensureDigestStateLayout();
  const existing = await readJson(configPath, null);
  const merged = mergeWithDefaults(DEFAULT_CONFIG, existing || {});

  if (!existing || JSON.stringify(existing) !== JSON.stringify(merged)) {
    await writeJson(configPath, merged);
  }

  return merged;
}
