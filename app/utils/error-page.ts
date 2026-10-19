import { isRouteErrorResponse } from '@remix-run/react';

/** Loader messages that say no more than the title already does. */
const GENERIC = /^(?:not found|forbidden|error: .*)$/i;

/**
 * What the error page says about an error: a title, and a sentence on what
 * went wrong. A loader's own message wins where it says what is missing
 * ("League not found"); Remix's are replaced with plain words.
 */
export function errorPage(error: unknown): {
  title: string;
  message: string;
  /** The error's own text, for whoever is debugging. */
  detail?: string;
} {
  if (isRouteErrorResponse(error)) {
    const data =
      typeof error.data === 'string' && !GENERIC.test(error.data.trim())
        ? sentence(error.data)
        : null;
    if (error.status === 404) {
      return {
        title: 'Page not found',
        message: data ?? 'There is no page at this address.',
      };
    }
    if (error.status === 403) {
      return {
        title: 'No access',
        message: data ?? 'Your account cannot open this page.',
      };
    }
    if (error.status < 500) {
      return {
        title: 'That did not work',
        message: data ?? 'The site could not handle that request.',
      };
    }
  }
  return {
    title: 'Something went wrong',
    message:
      'The site hit an error loading this page. Try again in a minute, and if it keeps happening, say so in the Discord.',
    // Remix replaces a server error's text with its own in production.
    detail:
      error instanceof Error && error.message !== 'Unexpected Server Error'
        ? error.message
        : undefined,
  };
}

/** Ends a loader's message with a full stop, as the page's copy does. */
const sentence = (text: string) =>
  /[.?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
