import { validateDigestContract } from './contract.mjs';
import { getDefaultSubjectsConfig, getSubjectLabel } from './subjects.mjs';

function decodeBasicEntities(value) {
  let decoded = String(value || '');
  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
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
    item?.url,
    ...(item?.tags || []),
    ...(item?.sources || []).flatMap((source) => [source?.title, source?.url, source?.type])
  ].join(' '), 600).toLowerCase();
}

function canonicalUrl(value, depth = 0) {
  if (!value) return '';
  try {
    const url = new URL(decodeBasicEntities(value));
    if (depth < 2) {
      for (const param of ['u', 'url', 'target', 'dest', 'destination', 'redirect', 'redirect_url']) {
        const nested = url.searchParams.get(param);
        if (nested && /^https?:\/\//i.test(decodeBasicEntities(nested).trim())) {
          return canonicalUrl(nested, depth + 1);
        }
      }
    }
    url.hash = '';
    for (const param of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|ref_src$)/i.test(param)) {
        url.searchParams.delete(param);
      }
    }
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return String(value).trim().replace(/\/$/, '').toLowerCase();
  }
}

function sourceUrls(item) {
  return uniqueBy([
    item?.url,
    ...(item?.sources || []).map((source) => source?.url)
  ].filter(Boolean).map(canonicalUrl), (value) => value);
}

function sourceDomains(item) {
  return uniqueBy(sourceUrls(item).map((url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }).filter(Boolean), (value) => value);
}

function sourceTypes(item) {
  return uniqueBy((item?.sources || []).map((source) => String(source?.type || '').toLowerCase()).filter(Boolean), (value) => value);
}

function isRedditMediaOnly(item) {
  const urls = sourceUrls(item);
  if (urls.length === 0) return false;
  return urls.every((url) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      return host === 'i.redd.it' || host === 'v.redd.it' || parsed.pathname.includes('/gallery/');
    } catch {
      return /(?:^|\/)(?:i|v)\.redd\.it|reddit\.com\/gallery/i.test(url);
    }
  });
}

function trustworthySourceScore(item) {
  const domains = sourceDomains(item);
  const types = sourceTypes(item);
  let score = 0;

  const trustedDomainPatterns = [
    /\barxiv\.org$/,
    /\bgithub\.com$/,
    /\bhuggingface\.co$/,
    /\banthropic\.com$/,
    /\bopenai\.com$/,
    /\bdeepmind\.google$/,
    /\bgoogle(?:blog)?\.com$/,
    /\bblog\.google$/,
    /\bmicrosoft\.com$/,
    /\bmeta\.com$/,
    /\bnvidia\.com$/,
    /\btencent\.com$/,
    /\bapple\.com$/,
    /\bai\.google$/,
    /\.edu$/
  ];

  for (const domain of domains) {
    if (trustedDomainPatterns.some((pattern) => pattern.test(domain))) score += 220;
    if (/github|arxiv|huggingface/.test(domain)) score += 120;
  }

  for (const type of types) {
    if (/(official|paper|github|project|blog|research|release|documentation|docs|huggingface)/.test(type)) score += 160;
    if (/(reddit|twitter|x)/.test(type)) score += 20;
  }

  if (item.source === 'huggingface_daily_papers') score += 260;
  if (item.source === 'x' && item.source_subtype === 'bookmarks') score += 180;
  if (item.source === 'x') score += 110;
  if (item.source === 'reddit') score -= 40;
  if (isRedditMediaOnly(item)) score -= 420;

  return score;
}

function lowSignalPenalty(item) {
  const text = itemText(item);
  let penalty = 0;

  const lowSignalPatterns = [
    /\baccus(?:e|ing|ation|ed)\b/,
    /\bsexual abuse\b/,
    /\bsister\b/,
    /\bsociopath\b/,
    /\bpathological liar\b/,
    /\bdrama\b/,
    /\bgossip\b/,
    /\bfuck(?:ing)?\b/,
    /\bjailbreak\b/,
    /\bmostly hype\b/,
    /\bsales pitch\b/,
    /\bgolden age is over\b/,
    /\babsolutely no way\b/,
    /\bmajor drop in intelligence\b/,
    /\bstatus update\b/,
    /\bis (?:claude|chatgpt|gpt|gemini) down\b/,
    /\bclaude is down\b/,
    /\bclaude has been poor lately\b/,
    /\bmeme\b/,
    /\bmanager watching\b/,
    /\bhad enough\b/,
    /\bonly reliable use case\b/,
    /\bhas \d+k github stars\b/,
    /\bcool,? i need to join\b/,
    /\bcheck my piece\b/,
    /\bama\b/,
    /\bannouncement\b/,
    /\bjoin(?:ing)? us\b/,
    /\bwho is\b/,
    /\bbeginner guide\b/,
    /\bnot an experienced dev\b/,
    /\bpersonal use initially\b/,
    /\bno terminal\b/,
    /\bno tech talk\b/,
    /\bfound me a flat\b/,
    /\bfrom my phone\b/,
    /\bproperty hunt\b/,
    /\bcheck it out\b/,
    /\bmini app\b/,
    /\bteaser\b/,
    /\blaunching tomorrow\b/,
    /\bappears to be dropping\b/,
    /\b(model|claude|gpt|gemini).{0,40}\b(?:dumber|nerfed|lobotomized|worse|broken)\b/,
    /\b(?:dumber|nerfed|lobotomized|broken).{0,40}\b(model|claude|gpt|gemini)\b/,
    /\bcomplaint thread\b/,
    /\bquietly switched\b/,
    /\bsilently regressed\b/,
    /\btheory\b/,
    /\breportedly dropping\b/,
    /\bbreaking\b/,
    /\bwhenever people\b/,
    /\brubs hands together\b/,
    /\btiddies\b/,
    /\banyone else\b/,
    /\bwhy (?:is|does|do)\b/
  ];

  for (const pattern of lowSignalPatterns) {
    if (pattern.test(text)) penalty -= 360;
  }

  if (/^@\w+/.test(String(item?.title || '').trim())) penalty -= 300;

  if (item.source === 'reddit' && isRedditMediaOnly(item) && (item.summary || item.snippet || '').length < 180) {
    penalty -= 260;
  }

  return penalty;
}

function substanceScore(item) {
  const text = itemText(item);
  let score = 0;

  const highSignalPatterns = [
    /\b(project|paper|model|benchmark|framework|release|launch|agents?|tool use|orchestration|memory|coding|image|video|diffusion|segmentation|gaussian|splat|reconstruction|rendering|world model|world generation|3d worlds?|navigable|explorable)\b/,
    /\b(system card|evaluation|evals?|safety|dataset|open source|github|arxiv|technical report|research)\b/
  ];

  for (const pattern of highSignalPatterns) {
    if (pattern.test(text)) score += 90;
  }

  const summaryLength = (item.summary || item.snippet || '').length;
  if (summaryLength > 120) score += 80;
  if (summaryLength > 360) score += 40;

  return score;
}

function engagementScore(item) {
  const engagement = item.engagement || {};
  const rawMetric = engagement.likes || engagement.score || engagement.upvotes || 0;
  if (!rawMetric) return 0;
  return Math.min(280, Math.round(Math.log10(rawMetric + 1) * 70));
}

function rankScore(item) {
  const sourceBase = item.source === 'x'
    ? (item.source_subtype === 'bookmarks' ? 240 : 160)
    : item.source === 'huggingface_daily_papers'
      ? 260
      : item.source === 'reddit'
        ? 40
        : 0;
  const metric = engagementScore(item);
  const subjectBonus = (item.subject_match_score || 0) * 50;
  return sourceBase + metric + subjectBonus + trustworthySourceScore(item) + substanceScore(item) + lowSignalPenalty(item);
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
  if (/\b(prompt tokens?|token (?:spend|usage|burn)|context window|billing|cost|spend|spending|usage(?: tracking)?|monitoring|observability|visibility|metering|tui|dashboard|telemetry)\b/.test(text)) {
    return { id: 'cost-and-monitoring', label: 'Cost & Monitoring' };
  }
  if (/\b(parenting|parent|family|families|children|kids|education|school|teacher|consumer|personal assistant|home)\b/.test(text)) {
    return { id: 'consumer-applications', label: 'Consumer Applications' };
  }
  if (/\b(paper|benchmark|evaluation|evals?|safety|alignment|system card|analysis|study|research|arxiv)\b/.test(text)) {
    return { id: 'research-and-evals', label: 'Research & Evals' };
  }
  if (/\b(claude code|coding agent|code agents?|ide|cli|terminal|developer tool|devtool|debugging|repository|repo|pull request|code review)\b/.test(text)) {
    return { id: 'developer-tools', label: 'Developer Tools' };
  }
  if (/\b(harness|orchestration|deployment|managed agents|framework|tooling|infrastructure|platform|mcp|runtime|tracing)\b/.test(text)) {
    return { id: 'tooling-and-platforms', label: 'Tooling & Platforms' };
  }
  if (/\b(glasswing|mythos|opus|sonnet|gpt|gemini|muse spark|release|launch|preview|frontier model|model update)\b/.test(text)) {
    return { id: 'frontier-models', label: 'Frontier Models' };
  }
  if (/\b(openclaw|hermes agent|assistant app|agent app|agent platform|workspace agent|workflow app|agent workspace|marketplace|desktop app|mini app)\b/.test(text)) {
    return { id: 'agent-apps-and-platforms', label: 'Agent Apps & Platforms' };
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
      const solidItems = sorted.filter((item) => trustworthySourceScore(item) + substanceScore(item) > 240).length;
      const lowSignalItems = sorted.filter((item) => lowSignalPenalty(item) < 0 || isRedditMediaOnly(item)).length;
      const corroborationBonus = Math.min(260, Math.max(0, solidItems - 1) * 100);
      const sourceDiversityBonus = Math.min(160, uniqueBy(sorted.flatMap(sourceDomains), (value) => value).length * 35);
      return {
        ...group,
        items: sorted,
        topScore,
        groupScore: topScore + sorted.length * 20 + corroborationBonus + sourceDiversityBonus - lowSignalItems * 35
      };
    })
    .sort((a, b) => b.groupScore - a.groupScore || a.subjectLabel.localeCompare(b.subjectLabel));
}

function nonSocialDomains(group) {
  return uniqueBy(
    presentableItems(group)
      .flatMap(sourceDomains)
      .filter((domain) => !['x.com', 'reddit.com', 'i.redd.it', 'v.redd.it'].includes(domain)),
    (value) => value
  );
}

function isPublishableHeroGroup(group) {
  const editorialItems = presentableItems(group);
  if (editorialItems.length === 0) return false;

  const lead = editorialItems[0];
  const leadScore = trustworthySourceScore(lead) + substanceScore(lead);
  const hasExternalEvidence = nonSocialDomains(group).length > 0;
  const lowSignalLead = lowSignalPenalty(lead) < 0;

  if (lowSignalLead && editorialItems.length === 1) return false;
  if (lowSignalLead && !hasExternalEvidence && leadScore < 480) return false;
  if (isRedditMediaOnly(lead) && leadScore < 420) return false;

  return true;
}

function isStrongExtraHeroGroup(group) {
  const editorialItems = presentableItems(group);
  const strongItems = editorialItems.filter((item) => trustworthySourceScore(item) + substanceScore(item) >= 420);
  const lowSignalItems = editorialItems.filter((item) => lowSignalPenalty(item) < 0);
  const externalDomainCount = nonSocialDomains(group).length;
  const hasExternalEvidence = externalDomainCount > 0;
  const socialOnly = editorialItems.length > 0 && !hasExternalEvidence;

  if (!isPublishableHeroGroup(group)) return false;
  if (socialOnly && strongItems.length < 2) return false;
  if (lowSignalItems.length >= Math.ceil(editorialItems.length / 2) && externalDomainCount < 2) return false;
  return strongItems.length >= 2 || externalDomainCount >= 2;
}

function selectHeroGroups(groups, heroTopicTargetMax) {
  const selected = [];
  const usedSubjects = new Set();

  for (const group of groups) {
    if (selected.length >= heroTopicTargetMax) break;
    if (usedSubjects.has(group.subjectId)) continue;
    if (!isPublishableHeroGroup(group)) continue;
    selected.push(group);
    usedSubjects.add(group.subjectId);
  }

  for (const group of groups) {
    if (selected.length >= heroTopicTargetMax) break;
    if (selected.some((entry) => entry.groupKey === group.groupKey)) continue;
    if (!isStrongExtraHeroGroup(group)) continue;
    selected.push(group);
  }

  return selected;
}

function evidenceScore(item) {
  return trustworthySourceScore(item) + substanceScore(item) + Math.round(engagementScore(item) * 0.5) + lowSignalPenalty(item);
}

function presentableItems(group) {
  const filtered = group.items.filter((item) => {
    const trustAndSubstance = trustworthySourceScore(item) + substanceScore(item);
    if (lowSignalPenalty(item) < 0 && trustAndSubstance < 360) return false;
    if (isRedditMediaOnly(item) && trustAndSubstance < 260) return false;
    return rankScore(item) > 160;
  });

  const sorted = (filtered.length > 0 ? filtered : group.items.slice(0, 1))
    .slice()
    .sort((a, b) => evidenceScore(b) - evidenceScore(a) || rankScore(b) - rankScore(a));

  return sorted;
}

function stripHostPrefix(title, host) {
  if (!host) return title;
  const escapedHost = host.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return title.replace(new RegExp(`^${escapedHost}\\s*[:\\-–—]\\s*`, 'i'), '').trim();
}

function isGenericLabel(label) {
  return /^(source|link|article|read more|view post|github|project|paper|repo|repository|homepage|website|site|official|blog|post|page)$/i.test(label);
}

function titleCaseSlug(segment) {
  const cleaned = String(segment || '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (/^[a-z0-9.\-]+$/i.test(segment) && /-/.test(segment)) return segment;
  return cleaned;
}

function deriveHostLabel(host, pathname) {
  const segments = String(pathname || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!host) return '';

  if (host === 'github.com' && segments.length >= 2) {
    return `${segments[0]}/${segments[1].replace(/\.git$/, '')}`;
  }

  if (host === 'huggingface.co') {
    if (segments[0] === 'papers' && segments[1]) return `HF paper: ${segments.slice(1).join('/')}`;
    if (segments[0] === 'datasets' && segments[1] && segments[2]) return `${segments[1]}/${segments[2]} (dataset)`;
    if (segments[0] === 'spaces' && segments[1] && segments[2]) return `${segments[1]}/${segments[2]} (space)`;
    if (segments.length >= 2 && segments[0] !== 'papers') return `${segments[0]}/${segments[1]}`;
    if (segments[0]) return segments[0];
  }

  if (host === 'arxiv.org' && segments[0] === 'abs' && segments[1]) {
    return `arXiv:${segments[1]}`;
  }

  if ((host === 'x.com' || host === 'twitter.com') && segments[0]) {
    return `@${segments[0]}`;
  }

  if ((host.endsWith('reddit.com') || host === 'redd.it')) {
    if (segments[0] === 'r' && segments[1]) return `r/${segments[1]}`;
  }

  if (host.endsWith('.github.io') && segments[0]) {
    return `${host.replace(/\.github\.io$/, '')}/${segments[0]}`;
  }

  // Generic: if the path has a meaningful slug, use the final segment
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    const pretty = titleCaseSlug(last);
    if (pretty && !/^(index|home|main|blog|news|research|papers?|post)$/i.test(pretty)) {
      return pretty;
    }
  }

  return '';
}

function normalizeSource(source, fallbackType = 'unknown') {
  const rawUrl = source?.url ?? 'about:blank';
  const url = canonicalUrl(rawUrl) || rawUrl;
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  const normalizedHost = parsedUrl ? parsedUrl.hostname.replace(/^www\./, '').toLowerCase() : '';
  const pathname = parsedUrl ? parsedUrl.pathname : '';
  const originalHost = (() => {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();

  const rawTitle = decodeBasicEntities(source?.title ?? '')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let normalizedTitle = rawTitle.replace(/[:\-–—]+$/g, '').trim();
  normalizedTitle = stripHostPrefix(normalizedTitle, normalizedHost);
  if (originalHost && originalHost !== normalizedHost) {
    normalizedTitle = stripHostPrefix(normalizedTitle, originalHost);
  }
  const lowerTitle = normalizedTitle.toLowerCase();

  const hostLabel = deriveHostLabel(normalizedHost, pathname);

  const titleLooksLikeUrl = canonicalUrl(normalizedTitle) === url;
  const titleIsHost = lowerTitle === normalizedHost;
  const titleIsGeneric = isGenericLabel(normalizedTitle);
  const titleIsSource = /^source item$/i.test(normalizedTitle);

  const title = (() => {
    if (hostLabel && (!normalizedTitle || titleLooksLikeUrl || titleIsHost || titleIsGeneric || titleIsSource)) {
      return hostLabel;
    }
    if (!normalizedTitle) return hostLabel || normalizedHost || 'Source item';
    if (titleLooksLikeUrl) return hostLabel || normalizedHost || 'Source item';
    if (titleIsHost) return hostLabel || normalizedHost;
    if (titleIsGeneric) return hostLabel || normalizedHost || normalizedTitle;
    return cleanText(normalizedTitle, 140) || hostLabel || normalizedHost || 'Source item';
  })();

  return {
    title,
    url,
    type: source?.type ?? fallbackType
  };
}

function buildSupportingSources(group) {
  return uniqueBy(
    presentableItems(group).flatMap((item) => (item.sources || [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }]).map((source) => normalizeSource(source, item.source ?? 'unknown'))),
    (source) => `${cleanText(source.title, 120)}|${canonicalUrl(source.url)}`
  ).slice(0, 4);
}

function inferThemeLabel(group) {
  if (group.subthemeLabel) return group.subthemeLabel;

  const text = group.items.map(itemText).join(' ');
  if (group.subjectId === 'image-video-genai') {
    if (/\b(video|image).{0,40}\b(editing|workflow|tool|control|post-processing|outpaint|lora)\b/.test(text)) return 'Tools & Workflows';
    if (/\b(model|release|diffusion|moe|vae|transformer|nucleus)\b/.test(text)) return 'Model Releases';
    if (/\b(paper|benchmark|research|arxiv)\b/.test(text)) return 'Research & Methods';
    return 'Visual AI Updates';
  }

  if (group.subjectId === 'gaussian-splatting') {
    if (/\b(mesh|viewer|renderer|rendering|workflow|tool|desktop|vr)\b/.test(text)) return 'Tools & Reconstruction';
    if (/\b(world|scene|dynamic|reconstruction|4d|3d)\b/.test(text)) return 'Scene Reconstruction';
    return '3D Reconstruction';
  }

  if (group.subjectId === 'generative-3d-worlds') {
    if (/\b(explorable|navigable|navigation|persistent|spatial consistency|world model)\b/.test(text)) return 'Explorable World Models';
    if (/\b(engine|unity|unreal|mesh|export|asset|game)\b/.test(text)) return 'Engine-Ready 3D Worlds';
    return 'Interactive 3D Worlds';
  }

  return null;
}

function buildHeroTitle(group) {
  const themeLabel = inferThemeLabel(group);
  const title = themeLabel ? `${group.subjectLabel}: ${themeLabel}` : group.subjectLabel;
  return cleanText(title, 64).replace(/…$/, '').trim();
}

function leadingSentence(value) {
  const cleaned = cleanText(value, 260)
    .replace(/^(full link:\s*)+/i, '')
    .replace(/^(?:🔥\s*)?breaking:\s*/i, '')
    .trim();
  if (!cleaned) return '';
  const candidates = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence, 220))
    .filter(Boolean);
  const preferred = candidates.find((sentence) => !/^(hey\b|hi\b|hello\b|we(?:'re| are)\b the team\b|source\b)/i.test(sentence));
  return preferred || candidates[0] || '';
}

function splitSentences(value, sentenceLimit = 220) {
  return cleanText(value || '', 520)
    .replace(/^(full link:\s*)+/i, '')
    .replace(/^(?:🔥\s*)?breaking:\s*/i, '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence, sentenceLimit))
    .filter(Boolean);
}

function itemDigestLine(item) {
  const rawSummary = String(item.summary || item.snippet || '');
  const cleanedTitle = cleanText(item.title, 140)
    .replace(/^(full link:\s*)+/i, '')
    .replace(/^(?:🔥\s*)?breaking:\s*/i, '')
    .trim();
  if (/\[(source|link)\]\(https?:\/\/|(?:^|\n)#+\s|(?:^|\n)\d+\.\s|https?:\/\/\S+\s*\n|\bfull link:\b/i.test(rawSummary)) {
    if (cleanedTitle) return `${cleanedTitle}.`;
  }

  const sentences = splitSentences(rawSummary);
  const usable = sentences.filter((s) => !/^https?:\/\//i.test(s) && !/^(hey\b|hi\b|hello\b|we(?:'re| are)\b the team\b|source\b)/i.test(s));
  if (usable.length > 0) {
    // Prefer first one or two sentences, joined if the first is short
    const first = usable[0];
    if (first.length < 120 && usable[1] && first.length + usable[1].length + 1 <= 280) {
      return `${first} ${usable[1]}`;
    }
    return first;
  }
  return cleanedTitle ? `${cleanedTitle}.` : '';
}

function pickInlineSource(item) {
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  const fallbackSources = sources.length > 0
    ? sources
    : [{ title: item?.title ?? 'Source item', url: item?.url ?? 'about:blank', type: item?.source ?? 'unknown' }];

  const score = (source) => {
    const type = String(source?.type || '').toLowerCase();
    const host = (() => {
      try {
        return new URL(source?.url || '').hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })();
    if (host === 'i.redd.it' || host === 'v.redd.it' || host === 'preview.redd.it') return -5;
    if (/official|paper|research|release/.test(type)) return 5;
    if (/github|huggingface/.test(type)) return 4;
    if (/project|blog|documentation|docs/.test(type)) return 3;
    if (/reddit/.test(type)) return 2;
    if (/twitter/.test(type)) return 1;
    return 0;
  };

  const sorted = [...fallbackSources].sort((a, b) => score(b) - score(a));
  const chosen = sorted[0];
  if (!chosen || !chosen.url) return null;
  const normalized = normalizeSource(chosen, item?.source ?? 'unknown');
  if (!normalized?.url || normalized.url === 'about:blank') return null;
  return normalized;
}

function stripTrailingPunctuation(text) {
  return String(text || '').replace(/[\s.,;:!?]+$/g, '');
}

function formatDescriptor(text, source) {
  const base = stripTrailingPunctuation(text || '');
  if (!base) return '';
  const withStop = /[.!?]$/.test(text) ? text : `${base}.`;
  if (!source) return withStop;
  return `${withStop} ([${source.title}](${source.url}))`;
}

function plainTextLength(value) {
  return String(value || '').replace(/\[([^\]]+)\]\((?:https?:\/\/[^)]+)\)/g, '$1').length;
}

function truncatePreservingLinks(text, limit) {
  const value = String(text || '');
  if (plainTextLength(value) <= limit) return value;

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let result = '';
  let plainCount = 0;
  let index = 0;

  while (index < value.length && plainCount < limit) {
    linkPattern.lastIndex = index;
    const match = linkPattern.exec(value);
    if (match && match.index === index) {
      const [full, label] = match;
      if (plainCount + label.length > limit) break;
      result += full;
      plainCount += label.length;
      index += full.length;
    } else {
      result += value[index];
      plainCount += 1;
      index += 1;
    }
  }

  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > result.length * 0.7) result = result.slice(0, lastSpace);
  return `${result.replace(/[\s,;:]+$/g, '').trimEnd()}…`;
}

function joinWithinLimit(sentences, limit) {
  let acc = '';
  for (const sentence of sentences) {
    if (!sentence) continue;
    const candidate = acc ? `${acc} ${sentence}` : sentence;
    if (plainTextLength(candidate) > limit) break;
    acc = candidate;
  }
  return acc || sentences.find(Boolean) || '';
}

function buildItemDescriptor(item) {
  const text = itemDigestLine(item);
  if (!text) return null;
  const source = pickInlineSource(item);
  return formatDescriptor(text, source);
}

function buildHeroSummary(group) {
  const editorialItems = presentableItems(group);
  if (editorialItems.length === 0) return 'Pending summary.';

  const seen = new Set();
  const descriptors = [];
  for (const item of editorialItems) {
    const descriptor = buildItemDescriptor(item);
    if (!descriptor) continue;
    const key = descriptor.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    descriptors.push(descriptor);
    if (descriptors.length >= 5) break;
  }

  if (descriptors.length === 0) return 'Pending summary.';

  const body = joinWithinLimit(descriptors, 1000);
  const extraCount = Math.max(editorialItems.length - descriptors.length, 0);
  const sourceCount = uniqueBy(editorialItems.flatMap(sourceDomains), (value) => value).length;

  let tail = '';
  if (extraCount >= 3 || (extraCount >= 1 && sourceCount >= 4)) {
    tail = ` Additional coverage spans ${extraCount} more item${extraCount === 1 ? '' : 's'}${sourceCount > 1 ? ` across ${sourceCount} source domains` : ''}.`;
  } else if (sourceCount >= 4) {
    tail = ` Signal spans ${sourceCount} source domains.`;
  }

  return truncatePreservingLinks(`${body}${tail}`, 1100);
}

function buildHeroInsight(group, supporting) {
  const subjectLabel = group.subjectLabel;
  const sourceCount = supporting.length;
  const sourcePhrase = `The ${sourceCount <= 1 ? 'single-source' : 'multi-source'} signal`;

  if (group.subjectId === 'ai-agents' && group.subthemeLabel) {
    const analysisBySubtheme = {
      'cost-and-monitoring': 'This matters because agent adoption is moving from experiments to managed operations, where usage visibility, cost control, and auditability decide whether teams can keep agents in production.',
      'consumer-applications': 'This matters because agentic systems are moving into personal and family contexts, where usefulness depends as much on trust, boundaries, and workflow fit as raw model capability.',
      'developer-tools': 'This matters because coding agents are becoming part of the developer toolchain, so reliability, context handling, and repository-level feedback loops are becoming product requirements.',
      'frontier-models': 'This matters because model updates and official evaluations reset expectations for what agent stacks can attempt, while also creating new operating and safety assumptions.',
      'research-and-evals': 'This matters because evaluation work is becoming the control surface for agent progress: better tests shape what builders trust, deploy, and regulate.',
      'tooling-and-platforms': 'This matters because orchestration and runtime tooling turn isolated agent demos into repeatable systems that teams can debug, govern, and scale.',
      'agent-apps-and-platforms': 'This matters because agent-native products live or die on whether they turn model capability into repeatable user workflows. The signal is worth tracking for evidence that agent apps are becoming sticky products instead of one-off demos.',
      'applications-and-builds': 'This matters because practical agent use cases are widening, but the durable signal is whether they solve repeated workflows instead of one-off demos.'
    };
    return cleanText(`${analysisBySubtheme[group.subthemeId] || analysisBySubtheme['applications-and-builds']} ${sourcePhrase} is worth tracking for changes in capability, deployment friction, or operating risk.`, 420);
  }

  if (group.subjectId === 'image-video-genai') {
    return cleanText(`This matters because visual generation is shifting from novelty outputs toward controllable production workflows. ${sourcePhrase} suggests builders should watch tools that improve editing precision, repeatability, and model integration.`, 420);
  }

  if (group.subjectId === 'gaussian-splatting') {
    return cleanText(`This matters because Gaussian splatting progress is increasingly judged by usable pipelines, not just reconstruction quality. ${sourcePhrase} points to continued movement from research artifacts toward viewers, mesh conversion, and production workflows.`, 420);
  }

  if (group.subjectId === 'generative-3d-worlds') {
    return cleanText(`This matters because world-generation systems are moving from rendered clips toward persistent spaces that can be explored, edited, and exported into production tools. ${sourcePhrase} is worth tracking for signs that 3D asset creation and simulation workflows are becoming model-driven.`, 420);
  }

  return cleanText(`This matters because ${subjectLabel} activity is producing enough signal to affect near-term tooling and research choices. ${sourcePhrase} suggests it is worth tracking into the next cycle.`, 420);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildHeroTopic(group, index) {
  const lead = group.items[0];
  const supporting = buildSupportingSources(group);
  const tags = uniqueBy([
    ...(lead.tags || []),
    group.subjectId,
    group.subthemeId
  ].filter(Boolean), (value) => value).slice(0, 8);
  const title = buildHeroTitle(group);

  return {
    title,
    slug: slugify(`${group.subjectId}-${group.subthemeId || inferThemeLabel(group) || index + 1}`),
    summary: buildHeroSummary(group),
    insight: buildHeroInsight(group, supporting),
    image_url: lead.image_url ?? null,
    sources: supporting,
    tags
  };
}

function buildNotableItems(items, notableTargetMax, heroCoveredUrls = new Set()) {
  const perSubjectCounts = new Map();
  const output = [];

  for (const item of items) {
    if (output.length >= notableTargetMax) break;
    const itemUrls = sourceUrls(item);
    if (itemUrls.some((url) => heroCoveredUrls.has(url))) continue;
    const itemRank = rankScore(item);
    const trustAndSubstance = trustworthySourceScore(item) + substanceScore(item);
    const domains = sourceDomains(item);
    const xOnly = domains.length > 0 && domains.every((domain) => domain === 'x.com');
    const summaryLength = cleanText(item.summary ?? item.snippet ?? '', 320).length;
    if (itemRank < 340) continue;
    if (trustAndSubstance < 220) continue;
    if (isRedditMediaOnly(item) && trustAndSubstance < 420) continue;
    if (lowSignalPenalty(item) < 0 && trustAndSubstance < 520) continue;
    if (xOnly && trustAndSubstance < 420) continue;
    if (summaryLength < 90 && trustAndSubstance < 360) continue;
    const subject = item.subject_primary || 'unknown';
    const count = perSubjectCounts.get(subject) || 0;
    if (count >= 6) continue;
    const rawSummary = cleanText(item.summary ?? item.snippet ?? '', 440) || '';
    const summaryBase = rawSummary || `${cleanText(item.title ?? '', 160)}.`;
    const inlineSource = pickInlineSource(item);
    const summary = truncatePreservingLinks(formatDescriptor(summaryBase, inlineSource) || 'Pending summary', 500);
    output.push({
      title: cleanText(item.title ?? `Untitled notable ${output.length + 1}`, 140),
      summary,
      sources: (item.sources ?? [{ title: item.title ?? 'Source item', url: item.url ?? 'about:blank', type: item.source ?? 'unknown' }]).map((source) => normalizeSource(source, item.source ?? 'unknown')),
      tags: uniqueBy([...(item.tags || []), ...(item.subject_matches || []), item.subject_primary].filter(Boolean), (value) => value)
    });
    perSubjectCounts.set(subject, count + 1);
  }

  return output;
}

function toDateLabel(value) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function inferWindowStart(items, fallbackDate) {
  const dates = items
    .map((item) => Date.parse(item?.published_at))
    .filter((value) => !Number.isNaN(value));
  if (dates.length === 0) return fallbackDate;
  return new Date(Math.min(...dates)).toISOString();
}

function buildWeekLabel({ issueDate, publishedAt, compileWindowStartAt, items }) {
  const end = toDateLabel(publishedAt) || issueDate;
  const inferredStart = inferWindowStart(items, `${issueDate}T00:00:00.000Z`);
  const start = toDateLabel(compileWindowStartAt) || toDateLabel(inferredStart) || issueDate;
  return `${start} to ${end}`;
}

export function buildPreviewDigest({
  issueDate,
  publishedAt,
  compileWindowStartAt = null,
  items,
  heroTopicTargetMax = 4,
  notableTargetMax = 15,
  subjectConfig = getDefaultSubjectsConfig()
}) {
  const ranked = [...items].sort((a, b) => rankScore(b) - rankScore(a));
  const groups = buildGroups(ranked, subjectConfig);
  const heroGroups = selectHeroGroups(groups, heroTopicTargetMax);
  const hero_topics = heroGroups.map((group, index) => buildHeroTopic(group, index));
  const heroCoveredUrls = new Set(heroGroups.flatMap((group) => presentableItems(group).flatMap(sourceUrls)).map(canonicalUrl).filter(Boolean));
  const remainingItems = ranked.filter((item) => !sourceUrls(item).some((url) => heroCoveredUrls.has(url)));
  const notable = buildNotableItems(remainingItems, notableTargetMax, heroCoveredUrls);

  const digest = {
    week: buildWeekLabel({ issueDate, publishedAt, compileWindowStartAt, items }),
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
