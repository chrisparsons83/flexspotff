import {
  buildDfsCareer,
  buildDfsFieldWeeks,
  buildDfsFinishes,
  buildDfsSeasonTotals,
  buildDfsPool,
  buildDfsPositions,
  buildDfsSeasons,
  buildDfsWeeks,
  stageOf,
  type DfsEntryRow,
  type DfsPlayer,
} from './dfsSurvivorProfile';
import { describe, expect, it } from 'vitest';

const entry = (
  userId: string,
  year: number,
  week: number,
  slot: string,
  playerId: string,
  points: number,
): DfsEntryRow => ({ userId, year, week, slot, playerId, points });

const players = new Map<string, DfsPlayer>([
  ['gibbs', { name: 'Jahmyr Gibbs', shortName: 'J. Gibbs', position: 'RB' }],
  [
    'bijan',
    { name: 'Bijan Robinson', shortName: 'B. Robinson', position: 'RB' },
  ],
  ['chase', { name: "Ja'Marr Chase", shortName: 'J. Chase', position: 'WR' }],
  ['kelce', { name: 'Travis Kelce', shortName: 'T. Kelce', position: 'TE' }],
  ['allen', { name: 'Josh Allen', shortName: 'J. Allen', position: 'QB' }],
]);

/**
 * Two weeks of 2025. "me" uses Gibbs in week 1 for 30, while "them" waits
 * until week 2 and gets 10 from him. "solo" never uses Gibbs.
 */
const rows: DfsEntryRow[] = [
  entry('me', 2025, 1, 'RB1', 'gibbs', 30),
  entry('me', 2025, 1, 'QB1', 'allen', 20),
  entry('them', 2025, 1, 'RB1', 'bijan', 12),
  entry('them', 2025, 1, 'QB1', 'allen', 18),
  entry('solo', 2025, 1, 'RB1', 'bijan', 6),

  entry('me', 2025, 2, 'RB1', 'bijan', 4),
  entry('me', 2025, 2, 'FLEX1', 'chase', 9),
  entry('me', 2025, 2, 'FLEX2', 'kelce', 3),
  entry('them', 2025, 2, 'RB1', 'gibbs', 10),
  entry('them', 2025, 2, 'FLEX1', 'chase', 15),
];

const weeksFor = (userId = 'me') => buildDfsWeeks(rows, userId, players);

describe('buildDfsWeeks', () => {
  it('ranks each lineup in the field of members who set one that week', () => {
    const [week1, week2] = weeksFor();

    expect(week1).toMatchObject({ total: 50, rank: 1, fieldSize: 3 });
    // 16 against them on 25: solo did not play week 2, so the field is two.
    expect(week2).toMatchObject({ total: 16, rank: 2, fieldSize: 2 });
  });

  it('measures the total against the average lineup that week', () => {
    const [week1] = weeksFor();
    // Lineups of 50, 30 and 6.
    expect(week1.vsField).toBeCloseTo(50 - 86 / 3);
  });

  it('counts the slots left empty', () => {
    const [week1] = weeksFor();
    expect(week1.emptySlots).toBe(9);
  });

  it('keeps picks in lineup order', () => {
    const [week1] = weeksFor();
    expect(week1.picks.map(pick => pick.slot)).toEqual(['QB1', 'RB1']);
  });

  it('compares a pick with the same slot across the field that week', () => {
    const rb = weeksFor()[0].picks.find(pick => pick.slot === 'RB1')!;
    // RBs of 30, 12 and 6 averaged 16.
    expect(rb.vsSlotField).toBe(14);
  });

  it('compares a player with the members who used him in other weeks', () => {
    const gibbs = weeksFor()[0].picks.find(pick => pick.playerId === 'gibbs')!;

    expect(gibbs.others).toEqual({
      count: 1,
      average: 10,
      best: 30,
      worst: 10,
    });
    expect(gibbs.vsOthers).toBe(20);
    expect(gibbs.bestTiming).toBe(true);
  });

  it('marks a player nobody else used as uncompared', () => {
    const kelce = weeksFor()[1].picks.find(pick => pick.playerId === 'kelce')!;

    expect(kelce.others.count).toBe(0);
    expect(kelce.vsOthers).toBeNull();
    expect(kelce.bestTiming).toBe(false);
  });

  it('does not compare a player across seasons', () => {
    const withNextYear = [...rows, entry('them', 2026, 1, 'WR1', 'kelce', 25)];
    const kelce = buildDfsWeeks(withNextYear, 'me', players)[1].picks.find(
      pick => pick.playerId === 'kelce',
    )!;
    expect(kelce.others.count).toBe(0);
  });

  it('sums lineups to the cent, so equal totals tie', () => {
    const tied = [
      entry('a', 2025, 1, 'QB1', 'allen', 0.1),
      entry('a', 2025, 1, 'RB1', 'gibbs', 0.2),
      entry('b', 2025, 1, 'QB1', 'allen', 0.3),
    ];
    const [week] = buildDfsWeeks(tied, 'b', players);
    expect(week).toMatchObject({ rank: 1, total: 0.3 });
  });
});

describe('buildDfsSeasonTotals', () => {
  it('totals each entrant per season to the cent', () => {
    const totals = buildDfsSeasonTotals([
      entry('a', 2025, 1, 'QB1', 'allen', 0.1),
      entry('a', 2025, 2, 'QB1', 'allen', 0.2),
      entry('b', 2025, 1, 'QB1', 'allen', 0.3),
      entry('b', 2026, 1, 'QB1', 'allen', 5),
    ]);

    // 0.1 + 0.2 is 0.30000000000000004 as a float, which would hand b the
    // title outright instead of sharing it.
    expect(totals.get(2025)).toEqual(
      new Map([
        ['a', 0.3],
        ['b', 0.3],
      ]),
    );
    expect(totals.get(2026)).toEqual(new Map([['b', 5]]));
  });
});

describe('buildDfsFinishes', () => {
  it('ranks season totals among everyone who played', () => {
    const finishes = buildDfsFinishes(rows, 'me');
    // me 66, them 55, solo 6.
    expect(finishes.get(2025)).toEqual({ rank: 1, fieldSize: 3 });
    expect(buildDfsFinishes(rows, 'solo').get(2025)).toEqual({
      rank: 3,
      fieldSize: 3,
    });
  });
});

const seasonsFor = (userId = 'me', inProgressYear: number | null = null) =>
  buildDfsSeasons({
    weeks: buildDfsWeeks(rows, userId, players),
    rows,
    finishes: buildDfsFinishes(rows, userId),
    inProgressYear,
  });

describe('buildDfsFieldWeeks', () => {
  it('spreads each week over the lineups set that week', () => {
    const [week1, week2] = buildDfsFieldWeeks(rows).get(2025)!;

    // Lineups of 6, 30 and 50.
    expect(week1).toEqual({
      week: 1,
      low: 6,
      high: 50,
      q1: 18,
      q3: 40,
      median: 30,
    });
    // solo skipped week 2, so it is not a zero in the field.
    expect(week2).toMatchObject({ week: 2, low: 16, high: 25 });
  });
});

describe('buildDfsSeasons', () => {
  it('totals the season and counts the weeks it has had', () => {
    const [season] = seasonsFor('solo');

    expect(season).toMatchObject({
      year: 2025,
      total: 6,
      weeksAvailable: 2,
      weeklyWins: 0,
      playersUsed: 1,
    });
    expect(season.weeks).toHaveLength(1);
  });

  it('counts distinct players used', () => {
    expect(seasonsFor()[0].playersUsed).toBe(5);
  });
});

describe('buildDfsCareer', () => {
  it('rolls up lineups, picks and timing', () => {
    const career = buildDfsCareer(seasonsFor());

    expect(career).toMatchObject({
      weeks: 2,
      weeklyWins: 1,
      picks: 5,
      bigPicks: 2,
      titles: 1,
    });
    expect(career.bestPick?.playerId).toBe('gibbs');
    // Gibbs +20 on them, Allen +2, Bijan 4 against 9, Chase −6. Kelce: no one.
    expect(career.timing.compared).toBe(4);
    expect(career.timing.edge).toBeCloseTo((20 + 2 - 5 - 6) / 4);
    expect(career.timing.bestTimingPicks).toBe(2);
    expect(career.timing.lateVsField).toBeNull();
  });

  it('holds back finishes for a season still running', () => {
    const career = buildDfsCareer(seasonsFor('me', 2025));

    expect(career.titles).toBe(0);
    expect(career.bestFinish).toBeNull();
    expect(career.current).toEqual({ rank: 1, fieldSize: 3, year: 2025 });
  });
});

describe('stageOf', () => {
  it('splits the season into thirds', () => {
    expect([1, 6, 7, 12, 13, 17].map(stageOf)).toEqual([
      'early',
      'early',
      'middle',
      'middle',
      'late',
      'late',
    ]);
  });
});

describe('buildDfsPool', () => {
  it('splits points by stage against the whole field', () => {
    const late = [
      ...rows,
      entry('me', 2025, 14, 'RB1', 'chase', 2),
      entry('them', 2025, 14, 'RB1', 'kelce', 8),
    ];
    const weeks = buildDfsWeeks(late, 'me', players);
    const seasons = buildDfsSeasons({
      weeks,
      rows: late,
      finishes: new Map(),
      inProgressYear: null,
    });
    const [pool] = buildDfsPool(seasons, late, 'me');

    expect(pool.lineup).toEqual([
      // Weeks of 50 and 16; the field's five lineups average 25.4.
      { stage: 'early', mine: 33, field: (50 + 30 + 6 + 16 + 25) / 5 },
      { stage: 'middle', mine: null, field: null },
      { stage: 'late', mine: 2, field: 5 },
    ]);
    const rb = pool.groups.find(group => group.group === 'RB')!;
    expect(rb.stages[0]).toEqual({
      stage: 'early',
      mine: (30 + 4) / 2,
      field: (30 + 12 + 6 + 4 + 10) / 5,
    });
  });

  it('picks out their best picks', () => {
    const [pool] = buildDfsPool(seasonsFor(), rows, 'me');

    expect(pool.stars[0].playerId).toBe('gibbs');
  });
});

describe('buildDfsPositions', () => {
  it('averages each slot against the field and counts empty slots', () => {
    const positions = buildDfsPositions(weeksFor());
    const rb = positions.find(row => row.group === 'RB')!;

    expect(rb).toMatchObject({ picks: 2, average: 17, emptySlots: 2 });
    // Week 1 field RB 16, week 2 field RB (4 + 10) / 2 = 7.
    expect(rb.fieldAverage).toBeCloseTo((16 + 7) / 2);
    expect(rb.best?.playerId).toBe('gibbs');
    expect(rb.worst?.playerId).toBe('bijan');
  });

  it('says what filled the FLEX, and how each did there', () => {
    const positions = buildDfsPositions(weeksFor());
    const flex = positions.find(row => row.group === 'FLEX')!;
    expect(flex.flex).toEqual([
      { position: 'RB', picks: 0, average: null },
      { position: 'WR', picks: 1, average: 9 },
      { position: 'TE', picks: 1, average: 3 },
    ]);
    expect(positions.find(row => row.group === 'QB')!.flex).toEqual([]);
  });
});
