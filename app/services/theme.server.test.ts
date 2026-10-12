import { getThemePreference, serializeThemePreference } from './theme.server';
import { afterEach, describe, expect, it } from 'vitest';

const requestWith = async (cookie?: string) =>
  new Request('http://localhost/', {
    headers: cookie ? { Cookie: cookie } : {},
  });

const originalNodeEnv = process.env.NODE_ENV;

const setNodeEnv = (value: typeof process.env.NODE_ENV) => {
  process.env.NODE_ENV = value;
};

describe('getThemePreference', () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  it('is always dark outside development, whatever the cookie says', async () => {
    setNodeEnv('production');
    const cookie = await serializeThemePreference('light');
    expect(await getThemePreference(await requestWith(cookie))).toBe('dark');
  });

  it('follows the system in development when nothing is chosen', async () => {
    setNodeEnv('development');
    expect(await getThemePreference(await requestWith())).toBe('system');
  });

  it('reads the chosen theme in development', async () => {
    setNodeEnv('development');
    const cookie = await serializeThemePreference('light');
    expect(await getThemePreference(await requestWith(cookie))).toBe('light');
  });

  it('ignores a cookie it does not recognise', async () => {
    setNodeEnv('development');
    expect(await getThemePreference(await requestWith('theme=pink'))).toBe(
      'system',
    );
  });
});
