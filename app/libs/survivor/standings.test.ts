import {
  isPoolDecided,
  legWeek,
  poolStartWeek,
  rankEntries,
  readSleeperEntry,
  survivedWeek,
} from './standings';
import yahooHistory from './yahoo-history.json';

describe('legWeek', () => {
  it('reads the week from a regular-season leg', () => {
    expect(legWeek('v1:regular:5')).toBe(5);
    expect(legWeek('v1:regular:18')).toBe(18);
  });

  it('ignores anything else', () => {
    expect(legWeek('v1:post:1')).toBeNull();
    expect(legWeek('5')).toBeNull();
  });
});

describe('readSleeperEntry', () => {
  // Trimmed from real rosters in the 2024, 2025 and 2026 pools.
  it('reads a 2025 roster that lost', () => {
    expect(
      readSleeperEntry({
        is_eliminated: 'true',
        lost_leg_ids: ['v1:regular:3'],
        previous_picks: {
          'v1:regular:1': ['DEN'],
          'v1:regular:2': ['ARI'],
          'v1:regular:3': ['TB'],
          'v1:regular:4': [],
        },
        points_by_leg: {
          'v1:regular:1': 1,
          'v1:regular:2': 1,
          'v1:regular:3': 0,
          'v1:regular:4': 0,
        },
      }),
    ).toEqual({
      eliminatedWeek: 3,
      picks: [
        { week: 1, team: 'DEN', result: 'WIN' },
        { week: 2, team: 'ARI', result: 'WIN' },
        { week: 3, team: 'TB', result: 'LOSS' },
      ],
    });
  });

  it('reads a 2024 roster, which records the week it went out differently', () => {
    expect(
      readSleeperEntry({
        is_eliminated: 'true',
        eliminated_leg_id: 'v1:regular:2',
        previous_picks: { 'v1:regular:1': ['SF'], 'v1:regular:2': ['KC'] },
        points_by_leg: { 'v1:regular:1': 1, 'v1:regular:2': 0 },
      }).eliminatedWeek,
    ).toBe(2);
  });

  it('treats a week with no pick as the week a roster went out', () => {
    const entry = readSleeperEntry({
      is_eliminated: 'true',
      lost_leg_ids: ['v1:regular:4'],
      previous_picks: {
        'v1:regular:1': ['BUF'],
        'v1:regular:2': ['DET'],
        'v1:regular:3': ['PHI'],
        'v1:regular:4': [],
      },
      points_by_leg: {
        'v1:regular:1': 1,
        'v1:regular:2': 1,
        'v1:regular:3': 1,
      },
    });
    expect(entry.eliminatedWeek).toBe(4);
    expect(entry.picks.map(pick => pick.result)).toEqual(['WIN', 'WIN', 'WIN']);
  });

  it('works out the missed week when Sleeper has not said', () => {
    expect(
      readSleeperEntry({
        is_eliminated: 'true',
        previous_picks: { 'v1:regular:1': ['BAL'] },
        points_by_leg: { 'v1:regular:1': 1 },
      }).eliminatedWeek,
    ).toBe(2);
  });

  it('leaves a live pick pending', () => {
    expect(
      readSleeperEntry({
        is_eliminated: 'false',
        lost_leg_ids: [],
        previous_picks: { 'v1:regular:4': ['BAL'], 'v1:regular:5': ['MIN'] },
        points_by_leg: { 'v1:regular:4': 1, 'v1:regular:5': 0 },
      }),
    ).toEqual({
      eliminatedWeek: null,
      picks: [
        { week: 4, team: 'BAL', result: 'WIN' },
        { week: 5, team: 'MIN', result: 'PENDING' },
      ],
    });
  });

  it('counts a pick that did not win as a loss once the pool is over', () => {
    // The 2025 winner: Dallas lost in week 18, and Sleeper left him alive.
    expect(
      readSleeperEntry(
        {
          is_eliminated: 'false',
          lost_leg_ids: [],
          previous_picks: {
            'v1:regular:17': ['JAX'],
            'v1:regular:18': ['DAL'],
          },
          points_by_leg: { 'v1:regular:17': 1, 'v1:regular:18': 0 },
        },
        { poolIsOver: true },
      ),
    ).toEqual({
      eliminatedWeek: null,
      picks: [
        { week: 17, team: 'JAX', result: 'WIN' },
        { week: 18, team: 'DAL', result: 'LOSS' },
      ],
    });
  });

  it('copes with a roster that carries no metadata', () => {
    expect(readSleeperEntry(null)).toEqual({ eliminatedWeek: null, picks: [] });
  });
});

describe('survivedWeek', () => {
  it('is the last week with a winning pick', () => {
    expect(
      survivedWeek([
        { week: 5, team: 'NE', result: 'WIN' },
        { week: 6, team: 'GB', result: 'WIN' },
        { week: 7, team: 'LAR', result: 'LOSS' },
      ]),
    ).toBe(6);
  });

  it('is 0 for an entry that never won a pick', () => {
    expect(survivedWeek([{ week: 1, team: 'NE', result: 'LOSS' }])).toBe(0);
    expect(survivedWeek([])).toBe(0);
  });
});

describe('isPoolDecided', () => {
  const out = (week: number) => ({
    eliminatedWeek: week,
    picks: [{ week, team: 'NYJ', result: 'LOSS' as const }],
  });
  const alive = (lastWin: number, pending = false) => ({
    eliminatedWeek: null,
    picks: [
      { week: lastWin, team: 'KC', result: 'WIN' as const },
      ...(pending
        ? [{ week: lastWin + 1, team: 'BUF', result: 'PENDING' as const }]
        : []),
    ],
  });

  it('is decided once the source says the pool is over', () => {
    expect(
      isPoolDecided({ sourceComplete: true, entries: [alive(3), alive(3)] }),
    ).toBe(true);
  });

  it('is decided once everyone is out', () => {
    expect(
      isPoolDecided({ sourceComplete: false, entries: [out(3), out(4)] }),
    ).toBe(true);
  });

  it('is decided when the last one standing won the week the rest went out', () => {
    expect(
      isPoolDecided({ sourceComplete: false, entries: [alive(5), out(5)] }),
    ).toBe(true);
  });

  it('waits while the last one standing has that week still to play', () => {
    // Out on Sunday; the survivor's Monday game has not finished.
    expect(
      isPoolDecided({
        sourceComplete: false,
        entries: [alive(4, true), out(5), out(5)],
      }),
    ).toBe(false);
  });

  it('is open while two or more are alive', () => {
    expect(
      isPoolDecided({
        sourceComplete: false,
        entries: [alive(3), alive(3), out(2)],
      }),
    ).toBe(false);
  });

  it('is open before anyone has gone out', () => {
    expect(isPoolDecided({ sourceComplete: false, entries: [alive(1)] })).toBe(
      false,
    );
  });
});

describe('rankEntries', () => {
  it('ranks by how far each entry got, with ties sharing a place', () => {
    const places = rankEntries([
      { key: 'a', survivedWeek: 18 },
      { key: 'b', survivedWeek: 18 },
      { key: 'c', survivedWeek: 9 },
      { key: 'd', survivedWeek: 4 },
      { key: 'e', survivedWeek: 9 },
    ]);
    expect(Object.fromEntries(places)).toEqual({
      a: 1,
      b: 1,
      c: 3,
      d: 5,
      e: 3,
    });
  });
});

describe('poolStartWeek', () => {
  it('is the first week anyone picked', () => {
    expect(
      poolStartWeek([{ picks: [{ week: 9 }, { week: 10 }] }, { picks: [] }]),
    ).toBe(9);
  });

  it('is week 1 for a pool with no picks', () => {
    expect(poolStartWeek([{ picks: [] }])).toBe(1);
  });
});

describe('the Yahoo history', () => {
  // Yahoo names each pool's winner itself. Ranking on how far entries got has
  // to agree with it, or the history would crown the wrong people.
  it.each(yahooHistory.pools.map(pool => [pool.name, pool.year, pool]))(
    '%s (%i) ranks Yahoo’s own winner first, alone',
    (_name, _year, pool) => {
      const places = rankEntries(
        pool.entries.map(entry => ({
          key: entry.teamKey,
          survivedWeek: survivedWeek(
            entry.picks as Parameters<typeof survivedWeek>[0],
          ),
        })),
      );
      const winners = pool.entries.filter(
        entry => places.get(entry.teamKey) === 1,
      );
      expect(winners).toHaveLength(1);
      expect(winners[0].eliminatedWeek).toBeNull();
    },
  );

  it('has every pick on a real team, once per entry per week', () => {
    const teams = new Set([
      'ARI',
      'ATL',
      'BAL',
      'BUF',
      'CAR',
      'CHI',
      'CIN',
      'CLE',
      'DAL',
      'DEN',
      'DET',
      'GB',
      'HOU',
      'IND',
      'JAX',
      'KC',
      'LAC',
      'LAR',
      'LV',
      'MIA',
      'MIN',
      'NE',
      'NO',
      'NYG',
      'NYJ',
      'PHI',
      'PIT',
      'SEA',
      'SF',
      'TB',
      'TEN',
      'WAS',
    ]);
    for (const pool of yahooHistory.pools) {
      for (const entry of pool.entries) {
        const weeks = entry.picks.map(pick => pick.week);
        expect(new Set(weeks).size).toBe(weeks.length);
        for (const pick of entry.picks) expect(teams.has(pick.team)).toBe(true);
      }
    }
  });
});
