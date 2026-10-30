import { MARK_PATH, NAME_PATH, VIEW_BOX } from './Logo';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const LOCKUP = readFileSync('public/logo/flexspot-lockup-dark.svg', 'utf8');

describe('Logo', () => {
  it('draws the same lockup as the logo file', () => {
    const paths = [...LOCKUP.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map(
      match => match[1],
    );
    expect(LOCKUP).toContain(`viewBox="${VIEW_BOX}"`);
    expect(paths).toEqual([MARK_PATH, NAME_PATH]);
  });
});
