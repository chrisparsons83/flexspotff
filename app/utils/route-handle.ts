import type { Params } from '@remix-run/react';
import { useMatches } from '@remix-run/react';
import type { UseDataFunctionReturn } from 'remix-typedjson';

/** What a title can be read from: the URL, and the route's own loader data. */
export type TitleArgs = {
  params: Params;
  pathname: string;
  /** The route's loader data, as JSON. Missing when the loader threw. */
  data: unknown;
};

/** What a route can tell the shell about itself, through its `handle`. */
export type RouteHandle = {
  /** `full` gives the page the whole width, for the draft boards. */
  width?: 'contained' | 'full';
  /**
   * The route's name in the browser tab. A layout names its section and each
   * page beneath it names itself, so the tab reads "Standings - Leagues". A
   * function that returns nothing leaves the route out.
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

/**
 * The browser tab's title: every route's name from the deepest out, then the
 * site's, skipping a name its parent already gave.
 */
export const pageTitle = (matches: TitleMatch[]): string => {
  const names: string[] = [];
  for (const match of [...matches].reverse()) {
    if (!isRouteHandle(match.handle) || !match.handle.title) continue;
    const { title } = match.handle;
    let name: string | null | undefined;
    try {
      name = typeof title === 'string' ? title : title(match);
    } catch {
      // A title read off data the loader never sent is no title at all.
      name = null;
    }
    if (name && name !== names[names.length - 1]) names.push(name);
  }
  return [...names, SITE_NAME].join(' - ');
};

/**
 * A title function's loader data, typed by the loader. Every field may be
 * missing: the loader may have thrown, and the data is JSON, not the loader's
 * own types.
 */
export const dataOf = <Loader>(data: unknown) =>
  data as Partial<UseDataFunctionReturn<Loader>> | undefined;
