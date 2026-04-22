import { describe, expect, it } from 'vitest';
import { buildPreviewDigest } from '../../../scripts/digest/shared/render.mjs';

const items = [
  {
    id: 'x:1',
    source: 'x',
    slug: 'agent-release',
    title: 'Claude adds better tool use for coding agents',
    summary: 'A major frontier-model release improves tool use and coding workflows.',
    insight: 'Insight 1',
    url: 'https://x.com/1',
    sources: [{ title: 'Claude adds better tool use for coding agents', url: 'https://x.com/1', type: 'twitter' }],
    tags: ['agents'],
    subject_primary: 'ai-agents',
    subject_matches: ['ai-agents'],
    subject_match_score: 3,
    engagement: { likes: 120 }
  },
  {
    id: 'paper:2',
    source: 'huggingface_daily_papers',
    slug: 'gs-paper',
    title: '3D Gaussian Splatting improves dynamic scene reconstruction',
    summary: 'A splatting paper advances radiance fields and reconstruction quality.',
    insight: 'Insight 2',
    url: 'https://example.com/gs',
    sources: [{ title: '3D Gaussian Splatting improves dynamic scene reconstruction', url: 'https://example.com/gs', type: 'paper' }],
    tags: ['gaussian-splatting'],
    subject_primary: 'gaussian-splatting',
    subject_matches: ['gaussian-splatting'],
    subject_match_score: 3,
    engagement: { upvotes: 85 }
  },
  {
    id: 'paper:3',
    source: 'huggingface_daily_papers',
    slug: 'sam-paper',
    title: 'Segment Anything remains foundational for image tooling',
    summary: 'SAM-class segmentation work continues to matter for image processing.',
    insight: 'Insight 3',
    url: 'https://example.com/sam',
    sources: [{ title: 'Segment Anything remains foundational for image tooling', url: 'https://example.com/sam', type: 'paper' }],
    tags: ['vision'],
    subject_primary: 'image-video-genai',
    subject_matches: ['image-video-genai'],
    subject_match_score: 2,
    engagement: { upvotes: 70 }
  },
  {
    id: 'x:4',
    source: 'x',
    slug: 'agent-framework',
    title: 'A new agent framework simplifies orchestration',
    summary: 'An open-source release for coding agents and orchestration.',
    insight: 'Insight 4',
    url: 'https://x.com/4',
    sources: [{ title: 'A new agent framework simplifies orchestration', url: 'https://x.com/4', type: 'twitter' }],
    tags: ['agents'],
    subject_primary: 'ai-agents',
    subject_matches: ['ai-agents'],
    subject_match_score: 2,
    engagement: { likes: 40 }
  }
];

describe('digest render', () => {
  it('produces geebee-forge-compatible digest output', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items,
      heroTopicTargetMax: 2,
      notableTargetMax: 5
    });

    expect(digest.week).toBe('2026-04-08 to 2026-04-08');
    expect(digest.hero_topics).toHaveLength(2);
    expect(Array.isArray(digest.notable)).toBe(true);
  });

  it('builds hero topics from distinct subject groups before filling extra slots', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items,
      heroTopicTargetMax: 3,
      notableTargetMax: 3
    });

    const heroTitles = digest.hero_topics.map((topic) => topic.title);

    expect(heroTitles.some((title) => title.includes('AI Agents'))).toBe(true);
    expect(heroTitles.some((title) => title.includes('3D Gaussian Splatting'))).toBe(true);
    expect(heroTitles.some((title) => title.includes('Image/Video GenAI'))).toBe(true);
  });

  it('prefers substantive visual-ai items over gossipy low-signal titles within a subject', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items: [
        {
          id: 'reddit:gossip',
          source: 'reddit',
          title: "Sam Altman's sister accusing him of rampant sexual abuse when they were young",
          summary: '',
          url: 'https://example.com/gossip',
          sources: [{ title: 'gossip', url: 'https://example.com/gossip', type: 'reddit' }],
          tags: ['chatgpt'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 10000 }
        },
        {
          id: 'reddit:real',
          source: 'reddit',
          title: 'Last week in Generative Image & Video',
          summary: 'A weekly roundup covering image generation, video tools, and important releases. https://example.com/foo',
          url: 'https://example.com/real',
          sources: [{ title: 'real', url: 'https://example.com/real', type: 'reddit' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics[0].sources[0].url).toBe('https://example.com/real');
    expect(digest.hero_topics[0].summary).not.toContain('example.com/foo');
    expect(digest.hero_topics[0].summary).not.toContain('example.com/gossip');
    expect(digest.hero_topics[0].summary).not.toContain('sexual abuse');
  });

  it('writes a synthesized hero summary from multiple items in the subject group', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items: [
        {
          id: 'img:1',
          source: 'reddit',
          title: 'Last week in Generative Image & Video',
          summary: 'A broad roundup of visual-ai tooling and releases.',
          url: 'https://example.com/one',
          sources: [{ title: 'one', url: 'https://example.com/one', type: 'reddit' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        },
        {
          id: 'img:2',
          source: 'huggingface_daily_papers',
          title: 'Think in Strokes, Not Pixels: Process-Driven Image Generation via Interleaved Reasoning',
          summary: 'A paper on process-driven image generation.',
          url: 'https://example.com/two',
          sources: [{ title: 'two', url: 'https://example.com/two', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 27 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics[0].summary).toContain('A broad roundup of visual-ai tooling and releases.');
    expect(digest.hero_topics[0].summary).toContain('A paper on process-driven image generation.');
    expect(digest.hero_topics[0].summary).not.toMatch(/This Image\/Video GenAI theme centers on/);
    expect(digest.hero_topics[0].summary).toMatch(/\[[^\]]+\]\(https?:\/\/[^)]+\)/);
  });

  it('keeps cross-subject diversity first, then can use AI subthemes for extra hero slots', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items: [
        {
          id: 'x:model',
          source: 'x',
          title: 'Claude Mythos Preview raises the ceiling for agentic coding',
          summary: 'A frontier model update with stronger tool use and reasoning.',
          url: 'https://example.com/model',
          sources: [{ title: 'model', url: 'https://example.com/model', type: 'twitter' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 5000 }
        },
        {
          id: 'x:tooling',
          source: 'x',
          title: 'A new agent harness simplifies orchestration and deployment',
          summary: 'A tooling release for agent infrastructure and managed execution.',
          url: 'https://example.com/tooling',
          sources: [{ title: 'tooling', url: 'https://example.com/tooling', type: 'twitter' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 3200 }
        },
        {
          id: 'img:hero',
          source: 'reddit',
          title: 'Last week in Generative Image & Video',
          summary: 'A broad roundup of visual-ai tooling and releases.',
          url: 'https://example.com/image',
          sources: [{ title: 'image', url: 'https://example.com/image', type: 'reddit' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        },
        {
          id: 'gs:hero',
          source: 'huggingface_daily_papers',
          title: '3D Gaussian Splatting improves dynamic scene reconstruction',
          summary: 'A splatting paper advances radiance fields and reconstruction quality.',
          url: 'https://example.com/gs',
          sources: [{ title: 'gs', url: 'https://example.com/gs', type: 'paper' }],
          tags: ['gaussian-splatting'],
          subject_primary: 'gaussian-splatting',
          subject_matches: ['gaussian-splatting'],
          subject_match_score: 3,
          engagement: { upvotes: 85 }
        }
      ],
      heroTopicTargetMax: 4,
      notableTargetMax: 2
    });

    expect(digest.hero_topics.some((topic) => topic.title.includes('AI Agents'))).toBe(true);
    expect(digest.hero_topics.some((topic) => topic.title.includes('Image/Video GenAI'))).toBe(true);
    expect(digest.hero_topics.some((topic) => topic.title.includes('3D Gaussian Splatting'))).toBe(true);
  });

  it('writes analytical insights instead of only pool metadata', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items,
      heroTopicTargetMax: 2,
      notableTargetMax: 2
    });

    expect(digest.hero_topics[0].insight).toMatch(/This matters because/);
    expect(digest.hero_topics[0].insight).not.toContain(digest.hero_topics[0].summary);
  });

  it('respects hero and notable limits', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-08',
      publishedAt: '2026-04-08T13:00:00Z',
      items,
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics).toHaveLength(1);
    expect(digest.notable).toHaveLength(1);
  });

  it('uses the compile window for the week label', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      compileWindowStartAt: '2026-04-12T21:00:00.000Z',
      items,
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.week).toBe('2026-04-12 to 2026-04-19');
  });

  it('writes compact hero theme titles instead of embedding lead source headlines', () => {
    const longHeadline = 'New Anthropic Fellows research: developing an Automated Alignment Researcher. We ran an experiment to learn whether Claude can write alignment research proposals end to end';
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'x:alignment',
          source: 'x',
          title: longHeadline,
          summary: 'Anthropic shared an automated alignment research experiment involving Claude and research proposal generation.',
          url: 'https://x.com/AnthropicAI/status/2044138481790648323',
          sources: [{ title: longHeadline, url: 'https://x.com/AnthropicAI/status/2044138481790648323', type: 'official' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 5000 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    expect(digest.hero_topics[0].title.length).toBeLessThanOrEqual(64);
    expect(digest.hero_topics[0].title).not.toContain('We ran an experiment');
    expect(digest.hero_topics[0].title).toMatch(/AI Agents/);
  });

  it('keeps unrelated AI-agent subthemes out of the same hero cluster', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'agent:parenting',
          source: 'x',
          title: 'Jesse Genet on Agentic Parenting',
          summary: 'A founder discussion about families, education, and agent-mediated parenting workflows.',
          url: 'https://a16z.com/podcast/agentic-parenting',
          sources: [{ title: 'Jesse Genet on Agentic Parenting', url: 'https://a16z.com/podcast/agentic-parenting', type: 'official' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 1200 }
        },
        {
          id: 'agent:parenting-2',
          source: 'x',
          title: 'Curriculum automation for families using AI agents',
          summary: 'A second corroborating product writeup about household and school workflows powered by agents.',
          url: 'https://example.com/family-agents',
          sources: [{ title: 'Family agent workflow writeup', url: 'https://example.com/family-agents', type: 'blog' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 400 }
        },
        {
          id: 'agent:tokens',
          source: 'reddit',
          title: 'TUI to see where Claude Code tokens actually go',
          summary: 'A developer tool breaks down Claude Code token and cost usage by project and task.',
          url: 'https://github.com/example/claude-token-tui',
          sources: [{ title: 'Claude token TUI', url: 'https://github.com/example/claude-token-tui', type: 'github' }],
          tags: ['claudeai'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { score: 900 }
        },
        {
          id: 'agent:tokens-2',
          source: 'x',
          title: 'Usage telemetry dashboard for coding-agent spend',
          summary: 'A second corroborating writeup about monitoring spend and token burn for coding agents.',
          url: 'https://example.com/agent-telemetry',
          sources: [{ title: 'Agent telemetry writeup', url: 'https://example.com/agent-telemetry', type: 'blog' }],
          tags: ['claudeai'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 350 }
        }
      ],
      heroTopicTargetMax: 2,
      notableTargetMax: 0
    });

    expect(digest.hero_topics).toHaveLength(2);
    expect(digest.hero_topics.map((topic) => topic.title).join(' | ')).toMatch(/Parenting|Consumer|Applications/);
    expect(digest.hero_topics.map((topic) => topic.title).join(' | ')).toMatch(/Cost|Monitoring|Developer Tools|Tooling/);
  });

  it('separates complete factual summaries from interpretive analysis', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'img:weekly',
          source: 'reddit',
          title: 'Last week in Generative Image & Video',
          summary: 'A weekly roundup covered object counting, open-source image models, video editing tools, and controllable generation releases.',
          url: 'https://reddit.com/r/StableDiffusion/comments/1slz1rq/last_week_in_generative_image_video/',
          sources: [{ title: 'Last week in Generative Image & Video', url: 'https://reddit.com/r/StableDiffusion/comments/1slz1rq/last_week_in_generative_image_video/', type: 'reddit' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        },
        {
          id: 'img:nucleus',
          source: 'huggingface_daily_papers',
          title: 'Nucleus-Image Released',
          summary: 'Nucleus-Image is a sparse mixture-of-experts diffusion transformer with 17B total parameters and roughly 2B active parameters.',
          url: 'https://huggingface.co/papers/nucleus-image',
          sources: [{ title: 'Nucleus-Image Released', url: 'https://huggingface.co/papers/nucleus-image', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 80 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    const [topic] = digest.hero_topics;
    expect(topic.summary).toMatch(/covered|Nucleus-Image|diffusion/i);
    expect(topic.insight).toMatch(/matters|means|suggests|watch|takeaway/i);
    expect(topic.insight).not.toContain('Key signals this cycle');
    expect(topic.insight).not.toBe(topic.summary);
  });

  it('excludes every source already covered by hero topics from notable items', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        ...items,
        {
          id: 'agent:secondary',
          source: 'x',
          title: 'Open-source agent runtime adds deployment tracing',
          summary: 'A runtime update adds tracing for agent deployments and tool calls.',
          url: 'https://github.com/example/agent-runtime',
          sources: [{ title: 'Open-source agent runtime adds deployment tracing', url: 'https://github.com/example/agent-runtime', type: 'github' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 90 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 10
    });

    const heroSourceUrls = new Set(digest.hero_topics.flatMap((topic) => topic.sources.map((source) => source.url)));
    const notableSourceUrls = digest.notable.flatMap((item) => item.sources.map((source) => source.url));

    expect(notableSourceUrls.some((url) => heroSourceUrls.has(url))).toBe(false);
  });

  it('demotes low-corroboration Reddit complaints and image posts below stronger sources', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'reddit:complaint',
          source: 'reddit',
          title: 'There is absolutely no way this is the same Opus 4.6 from a month ago',
          summary: 'A complaint thread claims a model got worse based on one frustrating scheduling example.',
          url: 'https://i.redd.it/model-complaint.jpeg',
          sources: [{ title: 'There is absolutely no way this is the same Opus 4.6 from a month ago', url: 'https://i.redd.it/model-complaint.jpeg', type: 'reddit' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { score: 2000000 }
        },
        {
          id: 'official:model-card',
          source: 'x',
          title: 'Anthropic publishes Claude Opus 4.6 system card and evaluation notes',
          summary: 'Anthropic published official evaluation details, system card notes, and safety measurements for Claude Opus 4.6.',
          url: 'https://www.anthropic.com/news/claude-opus-4-6-system-card',
          sources: [{ title: 'Claude Opus 4.6 system card', url: 'https://www.anthropic.com/news/claude-opus-4-6-system-card', type: 'official' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 80 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics[0].sources[0].url).toBe('https://www.anthropic.com/news/claude-opus-4-6-system-card');
    expect(digest.hero_topics[0].summary).not.toContain('absolutely no way');
  });

  it('skips extra hero slots when the only remaining AI cluster is social-only brand chatter', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'ai:research',
          source: 'x',
          title: 'Anthropic publishes automated alignment researcher results',
          summary: 'Anthropic shared official research results and evaluation details for an automated alignment researcher.',
          url: 'https://www.anthropic.com/research/automated-alignment-researcher',
          sources: [{ title: 'Anthropic alignment researcher', url: 'https://www.anthropic.com/research/automated-alignment-researcher', type: 'official' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 500 }
        },
        {
          id: 'img:paper',
          source: 'huggingface_daily_papers',
          title: 'Nucleus-Image Released',
          summary: 'A sparse diffusion model release with strong image-generation results.',
          url: 'https://huggingface.co/papers/nucleus-image',
          sources: [{ title: 'Nucleus-Image Released', url: 'https://huggingface.co/papers/nucleus-image', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 80 }
        },
        {
          id: 'gs:paper',
          source: 'huggingface_daily_papers',
          title: '3D Gaussian Splatting improves dynamic scene reconstruction',
          summary: 'A paper advances 3D reconstruction and view synthesis quality.',
          url: 'https://huggingface.co/papers/3d-gaussian-splatting-dynamic',
          sources: [{ title: '3D Gaussian Splatting improves dynamic scene reconstruction', url: 'https://huggingface.co/papers/3d-gaussian-splatting-dynamic', type: 'paper' }],
          tags: ['gaussian-splatting'],
          subject_primary: 'gaussian-splatting',
          subject_matches: ['gaussian-splatting'],
          subject_match_score: 3,
          engagement: { upvotes: 60 }
        },
        {
          id: 'brand:1',
          source: 'x',
          title: 'Hermes Agent Telegram Mini App shipped v1.0.2 with file attachments',
          summary: 'A product update thread about a mini app release and CSV/PDF attachments.',
          url: 'https://x.com/example/status/1',
          sources: [{ title: 'Hermes mini app update', url: 'https://x.com/example/status/1', type: 'twitter' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 900 }
        },
        {
          id: 'brand:2',
          source: 'x',
          title: 'OpenClaw walkthrough for personal assistant workflows',
          summary: 'A social post about personal assistant workflows and convenience.',
          url: 'https://x.com/example/status/2',
          sources: [{ title: 'OpenClaw walkthrough', url: 'https://x.com/example/status/2', type: 'twitter' }],
          tags: ['agents'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 950 }
        }
      ],
      heroTopicTargetMax: 4,
      notableTargetMax: 2
    });

    expect(digest.hero_topics).toHaveLength(3);
    expect(digest.hero_topics.some((topic) => topic.title.includes('Agent Apps & Platforms'))).toBe(false);
    expect(digest.notable.some((item) => /OpenClaw|Hermes Agent/i.test(item.title))).toBe(false);
  });

  it('drops announcement-only AMA filler from hero supporting sources when better evidence exists', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'img:paper',
          source: 'huggingface_daily_papers',
          title: 'Nucleus-Image Released',
          summary: 'A sparse mixture-of-experts diffusion model release.',
          url: 'https://huggingface.co/papers/nucleus-image',
          sources: [{ title: 'Nucleus-Image Released', url: 'https://huggingface.co/papers/nucleus-image', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 80 }
        },
        {
          id: 'img:roundup',
          source: 'reddit',
          title: 'Last week in Generative Image & Video',
          summary: 'A weekly roundup of notable open-source image and video tooling releases.',
          url: 'https://reddit.com/r/StableDiffusion/comments/1slz1rq/last_week_in_generative_image_video/',
          sources: [{ title: 'Last week in Generative Image & Video', url: 'https://reddit.com/r/StableDiffusion/comments/1slz1rq/last_week_in_generative_image_video/', type: 'reddit' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        },
        {
          id: 'img:ama',
          source: 'reddit',
          title: '[N] AMA Announcement: Max Welling (VAEs, GNNs, AI4Science & CuspAI)',
          summary: 'We are thrilled to announce that Max Welling will be joining us for an AMA on Wednesday. Who is Max Welling?',
          url: 'https://reddit.com/r/MachineLearning/comments/1skil2g/n_ama_announcement_max_welling_vaes_gnns/',
          sources: [{ title: 'AMA Announcement: Max Welling', url: 'https://reddit.com/r/MachineLearning/comments/1skil2g/n_ama_announcement_max_welling_vaes_gnns/', type: 'reddit' }],
          tags: ['machinelearning'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 1,
          engagement: { score: 400 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics[0].sources.map((source) => source.url)).not.toContain('https://reddit.com/r/MachineLearning/comments/1skil2g/n_ama_announcement_max_welling_vaes_gnns/');
  });

  it('does not confuse model token-generation work with agent cost monitoring', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'cost:real',
          source: 'x',
          title: 'Claude Code usage dashboard tracks prompt-token burn and context-window overhead',
          summary: 'An official write-up on prompt-token burn, invisible context, and monitoring Claude Code usage.',
          url: 'https://www.anthropic.com/news/claude-code-usage-dashboard',
          sources: [{ title: 'Claude Code usage dashboard', url: 'https://www.anthropic.com/news/claude-code-usage-dashboard', type: 'official' }],
          tags: ['claudeai'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { likes: 600 }
        },
        {
          id: 'token:generation',
          source: 'reddit',
          title: 'Hot Experts in your VRAM! Dynamic expert cache in llama.cpp for 27% faster token generation',
          summary: 'A systems post on inference throughput and faster token generation in llama.cpp.',
          url: 'https://reddit.com/r/LocalLLaMA/comments/1slue0z/hot_experts_in_your_vram_dynamic_expert_cache_in/',
          sources: [{ title: 'llama.cpp dynamic expert cache', url: 'https://reddit.com/r/LocalLLaMA/comments/1slue0z/hot_experts_in_your_vram_dynamic_expert_cache_in/', type: 'reddit' }],
          tags: ['localllama'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { score: 600 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 1
    });

    expect(digest.hero_topics[0].title).toContain('Cost & Monitoring');
    expect(digest.hero_topics[0].sources.map((source) => source.url)).not.toContain('https://reddit.com/r/LocalLLaMA/comments/1slue0z/hot_experts_in_your_vram_dynamic_expert_cache_in/');
  });

  it('does not promote a lone low-signal complaint cluster to hero status', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'weak:complaint',
          source: 'reddit',
          title: 'Model got worse again and I am done with this bullshit',
          summary: 'A complaint post arguing the model is worse now, with an image screenshot and no corroboration.',
          url: 'https://i.redd.it/model-complaint.png',
          sources: [{ title: 'Complaint screenshot', url: 'https://i.redd.it/model-complaint.png', type: 'reddit' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { score: 5000 }
        },
        {
          id: 'img:solid',
          source: 'huggingface_daily_papers',
          title: 'Nucleus-Image Released',
          summary: 'A sparse diffusion model release with strong image-generation results.',
          url: 'https://huggingface.co/papers/nucleus-image',
          sources: [{ title: 'Nucleus-Image Released', url: 'https://huggingface.co/papers/nucleus-image', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 80 }
        }
      ],
      heroTopicTargetMax: 2,
      notableTargetMax: 1
    });

    expect(digest.hero_topics).toHaveLength(1);
    expect(digest.hero_topics[0].title).toContain('Image/Video GenAI');
  });

  it('labels analysis as multi-source when a hero uses multiple sources', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'research:1',
          source: 'x',
          title: 'Anthropic shares automated alignment researcher results',
          summary: 'Anthropic shares results and research framing for an automated alignment researcher.',
          url: 'https://www.anthropic.com/research/automated-alignment',
          sources: [{ title: 'Anthropic automated alignment', url: 'https://www.anthropic.com/research/automated-alignment', type: 'official' }],
          tags: ['claude'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 3,
          engagement: { likes: 300 }
        },
        {
          id: 'research:2',
          source: 'reddit',
          title: 'Anthropic Autonomous AI Agents outperform human researchers on weak-to-strong supervision',
          summary: 'A linked discussion of the same research with additional framing.',
          url: 'https://alignment.anthropic.com/2026/automated-w2s-researcher/',
          sources: [{ title: 'Weak-to-strong supervision writeup', url: 'https://alignment.anthropic.com/2026/automated-w2s-researcher/', type: 'research' }],
          tags: ['claudeai'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { score: 200 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    expect(digest.hero_topics[0].sources.length).toBeGreaterThan(1);
    expect(digest.hero_topics[0].insight).toContain('multi-source');
  });

  it('keeps hero-covered items out of notables even when a hero group has more than four sources', () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `cluster:${index + 1}`,
      source: 'x',
      title: `Agent research source ${index + 1}`,
      summary: `Research source ${index + 1} contributes a distinct corroborating signal for the same hero theme.`,
      url: `https://example.com/source-${index + 1}`,
      sources: [{ title: `Agent research source ${index + 1}`, url: `https://example.com/source-${index + 1}`, type: 'official' }],
      tags: ['claude'],
      subject_primary: 'ai-agents',
      subject_matches: ['ai-agents'],
      subject_match_score: 3,
      engagement: { likes: 500 - index * 10 }
    }));

    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items,
      heroTopicTargetMax: 1,
      notableTargetMax: 10
    });

    expect(digest.hero_topics[0].sources).toHaveLength(4);
    expect(digest.notable).toHaveLength(0);
  });

  it('does not treat corroborated mixed-source posts as reddit-media-only', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'gs:corroborated',
          source: 'reddit',
          title: 'Corroborated Gaussian tool release',
          summary: 'A Gaussian splatting release with both a Reddit gallery and a linked GitHub repository.',
          url: 'https://www.reddit.com/gallery/123456',
          sources: [
            { title: 'Reddit gallery post', url: 'https://www.reddit.com/gallery/123456', type: 'reddit' },
            { title: 'GitHub repo', url: 'https://github.com/example/gaussian-tool', type: 'github' }
          ],
          tags: ['gaussian-splatting'],
          subject_primary: 'gaussian-splatting',
          subject_matches: ['gaussian-splatting'],
          subject_match_score: 3,
          engagement: { score: 150 }
        },
        {
          id: 'gs:plain',
          source: 'reddit',
          title: 'Plain Gaussian gallery post',
          summary: 'A weaker gallery-only Gaussian post.',
          url: 'https://www.reddit.com/gallery/plain',
          sources: [{ title: 'Plain gallery', url: 'https://www.reddit.com/gallery/plain', type: 'reddit' }],
          tags: ['gaussian-splatting'],
          subject_primary: 'gaussian-splatting',
          subject_matches: ['gaussian-splatting'],
          subject_match_score: 2,
          engagement: { score: 300 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    expect(digest.hero_topics[0].sources.map((source) => source.url)).toContain('https://github.com/example/gaussian-tool');
  });

  it('cleans host-prefixed url source labels in rendered notables', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'reddit:design-extract',
          source: 'reddit',
          title: 'I built a Claude Code plugin that extracts any website\'s full design system',
          summary: 'The tool extracts a site design system and also links the project repo for implementation details.',
          url: 'https://i.redd.it/najpel0wzbvg1.png',
          sources: [
            { title: 'Reddit image', url: 'https://i.redd.it/najpel0wzbvg1.png', type: 'reddit' },
            { title: 'stripe.com: `https://stripe.com`', url: 'https://stripe.com/', type: 'project' },
            { title: 'GitHub repo', url: 'https://github.com/Manavarya09/design-extract', type: 'github' }
          ],
          tags: ['claudeai'],
          subject_primary: 'ai-agents',
          subject_matches: ['ai-agents'],
          subject_match_score: 2,
          engagement: { score: 320 }
        }
      ],
      heroTopicTargetMax: 0,
      notableTargetMax: 1
    });

    expect(digest.notable[0].sources[1]).toEqual({
      title: 'stripe.com',
      url: 'https://stripe.com',
      type: 'project'
    });
  });

  it('publishes corroborated 3D world-generation reddit media posts as a real hero topic', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'reddit:hy-world',
          source: 'reddit',
          title: 'Tencent HY-World 2.0 open-source multimodal 3D world generation from Tencent Hunyuan',
          summary: 'HY-World 2.0 is a multimodal world model that can generate persistent, explorable 3D environments with engine-compatible exports.',
          url: 'https://v.redd.it/g91l2x98w7vg1',
          sources: [
            { title: 'Reddit video', url: 'https://v.redd.it/g91l2x98w7vg1', type: 'reddit' },
            { title: '3d-models.hunyuan.tencent.com', url: 'https://3d-models.hunyuan.tencent.com/world/', type: 'official' }
          ],
          tags: ['stablediffusion'],
          subject_primary: 'generative-3d-worlds',
          subject_matches: ['generative-3d-worlds'],
          subject_match_score: 6,
          engagement: { score: 481 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    expect(digest.hero_topics).toHaveLength(1);
    expect(digest.hero_topics[0].title).toBe('Generative 3D Worlds: Explorable World Models');
    expect(digest.hero_topics[0].summary).not.toMatch(/\bSource\b|##|\\"/);
    expect(digest.hero_topics[0].sources.map((source) => source.url)).toContain('https://3d-models.hunyuan.tencent.com/world');
  });

  it('labels GitHub source citations as owner/repo instead of the bare domain', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'reddit:gh',
          source: 'reddit',
          title: 'New open-source Numina tool for image editing',
          summary: 'A new open-source tool for precise image editing based on learned trajectories.',
          url: 'https://github.com/h-embodvis/numina',
          sources: [
            { title: 'Reddit thread', url: 'https://reddit.com/r/StableDiffusion/comments/1numina/new_numina/', type: 'reddit' },
            { title: 'github.com: GitHub', url: 'https://github.com/h-embodvis/numina', type: 'github' }
          ],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 240 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    const titles = digest.hero_topics[0].sources.map((source) => source.title);
    expect(titles).toContain('h-embodvis/numina');
    expect(titles.every((title) => title !== 'github.com: GitHub')).toBe(true);
  });

  it('labels Hugging Face paper and X citations with meaningful names', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'paper:hf',
          source: 'huggingface_daily_papers',
          title: 'LoGeR: long-context reconstruction',
          summary: 'A paper on long-context reconstruction.',
          url: 'https://huggingface.co/papers/2603.03269',
          sources: [
            { title: 'huggingface.co', url: 'https://huggingface.co/papers/2603.03269', type: 'paper' },
            { title: '@DylanTFWang', url: 'https://x.com/DylanTFWang/status/2043952886166761519', type: 'twitter' }
          ],
          tags: ['gaussian-splatting'],
          subject_primary: 'gaussian-splatting',
          subject_matches: ['gaussian-splatting'],
          subject_match_score: 3,
          engagement: { upvotes: 120 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    const titles = digest.hero_topics[0].sources.map((source) => source.title);
    expect(titles).toContain('HF paper: 2603.03269');
    expect(titles).toContain('@DylanTFWang');
  });

  it('embeds inline markdown links in hero summaries that point to the underlying sources', () => {
    const digest = buildPreviewDigest({
      issueDate: '2026-04-19',
      publishedAt: '2026-04-19T06:01:09.037Z',
      items: [
        {
          id: 'paper:nucleus',
          source: 'huggingface_daily_papers',
          title: 'Nucleus-Image Released',
          summary: 'Nucleus-Image is a sparse mixture-of-experts diffusion transformer with 17B total parameters.',
          url: 'https://huggingface.co/papers/nucleus-image',
          sources: [{ title: 'Nucleus-Image Released', url: 'https://huggingface.co/papers/nucleus-image', type: 'paper' }],
          tags: ['vision'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { upvotes: 80 }
        },
        {
          id: 'repo:numina',
          source: 'reddit',
          title: 'Numina releases a post-processing LoRA for LTX2.3',
          summary: 'A new post-processing LoRA for LTX2.3 image rendering with improved detail.',
          url: 'https://github.com/h-embodvis/numina',
          sources: [{ title: 'github.com', url: 'https://github.com/h-embodvis/numina', type: 'github' }],
          tags: ['stablediffusion'],
          subject_primary: 'image-video-genai',
          subject_matches: ['image-video-genai'],
          subject_match_score: 2,
          engagement: { score: 300 }
        }
      ],
      heroTopicTargetMax: 1,
      notableTargetMax: 0
    });

    const summary = digest.hero_topics[0].summary;
    expect(summary).toMatch(/\[Nucleus-Image Released\]\(https:\/\/huggingface\.co\/papers\/nucleus-image\)/);
    expect(summary).toMatch(/\[h-embodvis\/numina\]\(https:\/\/github\.com\/h-embodvis\/numina\)/);
  });
});
