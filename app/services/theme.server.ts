import { createCookie } from '@remix-run/node';
import { isThemePreference, type ThemePreference } from '~/utils/theme';

const themeCookie = createCookie('theme', {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
});

export const getThemePreference = async (
  request: Request,
): Promise<ThemePreference> => {
  const value = await themeCookie.parse(request.headers.get('Cookie'));
  return isThemePreference(value) ? value : 'system';
};

export const serializeThemePreference = (preference: ThemePreference) =>
  themeCookie.serialize(preference);
