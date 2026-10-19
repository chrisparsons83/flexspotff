import { useMatches } from '@remix-run/react';

/** What a route can tell the shell about itself, through its `handle`. */
export type RouteHandle = {
  /** `full` gives the page the whole width, for the draft boards. */
  width?: 'contained' | 'full';
};

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
