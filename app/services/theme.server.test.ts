import { getThemePreference, serializeThemePreference } from './theme.server';
import { describe, expect, it } from 'vitest';

const requestWith = (cookie?: string) =>
  new Request('http://localhost/', {
    headers: cookie ? { Cookie: cookie } : {},
  });

describe('getThemePreference', () => {
  it('follows the system when nothing is chosen', async () => {
    expect(await getThemePreference(requestWith())).toBe('system');
  });

  it('reads the chosen theme', async () => {
    const cookie = await serializeThemePreference('light');
    expect(await getThemePreference(requestWith(cookie))).toBe('light');
  });

  it('ignores a cookie it does not recognise', async () => {
    expect(await getThemePreference(requestWith('theme=pink'))).toBe('system');
  });
});
