import type { Params } from '@remix-run/react';
import { useMatches } from '@remix-run/react';
import type { UseDataFunctionReturn } from 'remix-typedjson';

/** What a title can be read from: the URL, and the route's own loader data. */
export type TitleArgs = {
  params: Params;
  /** The page's path, the same for every route on it. */
  pathname: string;
  /** The route's loader data, as JSON. Missing when the loader threw. */
  data: unknown;
};

/** What a route can tell the shell about itself, through its `handle`. */
export type RouteHandle = {
  /** `full` gives the page the whole width, for the draft boards. */
  width?: 'contained' | 'full';
  /**
   * The route's name, in the browser tab and as its level of the breadcrumb.
   * A layout names its section and each page beneath it names itself, so the
   * tab reads "Standings - Leagues". Keep it short enough to read in a trail.
   * A function that returns nothing leaves the route out.
   */
  title?: string | ((args: TitleArgs) => string | null | undefined);
};

export const SITE_NAME = 'Flex Spot';

const isRouteHandle = (handle: unknown): handle is RouteHandle =>
  typeof handle === 'object' && handle !== null;

/** The deepest route that sets a width decides it. */
export const usePageWidth = (): 'contained' | 'full' => {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const { handle } = matches[i];
    if (isRouteHandle(handle) && handle.width) return handle.width;
  }
  return 'contained';
};

type TitleMatch = {
  handle?: unknown;
  params: Params;
  pathname: string;
  data: unknown;
};

/** A route's name, given the page's path. Missing when it has none. */
const routeName = (match: TitleMatch, pathname: string) => {
  if (!isRouteHandle(match.handle) || !match.handle.title) return null;
  const { title } = match.handle;
  try {
    return typeof title === 'string' ? title : title({ ...match, pathname });
  } catch {
    // A title read off data the loader never sent is no title at all.
    return null;
  }
};

/**
 * The page's path. A match's own pathname is only the part of the URL it
 * matched, so the deepest match has the whole of it.
 */
const pagePath = (matches: TitleMatch[]) => matches.at(-1)?.pathname ?? '/';

/** Every route's name from the deepest out, skipping one its parent gave. */
const pageNames = (matches: TitleMatch[]): string[] => {
  const names: string[] = [];
  const pathname = pagePath(matches);
  for (const match of [...matches].reverse()) {
    const name = routeName(match, pathname);
    if (name && name !== names[names.length - 1]) names.push(name);
  }
  return names;
};

/** One level of the breadcrumb, or a section of the main nav. */
export type Crumb = { label: string; to: string };

const withoutTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, '') : path;

/**
 * The way down to this page, outermost first: its section of the main nav,
 * then every route that names itself, each linked to the page at its path.
 * A route at the same path as the one above it adds nothing, so an index
 * page is named by its layout. Empty outside the given sections.
 */
export const breadcrumbs = (
  matches: TitleMatch[],
  sections: readonly Crumb[],
): Crumb[] => {
  const pathname = withoutTrailingSlash(pagePath(matches));
  const section = sections.find(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`),
  );
  if (!section) return [];
  const crumbs: Crumb[] = [{ label: section.label, to: section.to }];
  for (const match of matches) {
    const to = withoutTrailingSlash(match.pathname);
    const last = crumbs[crumbs.length - 1];
    if (to === last.to || !to.startsWith(`${section.to}/`)) continue;
    const label = routeName(match, pathname);
    if (label && label !== last.label) crumbs.push({ label, to });
  }
  return crumbs;
};

/** The browser tab's title: the page's names, then the site's. */
export const pageTitle = (matches: TitleMatch[]): string =>
  [...pageNames(matches), SITE_NAME].join(' - ');

/** What every link preview says the site is, from the home page. */
const SITE_DESCRIPTION =
  'A fantasy football Discord, around since 2016. Promotion and relegation leagues with a cup across all of them, weekly games and a few side leagues.';

/** The one image every link preview shows, in public/. */
export const SOCIAL_IMAGE = {
  path: '/social-preview.png',
  width: 1200,
  height: 630,
};

type SocialTag =
  | { property: string; content: string }
  | { name: string; content: string };

/**
 * The tags a link preview reads, in Discord and elsewhere. The site's name
 * has a tag of its own, so the title is the page's alone.
 */
export const socialMeta = (
  matches: TitleMatch[],
  origin: string,
): SocialTag[] => [
  {
    property: 'og:title',
    content: pageNames(matches).join(' - ') || SITE_NAME,
  },
  { property: 'og:site_name', content: SITE_NAME },
  { property: 'og:description', content: SITE_DESCRIPTION },
  {
    property: 'og:url',
    content: new URL(pagePath(matches), origin).href,
  },
  {
    property: 'og:image',
    content: new URL(SOCIAL_IMAGE.path, origin).href,
  },
  { property: 'og:image:width', content: String(SOCIAL_IMAGE.width) },
  { property: 'og:image:height', content: String(SOCIAL_IMAGE.height) },
  { name: 'twitter:card', content: 'summary_large_image' },
];

/**
 * A title function's loader data, typed by the loader. Every field may be
 * missing: the loader may have thrown, and the data is JSON, not the loader's
 * own types.
 */
export const dataOf = <Loader>(data: unknown) =>
  data as Partial<UseDataFunctionReturn<Loader>> | undefined;
