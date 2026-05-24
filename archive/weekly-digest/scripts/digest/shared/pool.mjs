import { readJson, writeJson } from './fs.mjs';
import { dedupeItems } from './dedupe.mjs';

export function createEmptyPool() {
  return { items: [] };
}

export function createEmptyState() {
  return {
    last_accumulation_at: null,
    last_compile_at: null,
    last_publish_commit: null,
    source_health: {
      reddit: null,
      x_following: null,
      x_bookmarks: null,
      huggingface_daily_papers: null
    },
    subject_counts: {}
  };
}

export function mergePoolItems(existingPool, incomingItems) {
  return { items: dedupeItems([...(existingPool?.items ?? []), ...incomingItems]) };
}

export function filterItemsNewerThan(items, cutoffAt) {
  if (!cutoffAt) return items;
  const cutoff = Date.parse(cutoffAt);
  if (Number.isNaN(cutoff)) return items;

  return items.filter((item) => {
    if (!item?.published_at) return true;
    const publishedAt = Date.parse(item.published_at);
    if (Number.isNaN(publishedAt)) return true;
    return publishedAt > cutoff;
  });
}

export function resetPool() {
  return createEmptyPool();
}

export function markAccumulationRun(state, { at, sourceHealth = {}, subjectCounts = {} }) {
  return {
    ...createEmptyState(),
    ...state,
    last_accumulation_at: at,
    source_health: {
      ...createEmptyState().source_health,
      ...(state?.source_health ?? {}),
      ...sourceHealth
    },
    subject_counts: subjectCounts
  };
}

export function markCompileRun(state, { at, publishCommit = null }) {
  return {
    ...createEmptyState(),
    ...state,
    last_compile_at: at,
    last_publish_commit: publishCommit
  };
}

export async function loadPool(filePath) {
  return readJson(filePath, createEmptyPool());
}

export async function savePool(filePath, pool) {
  return writeJson(filePath, pool);
}

export async function loadState(filePath) {
  return readJson(filePath, createEmptyState());
}

export async function saveState(filePath, state) {
  return writeJson(filePath, state);
}
