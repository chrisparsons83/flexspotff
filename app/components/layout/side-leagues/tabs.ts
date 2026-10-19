import type { SubNavItem } from '~/components/ui/sub-nav';

/**
 * Every side league shares one shape (Standings, Weeks, Draft, Waivers,
 * History), leaving out the tabs it has no page for.
 */

const GUILLOTINE = '/side-leagues/guillotine';
const D12 = '/side-leagues/d12';
const BEST_BALL = '/side-leagues/best-ball';

export const guillotineTabs = (
  league: { id: string; currentWeek: number } | null,
): SubNavItem[] => [
  ...(league
    ? [
        { label: 'Standings', to: `${GUILLOTINE}/${league.id}`, end: true },
        {
          label: 'Weeks',
          to: `${GUILLOTINE}/${league.id}/week/${league.currentWeek}`,
          match: `${GUILLOTINE}/${league.id}/week`,
        },
        { label: 'Draft', to: `${GUILLOTINE}/${league.id}/draft` },
        { label: 'Waivers', to: `${GUILLOTINE}/${league.id}/waivers` },
      ]
    : []),
  { label: 'History', to: GUILLOTINE, end: true },
];

export const d12Tabs = (
  season: { year: number; week: number | null } | null,
): SubNavItem[] => [
  ...(season
    ? [
        { label: 'Standings', to: `${D12}/${season.year}`, end: true },
        ...(season.week
          ? [
              {
                label: 'Weeks',
                to: `${D12}/${season.year}/${season.week}`,
                // Any week of the season, but not its member pages.
                match: new RegExp(`^${D12}/${season.year}/\\d+$`),
              },
            ]
          : []),
        { label: 'ADP', to: `${D12}/adp/${season.year}` },
      ]
    : []),
  { label: 'History', to: D12, end: true },
];

export const bestBallTabs = (year: number | null): SubNavItem[] => [
  ...(year
    ? [
        { label: 'Standings', to: `${BEST_BALL}/${year}`, end: true },
        { label: 'Draft', to: `${BEST_BALL}/${year}/draft` },
      ]
    : []),
  { label: 'History', to: BEST_BALL, end: true },
];
