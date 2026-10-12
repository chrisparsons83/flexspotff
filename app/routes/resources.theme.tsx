import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import {
  isLightModeAvailable,
  serializeThemePreference,
} from '~/services/theme.server';
import { isThemePreference } from '~/utils/theme';

/** Only same-site paths, so this cannot be used to bounce visitors away. */
const safeRedirect = (to: FormDataEntryValue | null) =>
  typeof to === 'string' && to.startsWith('/') && !to.startsWith('//')
    ? to
    : '/';

const setTheme = async (
  theme: FormDataEntryValue | null,
  redirectTo: FormDataEntryValue | null,
) => {
  if (!isLightModeAvailable()) {
    throw new Response('Not found', { status: 404 });
  }
  if (!isThemePreference(theme)) {
    throw new Response('Unknown theme', { status: 400 });
  }
  return redirect(safeRedirect(redirectTo), {
    headers: { 'Set-Cookie': await serializeThemePreference(theme) },
  });
};

/** What the theme toggle posts to: `theme` and `redirectTo`. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  return setTheme(form.get('theme'), form.get('redirectTo'));
};

/**
 * Development only, until the toggle exists (#194): visit
 * /resources/theme?theme=light to switch, with an optional `redirectTo`.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const params = new URL(request.url).searchParams;
  return setTheme(params.get('theme'), params.get('redirectTo'));
};
