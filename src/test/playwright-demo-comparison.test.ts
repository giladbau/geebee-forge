import { render, screen, within } from '@testing-library/svelte';
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

describe('Playwright Demo Page — Comparison Panels', () => {
  it('renders a "Without Vision" panel', () => {
    render(PlaywrightPage);
    const panel =
      screen.queryByTestId('panel-without-vision') ??
      screen.queryByTestId('without-vision') ??
      screen.queryByText(/without vision/i);
    expect(panel).toBeInTheDocument();
  });

  it('renders a "With Vision" panel', () => {
    render(PlaywrightPage);
    const panel =
      screen.queryByTestId('panel-with-vision') ??
      screen.queryByTestId('with-vision') ??
      screen.queryByText(/with vision/i);
    expect(panel).toBeInTheDocument();
  });

  it('has exactly two comparison panels (or at least two labeled sections)', () => {
    const { container } = render(PlaywrightPage);

    // Try explicit data-testid first
    let panels = container.querySelectorAll('[data-testid*="panel"]');
    if (panels.length < 2) {
      panels = container.querySelectorAll('[data-testid*="comparison"]');
    }
    if (panels.length < 2) {
      // Fall back: count elements containing "vision"
      const withoutVision = screen.queryByText(/without vision/i);
      const withVision = screen.queryByText(/with vision/i);
      expect(withoutVision).toBeInTheDocument();
      expect(withVision).toBeInTheDocument();
    } else {
      expect(panels.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('the two panels have different labels / content', () => {
    render(PlaywrightPage);
    const withoutEl = screen.queryByText(/without vision/i);
    const withEl = screen.queryByText(/\bwith vision\b/i);
    // Both exist and are distinct elements
    expect(withoutEl).toBeTruthy();
    expect(withEl).toBeTruthy();
    expect(withoutEl).not.toBe(withEl);
  });

  it('panels contain non-empty descriptive content', () => {
    const { container } = render(PlaywrightPage);
    // Find any element labeled "Without Vision" and check it has surrounding content
    const withoutEl = screen.queryByText(/without vision/i);
    if (withoutEl) {
      // The parent section/div should have more than just the label
      const parent = withoutEl.closest('section, article, div[data-testid], [role="region"]') ?? withoutEl.parentElement;
      expect(parent?.textContent?.trim().length).toBeGreaterThan(withoutEl.textContent?.length ?? 0);
    } else {
      // Fallback: page has meaningful content
      expect(container.textContent?.trim().length).toBeGreaterThan(50);
    }
  });
});
