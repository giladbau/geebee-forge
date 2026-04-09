import { validateDigestContract } from './contract.mjs';
import { getDefaultSubjectsConfig, getSubjectLabel } from './subjects.mjs';

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(value, maxLength = 320) {
  const cleaned = decodeBasicEntities(value)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\\-/g, '-')
    .replace(/[•*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function itemText(item) {
  return cleanText([
    item?.title,
    item?.summary,
    item?.snippet,
    ...(item?.tags || [])
  ].join(' '), 600).toLowerCase();
}

function qualityAdjustment(item) {
  const text = itemText(item);
  let score = 0;

  const highSignalPatterns = [
    /\b(project|paper|model|benchmark|framework|release|launch|agents?|tool use|orchestration|memory|coding|image|video|diffusion|segmentation|gaussian|splat|reconstruction|rendering)\b/,
    /\bgithub\b/,
    /\barxiv\b/
  ];

  const lowSignalPatterns = [
    /\baccus(?:e|ing|ation|ed)\b/,
    /\bsexual abuse\b/,
    /\bsister\b/,
    /\bsociopath\b/,
    /\bpathological liar\b/,
    /\bdrama\b/,
    /\bgossip\b/
  ];

  for (const pattern of highSignalPatterns) {
    if (pattern.test(text)) score += 120;
  }

  for (const pattern of lowSignalPatterns) {
    if (pattern.test(text)) score -= 500;
  }

  if ((item.summary || item.snippet || '').length > 120) score += 60;
  if ((item.sources || []).some((source) => /paper|github|project/i.test(`${source?.type || ''} ${source?.url || ''} ${source?.title || ''}`))) score += 80;

  return score;
}

function engagementScore(item) {
  const engagement = item.engagement || {};
  const rawMetric = engagement.likes || engagement.score || engagement.upvotes || 0;
  if (!rawMetric) return 0;
  return Math.round(Math.log10(rawMetric + 1) * 120);
}

function rankScore(item) {
  const sourceBase = item.source === 'x'
    ? (item.source_subtype === 'bookmarks' ? 500 : 250)
    : item.source === 'huggingface_daily_papers'
      ? 200
      : item.source === 'reddit'
        ? 100
        : 0;
  const metric = engagementScore(item);
  const subjectBonus = (item.subject_match_score || 0) * 50;
  return sourceBase + metric + subjectBonus + qualityAdjustment(item);
}

function uniqueBy(items, keyFn) {
  const output = [];
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function detectAiSubtheme(item) {
  const text = itemText(item);
  if (/\b(glasswing|mythos|opus|sonnet|gpt|gemini|muse spark|release|launch|preview|frontier model|model update)\b/.test(text)) {
    return { id: 'frontier-models', label: 'Frontier Models' };
  }
  if (/\b(paper|benchmark|evaluation|safety|analysis|study|research|arxiv|openclaw)\b/.test(text)) {
    return { id: 'research-and-evals', label: 'Research & Evals' };
  }
  if (/\b(harness|orchestration|deployment|managed agents|framework|tooling|infrastructure|platform|mcp)\b/.test(text)) {
    return { id: 'tooling-and-platforms', label: 'Tooling & Platforms' };
  }
  return { id: 'applications-and-builds', label: 'Applications & Builds' };
}

function groupForItem(item, subjectConfig) {
  const subjectId = item.subject_primary || 'unknown';
  const subjectLabel = getSubjectLabel(subjectId, subjectConfig);

  if (subjectId === 'ai-agents') {
    const subtheme = detectAiSubtheme(item);
    return {
      groupKey: `${subjectId}:${subtheme.id}`,
      subjectId,
      subjectLabel,
      subthemeId: subtheme.id,
      subthemeLabel: subtheme.label
    };
  }

  return {
    groupKey: subjectId,
    subjectId,
    subjectLabel,
    subthemeId: null,
    subthemeLabel: null
  };
}

function buildGroups(items, subjectConfig) {
  const groups = new Map();

  for (const item of items) {
    const groupInfo = groupForItem(item, subjectConfig);
    if (!groups.has(groupInfo.groupKey)) {
      groups.set(groupInfo.groupKey, { ...groupInfo, items: [] });
    }
    groups.get(groupInfo.groupKey).items.push(item);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = [...group.items].sort((a, b) => rankScore(b) - rankScore(a));
      const topScore = sorted[0] ? rankScore(sorted[0]) : 0;
      return {
        ...group,
        items: sorted,
        topScore,
        groupScore: topScore + sorted.length * 25
      };
    })
    .sort((a, b) => b.groupScore - a.groupScore || a.subjectLabel.localeCompare(b.subjectLabel));
}

function selectHeroGroups(groups, heroTopicTargetMax) {
  const selected = [];
  const usedSubjects = new Set();

  for (const group of groups) {
    if (selected.length >= heroTopicTargetMax) break;
    if (usedSubjects.has(group.subjectId)) continue;
    selected.push(group);
    usedSubjects.add(group.subjectId);
  }

  for (const group of groups) {
    if (selected.length >= heroTopicTargetMax) break;
    if (selected.some((entry) => entry.groupKey === group.groupKey)) continue;
    selected.push(group);
  }

  return selected;
}

function buildSupportingSources(group) {
  return uniqueBy(
    group.items.flatMap((item) => item.sources || [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }]),
    (source) => `${source.title}|${source.url}`
  ).slice(0, 4);
}

function buildHeroSummary(group) {
  const extraCount = Math.max(group.items.length - 1, 0);
  const topTitles = uniqueBy(group.items.map((item) => cleanText(item.title, 90)).filter(Boolean), (value) => value).slice(0, 3);

  if (group.items.length >= 2) {
    const synthesized = cleanText(`Key signals this cycle: ${topTitles.join('; ')}.`, 420);
    return extraCount > 0 ? `${synthesized} Includes ${extraCount} additional in-scope item${extraCount === 1 ? '' : 's'}.` : synthesized;
  }

  const lead = group.items[0];
  const leadSummary = cleanText(lead?.summary ?? lead?.snippet ?? '', 260);
  if (leadSummary) return leadSummary;
  return cleanText(`Lead item: ${lead?.title ?? 'Untitled item'}.`, 180) || 'Pending summary.';
}

function buildHeroInsight(group, supporting) {
  const lead = group.items[0];
  const secondary = group.items[1];
  const subjectLabel = group.subjectLabel;
  const sourceTypes = uniqueBy(supporting, (source) => source.type).length;

  if (group.subjectId === 'ai-agents' && group.subthemeLabel) {
    return cleanText(`The dominant thread in ${subjectLabel} this cycle was ${group.subthemeLabel.toLowerCase()}. ${lead?.title ?? 'The lead item'} set the pace${secondary ? `, with ${secondary.title} reinforcing the same direction` : ''}. Practical takeaway: watch how these signals change agent capability, deployment, or operating risk.`, 320);
  }

  if (group.subjectId === 'image-video-genai') {
    return cleanText(`The dominant thread in ${subjectLabel} this cycle was workflow-oriented visual tooling and model quality. ${lead?.title ?? 'The lead item'} anchors the story${secondary ? `, while ${secondary.title} shows where the field is extending next` : ''}. Practical takeaway: pay attention to tools that improve controllability, editing, and production readiness.`, 320);
  }

  if (group.subjectId === 'gaussian-splatting') {
    return cleanText(`The dominant thread in ${subjectLabel} this cycle was practical scene-editing and reconstruction workflow progress. ${lead?.title ?? 'The lead item'} is the clearest signal${secondary ? `, with ${secondary.title} adding adjacent research context` : ''}. Practical takeaway: the space still looks early, but tools are getting closer to usable pipelines.`, 320);
  }

  return cleanText(`The dominant thread in ${subjectLabel} this cycle was ${lead?.title ?? 'the lead item'}. ${secondary ? `${secondary.title} provided supporting evidence. ` : ''}This theme surfaced across ${sourceTypes} source type${sourceTypes === 1 ? '' : 's'}, suggesting it is worth tracking into the next cycle.`, 320);
}

function buildHeroTopic(group, index) {
  const lead = group.items[0];
  const supporting = buildSupportingSources(group);
  const tags = uniqueBy([
    ...(lead.tags || []),
    group.subjectId,
    group.subthemeId
  ].filter(Boolean), (value) => value).slice(0, 8);
  const titlePrefix = group.subthemeLabel ? `${group.subjectLabel} — ${group.subthemeLabel}` : group.subjectLabel;

  return {
    title: `${titlePrefix}: ${cleanText(lead.title ?? `Topic ${index + 1}`, 120)}`,
    slug: lead.slug ?? `${group.subjectId}-${group.subthemeId || index + 1}`,
    summary: buildHeroSummary(group),
    insight: buildHeroInsight(group, supporting),
    image_url: lead.image_url ?? null,
    sources: supporting,
    tags
  };
}

function buildNotableItems(items, notableTargetMax) {
  const perSubjectCounts = new Map();
  const output = [];

  for (const item of items) {
    if (output.length >= notableTargetMax) break;
    const subject = item.subject_primary || 'unknown';
    const count = perSubjectCounts.get(subject) || 0;
    if (count >= 6) continue;
    output.push({
      title: cleanText(item.title ?? `Untitled notable ${output.length + 1}`, 140),
      summary: cleanText(item.summary ?? item.snippet ?? '', 260) || 'Pending summary',
      sources: item.sources ?? [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }],
      tags: uniqueBy([...(item.tags || []), ...(item.subject_matches || []), item.subject_primary].filter(Boolean), (value) => value)
    });
    perSubjectCounts.set(subject, count + 1);
  }

  return output;
}

export function buildPreviewDigest({
  issueDate,
  publishedAt,
  items,
  heroTopicTargetMax = 4,
  notableTargetMax = 15,
  subjectConfig = getDefaultSubjectsConfig()
}) {
  const ranked = [...items].sort((a, b) => rankScore(b) - rankScore(a));
  const groups = buildGroups(ranked, subjectConfig);
  const heroGroups = selectHeroGroups(groups, heroTopicTargetMax);
  const usedLeadIds = new Set(heroGroups.map((group) => group.items[0]?.id).filter(Boolean));
  const remainingItems = ranked.filter((item) => !usedLeadIds.has(item.id));

  const hero_topics = heroGroups.map((group, index) => buildHeroTopic(group, index));
  const notable = buildNotableItems(remainingItems, notableTargetMax);

  const digest = {
    week: `${issueDate} to ${issueDate}`,
    published_at: publishedAt,
    hero_topics,
    notable
  };

  const validation = validateDigestContract(digest);
  if (!validation.ok) {
    throw new Error(`Generated digest failed contract validation: ${validation.errors.join('; ')}`);
  }

  return digest;
}
