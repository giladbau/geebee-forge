const DEFAULT_SUBJECTS_CONFIG = {
  enabled: true,
  mode: 'allowlist',
  minimum_match_score: 1,
  professional_only: true,
  families: [
    {
      id: 'gaussian-splatting',
      label: '3D Gaussian Splatting',
      include_terms: [
        '3d gaussian splatting',
        'gaussian splatting',
        'gaussian splats',
        '3dgs',
        '4dgs',
        'splatfacto',
        'gsplat',
        'radiance fields',
        'nerf',
        'neural radiance field'
      ],
      adjacent_terms: [
        'novel view synthesis',
        '3d reconstruction',
        'scene representation',
        'scene reconstruction',
        'dynamic scene reconstruction',
        'differentiable rendering',
        'point-based rendering',
        'photogrammetry',
        'colmap'
      ],
      exclude_terms: []
    },
    {
      id: 'ai-agents',
      label: 'AI Agents',
      include_terms: [
        'ai agents',
        'agentic',
        'coding agent',
        'autonomous agent',
        'claude',
        'gpt',
        'gemini',
        'openclaw',
        'hermes agent'
      ],
      adjacent_terms: [
        'tool use',
        'function calling',
        'mcp',
        'orchestration',
        'memory',
        'planning',
        'browser agent',
        'research agent',
        'reasoning model'
      ],
      exclude_terms: []
    },
    {
      id: 'image-video-genai',
      label: 'Image/Video GenAI',
      include_terms: [
        'image generation',
        'video generation',
        'image editing',
        'video editing',
        'diffusion',
        'segment anything'
      ],
      adjacent_terms: [
        'segmentation',
        'image processing',
        'video processing',
        'multimodal vision',
        'image-to-image',
        'video-to-video',
        'controllable generation',
        'computer vision'
      ],
      exclude_terms: []
    }
  ]
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText(item) {
  return normalizeText([
    item?.title,
    item?.summary,
    item?.snippet,
    item?.author,
    item?.url,
    ...(item?.tags || []),
    ...(item?.sources || []).flatMap((source) => [source?.title, source?.type, source?.url])
  ].join(' '));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchTerms(text, terms = []) {
  const normalizedTerms = unique(terms.map(normalizeText)).filter(Boolean);
  return normalizedTerms.filter((term) => new RegExp(`(^| )${escapeRegExp(term)}($| )`).test(text));
}

function familyMatches(text, family) {
  const includeHits = matchTerms(text, family.include_terms);
  const adjacentHits = matchTerms(text, family.adjacent_terms);
  const excludeHits = matchTerms(text, family.exclude_terms);

  if (excludeHits.length > 0) {
    return {
      score: 0,
      includeHits: [],
      adjacentHits: [],
      excludeHits
    };
  }

  return {
    score: includeHits.length * 2 + adjacentHits.length,
    includeHits,
    adjacentHits,
    excludeHits
  };
}

export function getDefaultSubjectsConfig() {
  return structuredClone(DEFAULT_SUBJECTS_CONFIG);
}

export function getSubjectLabel(subjectId, subjectConfig = DEFAULT_SUBJECTS_CONFIG) {
  const family = (subjectConfig?.families || []).find((entry) => entry.id === subjectId);
  return family?.label || subjectId || 'Unknown';
}

export function classifyDigestItem(item, subjectConfig = DEFAULT_SUBJECTS_CONFIG) {
  if (!subjectConfig?.enabled) {
    return {
      accepted: true,
      item: {
        ...item,
        subject_matches: item.subject_matches || [],
        subject_primary: item.subject_primary || null,
        subject_match_score: item.subject_match_score || 0,
        professional_relevance: item.professional_relevance || 'unknown',
        filter_decision: 'accepted',
        filter_reason: 'subject filtering disabled'
      }
    };
  }

  const text = buildSearchText(item);
  const scoredFamilies = (subjectConfig?.families || []).map((family) => ({
    family,
    ...familyMatches(text, family)
  }));

  const minimumScore = subjectConfig?.minimum_match_score ?? 1;
  const matched = scoredFamilies
    .filter((entry) => entry.score >= minimumScore)
    .sort((a, b) => b.score - a.score || a.family.label.localeCompare(b.family.label));

  if (matched.length === 0) {
    return {
      accepted: false,
      item: {
        ...item,
        subject_matches: [],
        subject_primary: null,
        subject_match_score: 0,
        professional_relevance: 'none',
        filter_decision: 'rejected',
        filter_reason: 'No configured subject family matched'
      }
    };
  }

  const primary = matched[0];
  const subjectMatches = matched.map((entry) => entry.family.id);
  const matchDetails = matched.map((entry) => ({
    id: entry.family.id,
    label: entry.family.label,
    score: entry.score,
    include_hits: entry.includeHits,
    adjacent_hits: entry.adjacentHits
  }));

  return {
    accepted: true,
    item: {
      ...item,
      subject_matches: subjectMatches,
      subject_primary: primary.family.id,
      subject_match_score: primary.score,
      professional_relevance: primary.score >= 4 ? 'high' : primary.score >= 2 ? 'medium' : 'low',
      filter_decision: 'accepted',
      filter_reason: `Matched ${primary.family.label}`,
      subject_match_details: matchDetails
    }
  };
}

export function filterDigestItems(items, subjectConfig = DEFAULT_SUBJECTS_CONFIG) {
  const accepted = [];
  const rejected = [];

  for (const item of items || []) {
    const result = classifyDigestItem(item, subjectConfig);
    if (result.accepted) accepted.push(result.item);
    else rejected.push(result.item);
  }

  return {
    accepted,
    rejected,
    subject_counts: collectSubjectCounts(accepted),
    rejected_count: rejected.length
  };
}

export function collectSubjectCounts(items) {
  return (items || []).reduce((acc, item) => {
    const key = item?.subject_primary || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
