/**
 * What a visitor has chosen. `system` follows the OS; dark is the default
 * whenever nothing else applies.
 */
export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const isThemePreference = (value: unknown): value is ThemePreference =>
  THEME_PREFERENCES.includes(value as ThemePreference);

/**
 * Runs in <head> before the page paints when the preference is `system`. The
 * server cannot see the OS setting, so it renders dark and this removes the
 * class for a light OS, then keeps following it if the OS changes.
 */
export const SYSTEM_THEME_SCRIPT = `(() => {
  const query = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', query.matches);
  apply();
  query.addEventListener('change', apply);
})();`;
