import { describe, expect, it } from 'vitest';
import { classifyDigestItem, collectSubjectCounts } from '../../../scripts/digest/shared/subjects.mjs';

const config = {
  enabled: true,
  mode: 'allowlist',
  minimum_match_score: 1,
  professional_only: true,
  families: [
    {
      id: 'gaussian-splatting',
      label: '3D Gaussian Splatting',
      include_terms: ['gaussian splatting', '3d gaussian splatting', '3dgs', 'splatfacto', 'gsplat'],
      adjacent_terms: ['radiance fields', 'novel view synthesis', 'scene reconstruction'],
      exclude_terms: []
    },
    {
      id: 'generative-3d-worlds',
      label: 'Generative 3D Worlds',
      include_terms: ['3d world generation', 'generative 3d worlds', 'world model', 'explorable 3d worlds', 'persistent 3d worlds'],
      adjacent_terms: ['navigable environments', 'spatial persistence', 'world generation', 'interactive scenes'],
      exclude_terms: []
    },
    {
      id: 'ai-agents',
      label: 'AI Agents',
      include_terms: ['ai agents', 'agentic', 'claude', 'gpt', 'hermes', 'openclaw'],
      adjacent_terms: ['tool use', 'coding agent', 'orchestration'],
      exclude_terms: []
    },
    {
      id: 'image-video-genai',
      label: 'Image/Video GenAI',
      include_terms: ['image generation', 'video generation', 'sam'],
      adjacent_terms: ['segmentation', 'image editing', 'video editing'],
      exclude_terms: []
    }
  ]
};

describe('digest subject classification', () => {
  it('accepts gaussian splatting items and annotates subject metadata', () => {
    const item = {
      id: 'reddit:1',
      title: '3D Gaussian Splatting pushes real-time novel view synthesis forward',
      summary: 'A new radiance fields paper improves scene rendering quality.',
      tags: ['graphics'],
      url: 'https://example.com/gs'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(true);
    expect(result.item.subject_primary).toBe('gaussian-splatting');
    expect(result.item.subject_matches).toContain('gaussian-splatting');
    expect(result.item.subject_match_score).toBeGreaterThan(0);
    expect(result.item.filter_decision).toBe('accepted');
  });

  it('captures additional gaussian-splatting adjacent terminology like 3DGS and splatfacto', () => {
    const item = {
      id: 'paper:3dgs',
      title: 'Splatfacto improves 3DGS training and rendering speed',
      summary: 'A practical update for gsplat-style pipelines and scene reconstruction.',
      tags: ['3dgs'],
      url: 'https://example.com/3dgs'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(true);
    expect(result.item.subject_primary).toBe('gaussian-splatting');
  });

  it('accepts notable explorable 3D world-generation releases as a first-class subject', () => {
    const item = {
      id: 'x:lyra-2',
      title: 'NVIDIA releases Lyra 2.0 for persistent, explorable 3D worlds',
      summary: 'A NVIDIA Research framework for generating large-scale 3D world models with spatial persistence and navigation.',
      tags: ['nvidia-research'],
      url: 'https://x.com/NVIDIAAIDev/status/2044445645109436672'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(true);
    expect(result.item.subject_primary).toBe('generative-3d-worlds');
    expect(result.item.subject_matches).toContain('generative-3d-worlds');
    expect(result.item.filter_reason).toBe('Matched Generative 3D Worlds');
  });

  it('keeps notable classic CV items in scope for image/video coverage', () => {
    const item = {
      id: 'paper:1',
      title: 'Segment Anything (SAM) sets a new baseline for promptable segmentation',
      summary: 'The work matters broadly for image processing and visual tooling.',
      tags: ['computer-vision'],
      url: 'https://example.com/sam'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(true);
    expect(result.item.subject_matches).toContain('image-video-genai');
  });

  it('rejects items that do not match any chosen professional subject', () => {
    const item = {
      id: 'reddit:2',
      title: 'A general startup funding roundup',
      summary: 'Market commentary without relevance to the configured subjects.',
      tags: ['business'],
      url: 'https://example.com/funding'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(false);
    expect(result.item.filter_decision).toBe('rejected');
    expect(result.item.subject_matches).toEqual([]);
  });

  it('keeps legitimate OpenClaw and Hermes Agent platform posts in scope', () => {
    const item = {
      id: 'x:platform',
      title: 'OpenClaw desktop app now supports file attachments for Hermes Agent workflows',
      summary: 'A release update for an agent app/workspace product.',
      tags: ['agents'],
      url: 'https://example.com/openclaw-release'
    };

    const result = classifyDigestItem(item, config);

    expect(result.accepted).toBe(true);
    expect(result.item.subject_primary).toBe('ai-agents');
  });

  it('collects subject counts from accepted pool items', () => {
    const counts = collectSubjectCounts([
      { id: '1', subject_primary: 'ai-agents' },
      { id: '2', subject_primary: 'ai-agents' },
      { id: '3', subject_primary: 'gaussian-splatting' },
      { id: '4', subject_primary: null }
    ]);

    expect(counts).toEqual({
      'ai-agents': 2,
      'gaussian-splatting': 1,
      unknown: 1
    });
  });
});
