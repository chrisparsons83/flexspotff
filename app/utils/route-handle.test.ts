import { pageTitle } from './route-handle';
import { describe, expect, it } from 'vitest';

const match = (handle: unknown, data: unknown = null) => ({
  handle,
  data,
  params: { year: '2024' },
  pathname: '/',
});

describe('pageTitle', () => {
  it('names the site alone when no route names itself', () => {
    expect(pageTitle([match(undefined)])).toBe('Flex Spot');
  });

  it('reads from the deepest route out', () => {
    expect(
      pageTitle([
        match(undefined),
        match({ title: 'Leagues' }),
        match({
          title: ({ params }: { params: { year: string } }) =>
            `${params.year} standings`,
        }),
      ]),
    ).toBe('2024 standings - Leagues - Flex Spot');
  });

  it('skips a name its parent already gave', () => {
    expect(
      pageTitle([match({ title: 'Survivor' }), match({ title: 'Survivor' })]),
    ).toBe('Survivor - Flex Spot');
  });

  it('leaves out a route whose title cannot be read', () => {
    expect(
      pageTitle([
        match({ title: 'Guillotine' }),
        match({
          title: ({ data }: { data: { league: { name: string } } }) =>
            data.league.name,
        }),
        match({ title: () => null }),
      ]),
    ).toBe('Guillotine - Flex Spot');
  });
});
