import { useEffect } from 'react';

/**
 * What a visitor has chosen. `system` follows the OS; dark is the default
 * whenever nothing else applies.
 */
export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const isThemePreference = (value: unknown): value is ThemePreference =>
  THEME_PREFERENCES.includes(value as ThemePreference);

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Runs in <head> before the page paints when the preference is `system`. The
 * server cannot see the OS setting, so it renders dark and this removes the
 * class for a light OS. Following later changes is useThemeClass's job.
 */
export const SYSTEM_THEME_SCRIPT = `document.documentElement.classList.toggle('dark', matchMedia('${DARK_QUERY}').matches);`;

/**
 * Keeps the `dark` class in step with the preference after hydration. React
 * cannot do this through className alone: the system script changes the
 * class behind its back, and a script added during client navigation never
 * runs.
 */
export const useThemeClass = (preference: ThemePreference) => {
  useEffect(() => {
    const root = document.documentElement;
    if (preference !== 'system') {
      root.classList.toggle('dark', preference === 'dark');
      return;
    }
    const query = matchMedia(DARK_QUERY);
    const apply = () => root.classList.toggle('dark', query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preference]);
};
