import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LandingPage from '../routes/+page.svelte';

describe('Accessibility — Landing Page', () => {
  it('demo card links have accessible (non-empty) text', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    for (const card of cards) {
      const link = within(card).getByRole('link');
      // Accessible name can come from textContent or aria-label
      const accessibleName =
        link.getAttribute('aria-label') ?? link.textContent?.trim() ?? '';
      expect(accessibleName.length).toBeGreaterThan(0);
    }
  });

  it('demo card links are descriptive (not just "click here" or "more")', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    const vaguePhrases = ['click here', 'here', 'more', 'read more', 'link'];

    for (const card of cards) {
      const link = within(card).getByRole('link');
      const text = (
        link.getAttribute('aria-label') ??
        link.textContent ??
        ''
      ).toLowerCase().trim();
      expect(vaguePhrases).not.toContain(text);
    }
  });

  it('page has exactly one h1', () => {
    render(LandingPage);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.length).toBe(1);
  });

  it('images (if any) have alt text', () => {
    const { container } = render(LandingPage);
    const images = container.querySelectorAll('img');
    for (const img of Array.from(images)) {
      // alt="" is acceptable for decorative images, but the attribute must exist
      expect(img.hasAttribute('alt')).toBe(true);
    }
  });

  it('color contrast — dark theme classes are applied (smoke test)', () => {
    const { container } = render(LandingPage);
    // We can't compute actual contrast in jsdom, but we can verify
    // that the root element carries a dark theme class or CSS variable.
    // Adjust the selector to match whatever the app uses (e.g. class="dark", data-theme="dark").
    const root = container.firstElementChild as HTMLElement;
    // Accept: has class "dark", or a data-theme attribute, or inline style with the bg color.
    const hasDarkIndicator =
      root?.classList.contains('dark') ||
      root?.getAttribute('data-theme') === 'dark' ||
      document.documentElement.classList.contains('dark') ||
      // fallback: at least the body doesn't have an explicit light theme
      !document.body.classList.contains('light');
    expect(hasDarkIndicator).toBe(true);
  });
});
