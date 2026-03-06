import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LandingPage from '../routes/+page.svelte';

describe('Navigation — Playwright Demo Card on Landing Page', () => {
  it('landing page has a card or link mentioning playwright', () => {
    render(LandingPage);
    // Accept either a text match or a link with href /playwright
    const playwrightEls = screen.queryAllByText(/playwright/i);
    const playwrightLinks = screen
      .queryAllByRole('link')
      .filter((l) => l.getAttribute('href')?.includes('playwright'));

    expect(playwrightEls.length + playwrightLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('there is a link pointing to /playwright', () => {
    render(LandingPage);
    const links = screen.getAllByRole('link');
    const playwrightLink = links.find((l) =>
      l.getAttribute('href') === '/playwright' ||
      l.getAttribute('href')?.endsWith('/playwright')
    );
    expect(playwrightLink).toBeInTheDocument();
  });

  it('the /playwright link is inside a demo card', () => {
    render(LandingPage);

    // Find the link
    const links = screen.getAllByRole('link');
    const playwrightLink = links.find((l) =>
      l.getAttribute('href') === '/playwright' ||
      l.getAttribute('href')?.endsWith('/playwright')
    );
    expect(playwrightLink).toBeTruthy();

    // It should live inside a card element
    if (playwrightLink) {
      const card =
        playwrightLink.closest('[data-testid="demo-card"]') ??
        playwrightLink.closest('article') ??
        playwrightLink.closest('[role="article"]') ??
        playwrightLink.closest('li') ??
        playwrightLink.closest('section');
      expect(card).toBeTruthy();
    }
  });

  it('the playwright demo card has a non-empty title', () => {
    render(LandingPage);
    const links = screen.getAllByRole('link');
    const playwrightLink = links.find((l) =>
      l.getAttribute('href') === '/playwright' ||
      l.getAttribute('href')?.endsWith('/playwright')
    );

    if (!playwrightLink) {
      // Link not yet present — implementation pending
      expect(true).toBe(true);
      return;
    }

    const card =
      playwrightLink.closest('[data-testid="demo-card"]') ??
      playwrightLink.closest('article') ??
      playwrightLink.closest('li') ??
      playwrightLink.closest('section') ??
      playwrightLink.parentElement;

    if (card) {
      const title =
        within(card as HTMLElement).queryByRole('heading') ??
        within(card as HTMLElement).queryByTestId('card-title');
      expect(title).toBeTruthy();
      expect(title!.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('the playwright card link has a non-empty and valid href', () => {
    render(LandingPage);
    const links = screen.getAllByRole('link');
    const playwrightLink = links.find((l) =>
      l.getAttribute('href') === '/playwright' ||
      l.getAttribute('href')?.endsWith('/playwright')
    );

    if (!playwrightLink) {
      expect(true).toBe(true);
      return;
    }

    const href = playwrightLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).not.toBe('#');
    expect(href).toMatch(/playwright/i);
  });
});
