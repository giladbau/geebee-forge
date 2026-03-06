import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    fill: vi.fn(), arc: vi.fn(), save: vi.fn(), restore: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 0 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = vi.fn(() => 0);
  window.cancelAnimationFrame = vi.fn();
  window.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver;
});

import PlaywrightPage from '../routes/playwright/+page.svelte';

describe('Accessibility — Playwright Demo Page', () => {
  it('has a single h1 as the top-level heading', () => {
    render(PlaywrightPage);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim().length).toBeGreaterThan(0);
  });

  it('heading hierarchy starts at h1 and does not skip to h3+ without h2', () => {
    const { container } = render(PlaywrightPage);
    const h1 = container.querySelectorAll('h1');
    const h3Plus = container.querySelectorAll('h3, h4, h5, h6');
    const h2 = container.querySelectorAll('h2');
    // If there are h3+, there must also be h1 and h2
    if (h3Plus.length > 0) {
      expect(h1.length).toBeGreaterThanOrEqual(1);
      expect(h2.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(h1.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('has a back/home link pointing to /', () => {
    render(PlaywrightPage);
    const links = screen.getAllByRole('link');
    const homeLink = links.find(
      (l) =>
        l.getAttribute('href') === '/' ||
        l.textContent?.toLowerCase().includes('back') ||
        l.textContent?.toLowerCase().includes('home') ||
        l.getAttribute('aria-label')?.toLowerCase().includes('back') ||
        l.getAttribute('aria-label')?.toLowerCase().includes('home')
    );
    expect(homeLink).toBeTruthy();
  });

  it('back link href is exactly "/"', () => {
    render(PlaywrightPage);
    const links = screen.getAllByRole('link');
    const backLink = links.find(
      (l) =>
        l.getAttribute('href') === '/' ||
        l.textContent?.toLowerCase().includes('back') ||
        l.getAttribute('aria-label')?.toLowerCase().includes('back')
    );
    expect(backLink).toBeTruthy();
    if (backLink) {
      expect(backLink.getAttribute('href')).toBe('/');
    }
  });

  it('interactive buttons have accessible labels', () => {
    render(PlaywrightPage);
    const buttons = screen.queryAllByRole('button');
    for (const btn of buttons) {
      // Each button should have visible text, aria-label, or aria-labelledby
      const hasLabel =
        (btn.textContent?.trim().length ?? 0) > 0 ||
        btn.hasAttribute('aria-label') ||
        btn.hasAttribute('aria-labelledby');
      expect(hasLabel).toBe(true);
    }
  });

  it('comparison panels have accessible region labels or headings', () => {
    const { container } = render(PlaywrightPage);
    // Panels should be identifiable by a heading or aria-label
    const withoutVision =
      screen.queryByText(/without vision/i) ??
      container.querySelector('[aria-label*="without" i]') ??
      container.querySelector('[data-testid*="without"]');
    const withVision =
      screen.queryByText(/\bwith vision\b/i) ??
      container.querySelector('[aria-label*="with vision" i]') ??
      container.querySelector('[data-testid*="with-vision"]');

    expect(withoutVision).toBeTruthy();
    expect(withVision).toBeTruthy();
  });

  it('page has a document title set', async () => {
    render(PlaywrightPage);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.title.trim().length).toBeGreaterThan(0);
  });
});
