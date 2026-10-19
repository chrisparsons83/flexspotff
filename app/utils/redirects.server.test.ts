import { redirectPrefix } from './redirects.server';
import { describe, expect, it } from 'vitest';

const run = (path: string) => {
  try {
    redirectPrefix(
      new Request(`http://test${path}`),
      '/games/guillotine',
      '/side-leagues/guillotine',
    );
  } catch (thrown) {
    return thrown as Response;
  }
  throw new Error('Expected a redirect');
};

describe('redirectPrefix', () => {
  it('moves the section and keeps the rest of the path', () => {
    const response = run('/games/guillotine/12/week/3');
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(
      '/side-leagues/guillotine/12/week/3',
    );
  });

  it('moves the section landing page', () => {
    expect(run('/games/guillotine').headers.get('Location')).toBe(
      '/side-leagues/guillotine',
    );
  });

  it('keeps the query string', () => {
    expect(run('/games/guillotine/12?week=4').headers.get('Location')).toBe(
      '/side-leagues/guillotine/12?week=4',
    );
  });
});
