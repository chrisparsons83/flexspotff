const BASE = 'http://localhost';

/**
 * A path on this site to send the visitor back to, or `/`. Parsing it as a
 * URL catches what browsers quietly normalise into another host, such as
 * `/\evil.com` or a tab inside `//`.
 */
export const safeRedirect = (to: FormDataEntryValue | null) => {
  if (typeof to !== 'string' || !to.startsWith('/')) return '/';
  try {
    const url = new URL(to, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
};
