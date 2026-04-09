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
    expect(digest.notable.length).toBeGreaterThanOrEqual(1);
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

    expect(digest.hero_topics[0].title).toContain('Last week in Generative Image & Video');
    expect(digest.hero_topics[0].summary).not.toContain('https://');
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

    expect(digest.hero_topics[0].summary).toContain('Key signals this cycle');
    expect(digest.hero_topics[0].summary).toContain('Last week in Generative Image & Video');
    expect(digest.hero_topics[0].summary).toContain('Think in Strokes, Not Pixels');
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
});
