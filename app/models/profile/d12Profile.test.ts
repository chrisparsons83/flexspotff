import {
  buildD12Career,
  buildD12DraftBoard,
  buildD12Exposure,
  buildD12Seasons,
  pickPosition,
  shortD12LeagueName,
  slotForPick,
  type D12BoardColumn,
  type D12BoardPick,
  type D12ScoreRow,
} from './d12Profile';
import { describe, expect, it } from 'vitest';

const row = (overrides: Partial<D12ScoreRow>): D12ScoreRow => ({
  year: 2025,
  week: 1,
  points: 100,
  leagueId: 'v1',
  leagueName: 'The D12 v1',
  starters: [],
  startingPlayerPoints: [],
  ...overrides,
});

describe('shortD12LeagueName', () => {
  it('drops the shared prefix', () => {
    expect(shortD12LeagueName('The D12 v7')).toBe('v7');
    expect(shortD12LeagueName('Something else')).toBe('Something else');
  });
});

describe('pick positions', () => {
  it('splits an overall pick into round and pick', () => {
    expect(pickPosition(1, 12)).toEqual({ round: 1, inRound: 1 });
    expect(pickPosition(12, 12)).toEqual({ round: 1, inRound: 12 });
    expect(pickPosition(31, 12)).toEqual({ round: 3, inRound: 7 });
  });

  it('reads the slot back through the snake', () => {
    expect(slotForPick(5, 12)).toBe(5);
    // Round 2 runs backwards: pick 13 belongs to slot 12.
    expect(slotForPick(13, 12)).toBe(12);
    expect(slotForPick(20, 12)).toBe(5);
  });
});

describe('buildD12Seasons', () => {
  const rows = [
    row({ week: 1, points: 100, leagueId: 'v1', leagueName: 'The D12 v1' }),
    row({ week: 1, points: 50, leagueId: 'v2', leagueName: 'The D12 v2' }),
    row({ week: 2, points: 70, leagueId: 'v1', leagueName: 'The D12 v1' }),
    row({ week: 2, points: 130, leagueId: 'v2', leagueName: 'The D12 v2' }),
  ];

  it('keeps combined weeks and single-team weeks apart', () => {
    const [season] = buildD12Seasons({
      rows,
      finishes: new Map([[2025, { rank: 2, fieldSize: 12 }]]),
      inProgressYear: null,
      newestWeekInProgress: null,
    });

    expect(season.total).toBe(350);
    expect(season.finish).toEqual({ rank: 2, fieldSize: 12 });
    // Combined: week 1 = 150, week 2 = 200.
    expect(season.bestWeek).toEqual({ points: 200, year: 2025, week: 2 });
    expect(season.worstWeek).toEqual({ points: 150, year: 2025, week: 1 });
    expect(season.averageWeek).toBe(175);
    // Single team: v2 week 2 is best, v2 week 1 worst.
    expect(season.bestTeamWeek).toMatchObject({ points: 130, week: 2 });
    expect(season.worstTeamWeek).toMatchObject({
      points: 50,
      leagueName: 'The D12 v2',
    });
    expect(season.bestTeam).toMatchObject({
      points: 180,
      leagueName: 'The D12 v2',
    });
    expect(season.worstTeam).toMatchObject({
      points: 170,
      leagueName: 'The D12 v1',
    });
    expect(season.averageTeam).toBe(175);
  });

  it('leaves the live week out of the running season, but not its total', () => {
    const [season] = buildD12Seasons({
      rows: [...rows, row({ week: 3, points: 2, leagueId: 'v1' })],
      finishes: new Map(),
      inProgressYear: 2025,
      newestWeekInProgress: 3,
    });

    expect(season.inProgress).toBe(true);
    expect(season.total).toBe(352);
    expect(season.worstWeek?.week).toBe(1);
    expect(season.worstTeamWeek?.points).toBe(50);
  });

  it('skips unscored rows', () => {
    const [season] = buildD12Seasons({
      rows: [row({ points: null }), row({ week: 2, points: 80 })],
      finishes: new Map(),
      inProgressYear: null,
      newestWeekInProgress: null,
    });
    expect(season.weeksCounted).toBe(1);
    expect(season.worstWeek?.points).toBe(80);
  });
});

describe('buildD12Career', () => {
  const seasons = buildD12Seasons({
    rows: [
      row({ year: 2024, week: 1, points: 200 }),
      row({ year: 2024, week: 2, points: 100 }),
      row({ year: 2025, week: 1, points: 300 }),
      row({ year: 2025, week: 2, points: 60 }),
      row({ year: 2026, week: 1, points: 500 }),
      row({ year: 2026, week: 2, points: 10 }),
    ],
    finishes: new Map([
      [2024, { rank: 1, fieldSize: 12 }],
      [2025, { rank: 4, fieldSize: 12 }],
      [2026, { rank: 1, fieldSize: 12 }],
    ]),
    inProgressYear: 2026,
    newestWeekInProgress: 2,
  });
  const career = buildD12Career(seasons);

  it('counts finished weeks from the running season', () => {
    expect(career.bestWeek).toEqual({ points: 500, year: 2026, week: 1 });
    expect(career.worstWeek).toEqual({ points: 60, year: 2025, week: 2 });
    // 200, 100, 300, 60, 500 - the live week of 10 is left out.
    expect(career.averageWeek).toBe(232);
  });

  it('only ranks team seasons and finishes once a season is over', () => {
    expect(career.bestTeam).toMatchObject({ points: 360, year: 2025 });
    expect(career.worstTeam).toMatchObject({ points: 300, year: 2024 });
    expect(career.titles).toBe(1);
    expect(career.topThrees).toBe(1);
    expect(career.averageFinish).toBe(2.5);
    expect(career.bestFinish).toEqual({ rank: 1, fieldSize: 12, year: 2024 });
    expect(career.current).toEqual({ rank: 1, fieldSize: 12, year: 2026 });
  });
});

describe('buildD12DraftBoard', () => {
  const players = new Map([
    [
      'a',
      { firstName: 'Al', lastName: 'Alpha', position: 'RB', nflTeam: 'ATL' },
    ],
    [
      'b',
      { firstName: 'Bo', lastName: 'Beta', position: 'WR', nflTeam: 'BUF' },
    ],
    [
      'c',
      { firstName: 'Cy', lastName: 'Gamma', position: 'QB', nflTeam: 'CIN' },
    ],
    [
      'd',
      { firstName: 'Di', lastName: 'Delta', position: 'TE', nflTeam: 'DAL' },
    ],
  ]);

  const board = buildD12DraftBoard({
    year: 2025,
    leagues: [
      { id: 'v1', name: 'The D12 v1' },
      { id: 'v2', name: 'The D12 v2' },
      { id: 'v3', name: 'The D12 v3' },
    ],
    picks: [
      // v1 from slot 3: picks 3 and 22.
      { leagueId: 'v1', pickNo: 22, sleeperId: 'b' },
      { leagueId: 'v1', pickNo: 3, sleeperId: 'a' },
      // v2 from slot 12: picks 12 and 13.
      { leagueId: 'v2', pickNo: 12, sleeperId: 'c' },
      { leagueId: 'v2', pickNo: 13, sleeperId: 'd' },
      // v3 has no lineups yet.
      { leagueId: 'v3', pickNo: 1, sleeperId: 'a' },
    ],
    rows: [
      row({
        leagueId: 'v1',
        points: 40,
        starters: ['a', 'b'],
        startingPlayerPoints: [30, 10],
      }),
      row({
        leagueId: 'v1',
        week: 2,
        points: 20,
        starters: ['a'],
        startingPlayerPoints: [20],
      }),
      row({
        leagueId: 'v2',
        points: 5,
        starters: ['c'],
        startingPlayerPoints: [5],
      }),
      row({ leagueId: 'v3', points: 90 }),
    ],
    players,
  });

  it('puts each league in the column for its slot, and fills the rest', () => {
    expect(board.columns).toHaveLength(12);
    expect(board.rounds).toBe(2);
    expect(board.columns[0].league?.shortName).toBe('v3');
    expect(board.columns[2].league?.id).toBe('v1');
    expect(board.columns[11].league?.id).toBe('v2');
    expect(board.columns[5]).toEqual({
      slot: 6,
      league: null,
      teamPoints: null,
      picks: [],
    });
    expect(board.columns[2].teamPoints).toBe(60);
  });

  it('labels picks by round', () => {
    expect(board.columns[2].picks.map(pick => pick.pickLabel)).toEqual([
      '1.03',
      '2.10',
    ]);
    expect(board.columns[11].picks.map(pick => pick.pickLabel)).toEqual([
      '1.12',
      '2.01',
    ]);
  });

  it('adds up starter points and ranks them into heat', () => {
    const [alpha, beta] = board.columns[2].picks;
    const [gamma, delta] = board.columns[11].picks;
    expect(alpha.points).toBe(50);
    expect(beta.points).toBe(10);
    expect(gamma.points).toBe(5);
    // Drafted, lineups exist, never started.
    expect(delta).toMatchObject({ points: 0, heat: 'bust' });
    // Scorers 5, 10, 50: lowest to highest.
    expect(gamma.heat).toBe(1);
    expect(beta.heat).toBe(3);
    expect(alpha.heat).toBe(5);
  });

  it('keeps a second league on the same slot as an extra column', () => {
    const clash = buildD12DraftBoard({
      year: 2025,
      leagues: [
        { id: 'v1', name: 'The D12 v1' },
        { id: 'v2', name: 'The D12 v2' },
      ],
      picks: [
        { leagueId: 'v1', pickNo: 3, sleeperId: 'a' },
        { leagueId: 'v2', pickNo: 3, sleeperId: 'b' },
      ],
      rows: [],
      players,
    });
    expect(clash.columns).toHaveLength(13);
    expect(clash.columns[2].league?.id).toBe('v1');
    expect(clash.columns[12]).toMatchObject({ slot: 3, league: { id: 'v2' } });
  });

  it('leaves heat off a league with no lineups', () => {
    const [pick] = board.columns[0].picks;
    expect(pick).toMatchObject({ points: null, heat: 'none' });
  });
});

describe('buildD12Exposure', () => {
  const pick = (
    sleeperId: string,
    pickNo: number,
    points: number | null,
  ): D12BoardPick => ({
    round: 1,
    pickNo,
    pickLabel: '',
    sleeperId,
    firstName: 'F',
    lastName: sleeperId,
    position: 'RB',
    nflTeam: 'ATL',
    points,
    heat: 'none',
  });
  const column = (slot: number, picks: D12BoardPick[]): D12BoardColumn => ({
    slot,
    league: { id: `v${slot}`, name: `The D12 v${slot}`, shortName: `v${slot}` },
    teamPoints: null,
    picks,
  });

  const exposure = buildD12Exposure({
    year: 2025,
    rounds: 2,
    columns: [
      column(1, [pick('a', 1, 10), pick('b', 24, null)]),
      column(2, [pick('a', 2, 5), pick('c', 23, 1)]),
      column(3, [pick('c', 3, 2)]),
      { slot: 4, league: null, teamPoints: null, picks: [] },
    ],
  });

  it('counts only columns with a team', () => {
    expect(exposure.teams).toBe(3);
  });

  it('groups by player, most owned then earliest drafted', () => {
    expect(exposure.players.map(p => p.sleeperId)).toEqual(['a', 'c', 'b']);
    expect(exposure.players[0]).toMatchObject({
      leagues: 2,
      averagePick: 1.5,
      earliestPick: 1,
      latestPick: 2,
      points: 15,
    });
    expect(exposure.players[1]).toMatchObject({
      averagePick: 13,
      points: 3,
    });
    expect(exposure.players[2].points).toBeNull();
  });
});
