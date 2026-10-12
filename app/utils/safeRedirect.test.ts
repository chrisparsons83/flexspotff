import { safeRedirect } from './safeRedirect';
import { describe, expect, it } from 'vitest';

describe('safeRedirect', () => {
  it('keeps a path on this site', () => {
    expect(safeRedirect('/leagues/standings?year=2026#top')).toBe(
      '/leagues/standings?year=2026#top',
    );
  });

  it.each([
    null,
    '',
    'leagues',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
  ])('sends %j home', to => {
    expect(safeRedirect(to)).toBe('/');
  });
});
