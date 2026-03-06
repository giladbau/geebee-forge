import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LandingPage from '../routes/+page.svelte';

describe('Landing Page', () => {
  it('renders without crashing', () => {
    const { container } = render(LandingPage);
    expect(container).toBeTruthy();
  });

  it('has a visible page heading', () => {
    render(LandingPage);
    // Accepts h1 or a prominent heading with text like "demos", "demo hub", etc.
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('has a descriptive page title (document title)', async () => {
    render(LandingPage);
    // SvelteKit sets <title> via <svelte:head> — give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(document.title).toBeTruthy();
    expect(document.title.length).toBeGreaterThan(0);
  });

  it('shows at least one demo card', () => {
    render(LandingPage);
    // Cards should have role="article" or be queryable by a test id
    // Accept either role="article" or a data-testid="demo-card"
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('every demo card has a non-empty title', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    for (const card of cards) {
      // Title can be an h2/h3 inside the card, or a data-testid="card-title"
      const title =
        within(card).queryByRole('heading') ??
        within(card).queryByTestId('card-title');
      expect(title).toBeTruthy();
      expect(title!.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('every demo card contains a link', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    for (const card of cards) {
      const link = within(card).getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href');
      // href must be non-empty and not just "#"
      expect(link.getAttribute('href')).toMatch(/\S/);
      expect(link.getAttribute('href')).not.toBe('#');
    }
  });

  it('the Constellation demo card is present', () => {
    render(LandingPage);
    // There should be a card or link mentioning "constellation" (case-insensitive)
    const constellationEls = screen.getAllByText(/constellation/i);
    expect(constellationEls.length).toBeGreaterThanOrEqual(1);
  });
});
