import { breadcrumbs, pageTitle, socialMeta } from './route-handle';
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

  it('gives every title the page’s path, not its own route’s', () => {
    const seen: string[] = [];
    pageTitle([
      {
        handle: {
          title: ({ pathname }: { pathname: string }) => {
            seen.push(pathname);
            return 'Admin';
          },
        },
        data: null,
        params: {},
        pathname: '/admin',
      },
      {
        handle: undefined,
        data: null,
        params: {},
        pathname: '/admin/members/merge',
      },
    ]);
    expect(seen).toEqual(['/admin/members/merge']);
  });
});

describe('socialMeta', () => {
  const content = (meta: ReturnType<typeof socialMeta>, key: string) =>
    meta.find(tag => ('property' in tag ? tag.property : tag.name) === key)
      ?.content;

  it('titles the page without the site’s name', () => {
    const meta = socialMeta(
      [match({ title: 'Leagues' }), match({ title: 'Standings' })],
      'https://www.flexspotff.com',
    );
    expect(content(meta, 'og:title')).toBe('Standings - Leagues');
  });

  it('titles a page with no name of its own as the site', () => {
    const meta = socialMeta([match(undefined)], 'https://www.flexspotff.com');
    expect(content(meta, 'og:title')).toBe('Flex Spot');
  });

  it('links to the page’s full address', () => {
    const meta = socialMeta(
      [
        { ...match({ title: 'Leagues' }), pathname: '/leagues' },
        { ...match(undefined), pathname: '/leagues/standings/2024' },
      ],
      'https://www.flexspotff.com/',
    );
    expect(content(meta, 'og:url')).toBe(
      'https://www.flexspotff.com/leagues/standings/2024',
    );
  });

  it('shows the share image from its full address, as a large card', () => {
    const meta = socialMeta([match(undefined)], 'https://www.flexspotff.com');
    expect(content(meta, 'og:image')).toBe(
      'https://www.flexspotff.com/social-preview.png',
    );
    expect(content(meta, 'og:image:width')).toBe('1200');
    expect(content(meta, 'og:image:height')).toBe('630');
    expect(content(meta, 'twitter:card')).toBe('summary_large_image');
  });

  it('names the site and says what it is', () => {
    const meta = socialMeta([match(undefined)], 'https://www.flexspotff.com');
    expect(content(meta, 'og:site_name')).toBe('Flex Spot');
    expect(content(meta, 'og:description')).toBe(
      'A fantasy football Discord, around since 2016. Promotion and relegation leagues with a cup across all of them, weekly games and a few side leagues.',
    );
  });
});

describe('breadcrumbs', () => {
  const sections = [
    { label: 'Leagues', to: '/leagues' },
    { label: 'Games', to: '/games' },
  ];
  const at = (pathname: string, handle?: unknown, data: unknown = null) => ({
    handle,
    data,
    params: { year: '2026', week: '7' },
    pathname,
  });

  it('starts at the section and links each named level', () => {
    expect(
      breadcrumbs(
        [
          at('/'),
          at('/games/qb-streaming', { title: 'QB streaming' }),
          at('/games/qb-streaming/standings/2026', {
            title: ({ params }: { params: { year: string } }) =>
              `${params.year} standings`,
          }),
          at('/games/qb-streaming/standings/2026/7', {
            title: ({ params }: { params: { week: string } }) =>
              `Week ${params.week}`,
          }),
        ],
        sections,
      ),
    ).toEqual([
      { label: 'Games', to: '/games' },
      { label: 'QB streaming', to: '/games/qb-streaming' },
      { label: '2026 standings', to: '/games/qb-streaming/standings/2026' },
      { label: 'Week 7', to: '/games/qb-streaming/standings/2026/7' },
    ]);
  });

  it('lets a layout name its index page', () => {
    expect(
      breadcrumbs(
        [
          at('/'),
          at('/leagues', { title: 'Leagues' }),
          at('/leagues/', undefined),
        ],
        sections,
      ),
    ).toEqual([{ label: 'Leagues', to: '/leagues' }]);
  });

  it('skips a level whose name cannot be read', () => {
    expect(
      breadcrumbs(
        [
          at('/'),
          at('/leagues/2026/premier', {
            title: ({ data }: { data: { league: { name: string } } }) =>
              data.league.name,
          }),
          at('/leagues/2026/premier/draft', { title: 'Draft' }),
        ],
        sections,
      ),
    ).toEqual([
      { label: 'Leagues', to: '/leagues' },
      { label: 'Draft', to: '/leagues/2026/premier/draft' },
    ]);
  });

  it('is empty outside the sections', () => {
    expect(
      breadcrumbs([at('/'), at('/u/someone', { title: 'Someone' })], sections),
    ).toEqual([]);
  });
});
