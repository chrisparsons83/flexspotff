import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { serializeThemePreference } from '~/services/theme.server';
import { safeRedirect } from '~/utils/safeRedirect';
import { isThemePreference } from '~/utils/theme';

const setTheme = async (
  theme: FormDataEntryValue | null,
  redirectTo: FormDataEntryValue | null,
) => {
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
 * A shortcut for development: visit /resources/theme?theme=light to switch,
 * with an optional `redirectTo`. It stays development only, because a GET
 * that sets a cookie can be triggered by prefetching or by another site.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Response('Not found', { status: 404 });
  }
  const params = new URL(request.url).searchParams;
  return setTheme(params.get('theme'), params.get('redirectTo'));
};
