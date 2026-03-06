import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LandingPage from '../routes/+page.svelte';

describe('Navigation & Routing', () => {
  it('Constellation card link points to /constellation', () => {
    render(LandingPage);
    // Find the link that references the constellation demo
    const links = screen.getAllByRole('link');
    const constellationLink = links.find(
      (l) =>
        l.getAttribute('href')?.includes('constellation') ||
        l.textContent?.toLowerCase().includes('constellation')
    );
    expect(constellationLink).toBeTruthy();
    expect(constellationLink!.getAttribute('href')).toBe('/constellation');
  });

  it('all internal demo card links start with /', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    for (const card of cards) {
      const link = within(card).getByRole('link');
      const href = link.getAttribute('href') ?? '';
      // Internal SvelteKit links start with "/" (not "http" or "mailto")
      expect(href.startsWith('/')).toBe(true);
    }
  });

  it('no broken anchor-only links (#) in demo cards', () => {
    render(LandingPage);
    const cards =
      screen.queryAllByRole('article').length > 0
        ? screen.queryAllByRole('article')
        : screen.queryAllByTestId('demo-card');

    for (const card of cards) {
      const link = within(card).getByRole('link');
      expect(link.getAttribute('href')).not.toBe('#');
      expect(link.getAttribute('href')).not.toBe('');
    }
  });

  it('landing page does not render a broken back-link to an archived route', () => {
    render(LandingPage);
    const links = screen.getAllByRole('link');
    const badLinks = links.filter((l) =>
      ['/magen', '/dashboard'].includes(l.getAttribute('href') ?? '')
    );
    // The Magen routes are archived — they should not appear on the new landing page
    expect(badLinks.length).toBe(0);
  });
});
