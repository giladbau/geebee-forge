import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canvas and animation APIs — the page may use them for visuals
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = vi.fn((cb) => { cb(0); return 0; });
  window.cancelAnimationFrame = vi.fn();
  window.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver;
});

import PlaywrightPage from '../routes/playwright/+page.svelte';

describe('Playwright Demo Page — Basic Rendering', () => {
  it('renders without crashing', () => {
    const { container } = render(PlaywrightPage);
    expect(container).toBeTruthy();
  });

  it('has a visible h1 heading', () => {
    render(PlaywrightPage);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('heading references playwright or vision concepts', () => {
    render(PlaywrightPage);
    const heading = screen.getByRole('heading', { level: 1 });
    const text = heading.textContent?.toLowerCase() ?? '';
    const isRelevant =
      text.includes('playwright') ||
      text.includes('vision') ||
      text.includes('browser') ||
      text.includes('automation');
    expect(isRelevant).toBe(true);
  });

  it('has an interactive container (data-testid or role)', () => {
    const { container } = render(PlaywrightPage);
    const demoContainer =
      container.querySelector('[data-testid="playwright-demo"]') ??
      container.querySelector('[data-testid="demo-container"]') ??
      container.querySelector('main') ??
      container.querySelector('[role="main"]');
    expect(demoContainer).toBeTruthy();
  });

  it('renders comparison or demo content (not blank)', () => {
    const { container } = render(PlaywrightPage);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('mounts without throwing', () => {
    expect(() => render(PlaywrightPage)).not.toThrow();
  });
});
