import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('Constellation Demo Page', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}));
    window.requestAnimationFrame = vi.fn();
    window.cancelAnimationFrame = vi.fn();
  });

  it('renders without crashing', () => {
    const { container } = render(ConstellationPage);
    expect(container).toBeTruthy();
  });

  it('has a visible page heading or title', () => {
    render(ConstellationPage);
    const headings = screen.queryAllByRole('heading');
    expect(headings.length > 0 || document.title.toLowerCase().includes('constellation')).toBe(true);
  });

  it('renders a canvas element or a Three.js mount container', () => {
    const { container } = render(ConstellationPage);
    const canvas = container.querySelector('canvas');
    const mountDiv = container.querySelector('[data-testid="constellation-canvas"]') ?? container.querySelector('[data-testid="scene-container"]');
    expect(canvas !== null || mountDiv !== null).toBe(true);
  });

  it('canvas/container is present in the document', () => {
    const { container } = render(ConstellationPage);
    const mountEl = container.querySelector('[data-testid="constellation-canvas"]') ?? container.querySelector('canvas');
    expect(mountEl).toBeInTheDocument();
  });

  it('mounts the Three.js renderer without throwing', () => {
    expect(() => render(ConstellationPage)).not.toThrow();
  });
});
