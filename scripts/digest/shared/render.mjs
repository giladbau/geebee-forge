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

function buildGroups(items, subjectConfig) {
  const groups = new Map();

  for (const item of items) {
    const subjectId = item.subject_primary || 'unknown';
    if (!groups.has(subjectId)) groups.set(subjectId, []);
    groups.get(subjectId).push(item);
  }

  return [...groups.entries()]
    .map(([subjectId, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => rankScore(b) - rankScore(a));
      const topScore = sorted[0] ? rankScore(sorted[0]) : 0;
      return {
        subjectId,
        subjectLabel: getSubjectLabel(subjectId, subjectConfig),
        items: sorted,
        topScore,
        groupScore: topScore + sorted.length * 25
      };
    })
    .sort((a, b) => b.groupScore - a.groupScore || a.subjectLabel.localeCompare(b.subjectLabel));
}

function buildSupportingSources(group) {
  return uniqueBy(
    group.items.flatMap((item) => item.sources || [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }]),
    (source) => `${source.title}|${source.url}`
  ).slice(0, 4);
}

function buildHeroSummary(group, lead) {
  const extraCount = Math.max(group.items.length - 1, 0);
  const leadSummary = cleanText(lead.summary ?? lead.snippet ?? '', 260);

  if (group.items.length >= 2) {
    const topTitles = uniqueBy(group.items.map((item) => cleanText(item.title, 90)).filter(Boolean), (value) => value).slice(0, 3);
    const synthesized = cleanText(`Key signals this cycle: ${topTitles.join('; ')}.`, 420);
    return extraCount > 0 ? `${synthesized} Includes ${extraCount} additional in-scope item${extraCount === 1 ? '' : 's'}.` : synthesized;
  }

  if (leadSummary) return leadSummary;
  return cleanText(`Lead item: ${lead.title ?? 'Untitled item'}.`, 180) || 'Pending summary.';
}

function buildHeroTopic(group, index) {
  const lead = group.items[0];
  const supporting = buildSupportingSources(group);
  const tags = uniqueBy([
    ...(lead.tags || []),
    group.subjectId
  ], (value) => value).slice(0, 8);
  const sourceTypes = uniqueBy(supporting, (source) => source.type).length;

  return {
    title: `${group.subjectLabel}: ${cleanText(lead.title ?? `Topic ${index + 1}`, 120)}`,
    slug: lead.slug ?? `${group.subjectId}-${index + 1}`,
    summary: buildHeroSummary(group, lead),
    insight: cleanText(`Why it matters: ${group.subjectLabel} produced ${group.items.length} in-scope item${group.items.length === 1 ? '' : 's'} across ${sourceTypes} source type${sourceTypes === 1 ? '' : 's'} in this cycle. Lead signal: ${lead.title ?? 'Untitled item'}.`, 260),
    image_url: lead.image_url ?? null,
    sources: supporting,
    tags
  };
}

function buildNotableItems(items, notableTargetMax) {
  return items.slice(0, notableTargetMax).map((item, index) => ({
    title: cleanText(item.title ?? `Untitled notable ${index + 1}`, 140),
    summary: cleanText(item.summary ?? item.snippet ?? '', 260) || 'Pending summary',
    sources: item.sources ?? [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }],
    tags: uniqueBy([...(item.tags || []), ...(item.subject_matches || []), item.subject_primary].filter(Boolean), (value) => value)
  }));
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
  const heroGroups = groups.slice(0, heroTopicTargetMax);
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
