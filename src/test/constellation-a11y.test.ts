import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
  const mockCanvas = document.createElement('canvas');
  function WebGLRenderer() {
    return {
      setSize: vi.fn(), setPixelRatio: vi.fn(), render: vi.fn(),
      dispose: vi.fn(), domElement: mockCanvas, getPixelRatio: vi.fn(() => 1),
    };
  }
  function Scene() { return { add: vi.fn(), background: null }; }
  function PerspectiveCamera() { return { position: { z: 0, x: 0, y: 0 }, aspect: 1, updateProjectionMatrix: vi.fn(), lookAt: vi.fn() }; }
  function BufferGeometry() { return { setAttribute: vi.fn(), dispose: vi.fn(), attributes: { position: { array: new Float32Array(0), needsUpdate: false } } }; }
  function BufferAttribute() {}
  function ShaderMaterial() { return { uniforms: { time: { value: 0 }, pixelRatio: { value: 1 }, baseColor: { value: {} } }, dispose: vi.fn() }; }
  function PointsMaterial() { return { dispose: vi.fn() }; }
  function Points() { return { rotation: { x: 0, y: 0 }, add: vi.fn() }; }
  function LineSegments() { return { rotation: { x: 0, y: 0 } }; }
  function Clock() { return { getElapsedTime: vi.fn(() => 0) }; }
  function Vector3(x = 0, y = 0, z = 0) { return { x, y, z, distanceTo: vi.fn(() => 3) }; }
  function Color() {}
  return { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, ShaderMaterial, PointsMaterial, Points, LineSegments, Clock, Vector3, Color, AdditiveBlending: 2 };
});

import ConstellationPage from '../routes/constellation/+page.svelte';

describe('Accessibility — Constellation Page', () => {
  it('canvas or container has an aria-label or role description', () => {
    const { container } = render(ConstellationPage);
    const mountEl = container.querySelector('[data-testid="constellation-canvas"]') ?? container.querySelector('canvas');
    expect(mountEl).toBeTruthy();
    if (mountEl) {
      const hasLabel = mountEl.hasAttribute('aria-label') || mountEl.hasAttribute('aria-labelledby') || mountEl.hasAttribute('role');
      expect(hasLabel).toBe(true);
    }
  });

  it('page has a heading identifying the demo', () => {
    render(ConstellationPage);
    const headings = screen.queryAllByRole('heading');
    const constellationHeading = headings.find(h => h.textContent?.toLowerCase().includes('constellation'));
    // Accept sr-only heading or visible heading
    expect(constellationHeading !== undefined || document.title.toLowerCase().includes('constellation')).toBe(true);
  });

  it('has a back/home link to return to the landing page', () => {
    render(ConstellationPage);
    const links = screen.getAllByRole('link');
    const homeLink = links.find(l =>
      l.getAttribute('href') === '/' ||
      l.getAttribute('href') === '/home' ||
      l.textContent?.toLowerCase().includes('back') ||
      l.textContent?.toLowerCase().includes('home')
    );
    expect(homeLink).toBeTruthy();
  });
});
