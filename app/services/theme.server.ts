import { createCookie } from '@remix-run/node';
import { isThemePreference, type ThemePreference } from '~/utils/theme';

const themeCookie = createCookie('theme', {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
});

/**
 * Light mode is only reachable in development until every route reads its
 * colours from the tokens. Turning it on for everyone is #197.
 */
export const isLightModeAvailable = () =>
  process.env.NODE_ENV === 'development';

export const getThemePreference = async (
  request: Request,
): Promise<ThemePreference> => {
  if (!isLightModeAvailable()) return 'dark';
  const value = await themeCookie.parse(request.headers.get('Cookie'));
  return isThemePreference(value) ? value : 'system';
};

export const serializeThemePreference = (preference: ThemePreference) =>
  themeCookie.serialize(preference);
