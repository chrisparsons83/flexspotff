import {
  buildFSquaredProfile,
  type FSquaredEntryRow,
  type FSquaredMember,
  type FSquaredTeamRow,
} from './fSquaredProfile';
import { describe, expect, it } from 'vitest';

const member = (id: string): FSquaredMember => ({
  id,
  discordName: id.toUpperCase(),
  discordUsername: id,
});

const DRAFTED = new Date('2024-08-01');
const NOW = new Date('2024-12-01');

const team = (
  id: string,
  manager: string | null,
  pointsFor: number,
  {
    year = 2024,
    league = 'Admiral',
    tier = 1,
    draftDateTime = DRAFTED as Date | null,
  } = {},
): FSquaredTeamRow => ({
  id,
  year,
  leagueId: `${league}-${year}`,
  leagueName: league,
  tier,
  draftDateTime,
  pointsFor,
  manager: manager ? member(manager) : null,
});

const entry = (
  entrant: string,
  teamIds: string[],
  year = 2024,
): FSquaredEntryRow => ({ year, entrant: member(entrant), teamIds });

// One four-team league: points 400, 300, 200, 100 - an average of 250.
const league = [
  team('t-a', 'a', 400),
  team('t-me', 'me', 300),
  team('t-b', 'b', 200),
  team('t-c', 'c', 100),
];

const build = (
  entries: FSquaredEntryRow[],
  teams: FSquaredTeamRow[] = league,
  inProgressYear: number | null = null,
) =>
  buildFSquaredProfile({
    userId: 'me',
    teams,
    entries,
    inProgressYear,
    now: NOW,
  });

describe('buildFSquaredSeasons', () => {
  it('measures each pick against its league', () => {
    const { seasons } = build([entry('me', ['t-a', 't-c'])]);
    const [best, worst] = seasons[0].picks;

    expect(best.leagueRank).toBe(1);
    expect(best.vsLeague).toBe(150);
    expect(worst.leagueRank).toBe(4);
    expect(worst.vsLeague).toBe(-150);
    expect(seasons[0].bestPick?.teamId).toBe('t-a');
    expect(seasons[0].worstPick?.teamId).toBe('t-c');
    expect(seasons[0].averagePickRank).toBe(2.5);
  });

  it('ranks the entry against the field, sharing ties', () => {
    const { seasons } = build([
      entry('me', ['t-a', 't-c']),
      entry('x', ['t-me', 't-b']),
      entry('y', ['t-a', 't-me']),
    ]);

    expect(seasons[0].total).toBe(500);
    expect(seasons[0].finish).toEqual({ rank: 2, fieldSize: 3 });
    expect(seasons[0].vsField).toBeCloseTo(500 - 1700 / 3);
    expect(seasons[0].champion).toBe(false);
  });

  it('counts the other entries that made the same pick', () => {
    const { seasons } = build([
      entry('me', ['t-a', 't-c']),
      entry('x', ['t-a', 't-b']),
      entry('y', ['t-a', 't-b']),
    ]);

    expect(seasons[0].picks.map(pick => pick.sharedBy)).toEqual([2, 0]);
  });

  it('marks a pick of their own team', () => {
    const { seasons, career } = build([entry('me', ['t-me', 't-a'])]);

    expect(seasons[0].pickedSelf).toBe(true);
    expect(seasons[0].picks.find(pick => pick.isSelf)?.teamId).toBe('t-me');
    expect(career?.selfPicks).toBe(1);
  });

  it('counts how many entries picked their team that year', () => {
    const { seasons } = build([
      entry('me', ['t-a', 't-c']),
      entry('x', ['t-me', 't-b']),
    ]);

    expect(seasons[0].timesPicked).toBe(1);
  });

  it('hides picks in leagues that have not drafted', () => {
    const teams = [
      ...league,
      team('p-1', 'a', 0, { league: 'Monarch', tier: 2, draftDateTime: null }),
      team('p-2', 'b', 0, {
        league: 'Monarch',
        tier: 2,
        draftDateTime: new Date('2025-01-01'),
      }),
    ];
    const { seasons } = build(
      [entry('me', ['t-a', 't-c', 'p-1', 'p-2'])],
      teams,
    );

    expect(seasons[0].picks.map(pick => pick.teamId)).toEqual(['t-a', 't-c']);
  });

  it('leaves out a season before any league has drafted', () => {
    const teams = [team('p-1', 'a', 0, { draftDateTime: null })];
    const profile = build([entry('me', ['p-1'])], teams);

    expect(profile.seasons).toEqual([]);
    expect(profile.career).toBeNull();
  });
});

describe('buildFSquaredCareer', () => {
  const teams = [
    ...league,
    team('u-a', 'a', 100, { year: 2025 }),
    team('u-me', 'me', 200, { year: 2025 }),
  ];
  const entries = [
    entry('me', ['t-a', 't-me']),
    entry('x', ['t-b', 't-c']),
    entry('me', ['u-me'], 2025),
    entry('x', ['u-a'], 2025),
  ];

  it('counts titles from finished seasons only', () => {
    const { career } = build(entries, teams, 2025);

    expect(career?.titles).toBe(1);
    expect(career?.completedSeasons).toBe(1);
    expect(career?.bestFinish).toEqual({ rank: 1, fieldSize: 2, year: 2024 });
    expect(career?.current).toEqual({ rank: 1, fieldSize: 2, year: 2025 });
  });

  it('gives no title to a tie at zero', () => {
    const zero = [team('z-1', 'a', 0), team('z-2', 'b', 0)];
    const { career } = build([entry('me', ['z-1']), entry('x', ['z-2'])], zero);

    expect(career?.titles).toBe(0);
    expect(career?.bestFinish?.rank).toBe(1);
  });

  it('scores pick quality across every season, the running one included', () => {
    const { career } = build(entries, teams, 2025);

    expect(career?.picks).toBe(3);
    expect(career?.averagePickRank).toBeCloseTo((1 + 2 + 1) / 3);
    expect(career?.bestPickEver?.teamId).toBe('t-a');
  });
});

describe('buildFavoriteManagers', () => {
  it('orders managers by picks, then how their picks finished', () => {
    const teams = [
      ...league,
      team('u-a', 'a', 50, { year: 2025 }),
      team('u-b', 'b', 150, { year: 2025 }),
      team('u-c', 'c', 100, { year: 2025 }),
    ];
    const { favoriteManagers } = build(
      [entry('me', ['t-b', 't-c']), entry('me', ['u-a', 'u-b'], 2025)],
      teams,
    );

    // a's one pick finished 3rd, c's 4th.
    expect(favoriteManagers.map(row => row.manager.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(favoriteManagers[0]).toMatchObject({
      picks: 2,
      years: [2024, 2025],
      averageRank: 2,
    });
  });
});

describe('buildPickedBy', () => {
  it('lists who picked their team and how it ranked for popularity', () => {
    const { pickedBy } = build([
      entry('x', ['t-me', 't-a']),
      entry('y', ['t-me', 't-b']),
      entry('z', ['t-a', 't-b']),
    ]);
    const [season] = pickedBy.seasons;

    expect(season.pickers.map(picker => picker.id)).toEqual(['x', 'y']);
    expect(season.fieldSize).toBe(3);
    expect(season.share).toBeCloseTo(2 / 3);
    // t-a, t-me and t-b were each picked twice.
    expect(season.popularityRank).toBe(1);
    expect(season.leagueRank).toBe(2);
  });

  it('shows a season nobody picked them, for a member who never entered', () => {
    const profile = build([entry('x', ['t-a', 't-b'])]);

    expect(profile.seasons).toEqual([]);
    expect(profile.pickedBy.seasons).toHaveLength(1);
    expect(profile.pickedBy.seasons[0].pickers).toEqual([]);
    expect(profile.pickedBy.seasons[0].popularityRank).toBe(3);
    expect(profile.pickedBy.timesPicked).toBe(0);
  });

  it('ranks their biggest fans, leaving themselves out', () => {
    const teams = [...league, team('u-me', 'me', 100, { year: 2025 })];
    const { pickedBy } = build(
      [
        entry('me', ['t-me']),
        entry('y', ['t-me']),
        entry('x', ['t-me']),
        entry('y', ['u-me'], 2025),
      ],
      teams,
    );

    expect(pickedBy.topFans.map(fan => [fan.member.id, fan.picks])).toEqual([
      ['y', 2],
      ['x', 1],
    ]);
    expect(pickedBy.topFans[0].years).toEqual([2024, 2025]);
    expect(pickedBy.timesPicked).toBe(4);
    expect(pickedBy.seasons[1].pickers.find(p => p.id === 'me')?.isSelf).toBe(
      true,
    );
  });

  it('hides teams in leagues that have not drafted', () => {
    const teams = [team('p-me', 'me', 0, { draftDateTime: null })];
    const { pickedBy } = build([entry('x', ['p-me'])], teams);

    expect(pickedBy.seasons).toEqual([]);
  });
});
