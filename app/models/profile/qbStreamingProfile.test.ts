import {
  buildBestAvailable,
  buildQbCareer,
  buildQbExposure,
  buildQbFinishes,
  buildQbSeasons,
  buildQbWeeks,
  type QbPlayer,
  type QbSelectionRow,
} from './qbStreamingProfile';
import { describe, expect, it } from 'vitest';

const row = (
  userId: string,
  year: number,
  week: number,
  standard: [string, number],
  deep: [string, number],
): QbSelectionRow => ({
  userId,
  year,
  week,
  standard: { playerId: standard[0], points: standard[1] },
  deep: { playerId: deep[0], points: deep[1] },
});

const players = new Map<string, QbPlayer>([
  ['minshew', { firstName: 'Gardner', lastName: 'Minshew' }],
  ['mariota', { firstName: 'Marcus', lastName: 'Mariota' }],
  ['dalton', { firstName: 'Andy', lastName: 'Dalton' }],
]);

describe('buildQbWeeks', () => {
  const rows = [
    row('me', 2024, 1, ['minshew', 20], ['mariota', 10]),
    row('a', 2024, 1, ['dalton', 10], ['mariota', 10]),
    row('b', 2024, 1, ['dalton', 30], ['mariota', 10]),
    row('a', 2024, 2, ['dalton', 5], ['mariota', 5]),
  ];

  it('measures each pick against the field average of the same kind', () => {
    const [week] = buildQbWeeks(rows, 'me', players);

    expect(week.standard.vsField).toBeCloseTo(0);
    expect(week.deep.vsField).toBeCloseTo(0);
    expect(week.total).toBe(30);
    expect(week.standard.name).toBe('Gardner Minshew');
    expect(week.standard.shortName).toBe('G. Minshew');
  });

  it('ranks the week against everyone who played it, sharing ties', () => {
    const [week] = buildQbWeeks(
      [...rows, row('c', 2024, 1, ['dalton', 20], ['mariota', 10])],
      'me',
      players,
    );

    expect(week.rank).toBe(2);
    expect(week.fieldSize).toBe(4);
  });

  it('only returns the member’s own weeks, oldest first', () => {
    const weeks = buildQbWeeks(
      [row('me', 2025, 1, ['minshew', 1], ['mariota', 1]), ...rows],
      'me',
      players,
    );
    expect(weeks.map(week => `${week.year}-${week.week}`)).toEqual([
      '2024-1',
      '2025-1',
    ]);
  });

  it('names a player it could not find', () => {
    const [week] = buildQbWeeks(
      [row('me', 2024, 1, ['ghost', 1], ['mariota', 1])],
      'me',
      players,
    );
    expect(week.standard.name).toBe('Unknown QB');
  });
});

describe('buildQbFinishes', () => {
  it('ranks pre-2025 seasons on every week', () => {
    const rows = [
      row('me', 2024, 1, ['minshew', 30], ['mariota', 0]),
      row('me', 2024, 2, ['minshew', 1], ['mariota', 0]),
      row('a', 2024, 1, ['dalton', 20], ['mariota', 0]),
      row('a', 2024, 2, ['dalton', 20], ['mariota', 0]),
    ];
    expect(buildQbFinishes(rows, 'me').get(2024)).toEqual({
      rank: 2,
      fieldSize: 2,
    });
  });

  it('ranks best-twelve seasons on the best twelve weeks only', () => {
    // Thirteen weeks of 10 for me, one of which is a 0 that gets dropped;
    // theirs are twelve weeks of 9.5.
    const rows = [
      ...Array.from({ length: 12 }, (_, i) =>
        row('me', 2025, i + 1, ['minshew', 10], ['mariota', 0]),
      ),
      row('me', 2025, 13, ['minshew', 0], ['mariota', 0]),
      ...Array.from({ length: 12 }, (_, i) =>
        row('a', 2025, i + 1, ['dalton', 9.5], ['mariota', 0]),
      ),
    ];
    expect(buildQbFinishes(rows, 'me').get(2025)?.rank).toBe(1);
  });
});

describe('buildQbSeasons', () => {
  it('marks dropped weeks in a best-twelve season and totals the rest', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      row('me', 2025, i + 1, ['minshew', i + 1], ['mariota', 0]),
    );
    const [season] = buildQbSeasons({
      weeks: buildQbWeeks(rows, 'me', players),
      finishes: new Map(),
      inProgressYear: null,
    });

    expect(season.usesTopWeeks).toBe(true);
    expect(season.weeks.filter(week => !week.counts).map(w => w.week)).toEqual([
      1, 2,
    ]);
    // 3 + 4 + ... + 14
    expect(season.total).toBe(102);
  });

  it('counts every week before 2025', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      row('me', 2024, i + 1, ['minshew', 1], ['mariota', 1]),
    );
    const [season] = buildQbSeasons({
      weeks: buildQbWeeks(rows, 'me', players),
      finishes: new Map(),
      inProgressYear: null,
    });

    expect(season.weeks.every(week => week.counts)).toBe(true);
    expect(season.total).toBe(28);
  });

  it('keeps the earlier week when two tie for best', () => {
    const rows = [
      row('me', 2024, 1, ['minshew', 10], ['mariota', 0]),
      row('me', 2024, 2, ['minshew', 10], ['mariota', 0]),
    ];
    const [season] = buildQbSeasons({
      weeks: buildQbWeeks(rows, 'me', players),
      finishes: new Map(),
      inProgressYear: null,
    });
    expect(season.bestWeek?.week).toBe(1);
  });
});

describe('buildQbCareer', () => {
  const rows = [
    row('me', 2023, 1, ['minshew', 20], ['mariota', 4]),
    row('a', 2023, 1, ['dalton', 10], ['mariota', 8]),
    row('me', 2024, 1, ['mariota', 12], ['dalton', 10]),
    row('a', 2024, 1, ['dalton', 20], ['mariota', 3]),
  ];
  const seasons = (inProgressYear: number | null) =>
    buildQbSeasons({
      weeks: buildQbWeeks(rows, 'me', players),
      finishes: buildQbFinishes(rows, 'me'),
      inProgressYear,
    });

  it('averages standard and deep picks separately, against the field', () => {
    const career = buildQbCareer(seasons(null));

    expect(career.standard.average).toBe(16);
    expect(career.deep.average).toBe(7);
    // Standard: +5 then -4. Deep: -2 then +3.5.
    expect(career.standard.vsField).toBe(0.5);
    expect(career.deep.vsField).toBe(0.75);
    expect(career.standard.beatFieldWeeks).toBe(1);
    expect(career.standard.best).toEqual({
      points: 20,
      year: 2023,
      week: 1,
      name: 'G. Minshew',
    });
  });

  it('only counts finishes from seasons that are over', () => {
    const finished = buildQbCareer(seasons(null));
    expect(finished.titles).toBe(1);
    expect(finished.topThrees).toBe(2);
    expect(finished.topFives).toBe(2);
    expect(finished.completedSeasons).toBe(2);
    expect(finished.current).toBeNull();

    const running = buildQbCareer(seasons(2024));
    expect(running.titles).toBe(1);
    expect(running.completedSeasons).toBe(1);
    expect(running.current).toEqual({ rank: 2, fieldSize: 2, year: 2024 });
    // Weeks from the running season still count towards the averages.
    expect(running.weeks).toBe(2);
  });

  it('counts week highs', () => {
    expect(buildQbCareer(seasons(null)).weeklyWins).toBe(1);
  });
});

describe('top QB picked', () => {
  const rows = [row('me', 2024, 1, ['minshew', 20], ['mariota', 12])];

  it('marks a pick that tied the best score on its list', () => {
    const best = buildBestAvailable([
      { year: 2024, week: 1, isDeep: false, points: 20 },
      { year: 2024, week: 1, isDeep: true, points: 15 },
      { year: 2024, week: 1, isDeep: true, points: 12 },
    ]);
    const [week] = buildQbWeeks(rows, 'me', players, best);

    expect(week.standard.topPick).toBe(true);
    expect(week.deep.topPick).toBe(false);
  });

  it('measures the standard pick against the deep QBs too', () => {
    const best = buildBestAvailable([
      { year: 2024, week: 1, isDeep: false, points: 20 },
      { year: 2024, week: 1, isDeep: true, points: 25 },
    ]);
    const [week] = buildQbWeeks(rows, 'me', players, best);

    expect(week.standard.topPick).toBe(false);
  });

  it('never credits an empty slot', () => {
    const withNoPick = new Map(players).set('none', {
      firstName: 'No',
      lastName: 'pick',
      noPick: true,
    });
    const best = buildBestAvailable([
      { year: 2024, week: 1, isDeep: true, points: 0 },
    ]);
    const [week] = buildQbWeeks(
      [row('me', 2024, 1, ['none', 0], ['none', 0])],
      'me',
      withNoPick,
      best,
    );

    expect(week.deep.topPick).toBe(false);
    expect(week.deep.name).toBe('No pick');
    expect(week.doubled).toBe(false);
    expect(buildQbExposure([week])).toEqual([]);
  });
});

describe('buildQbExposure', () => {
  it('counts every pick of a QB, standard and deep together, by year', () => {
    const weeks = buildQbWeeks(
      [
        row('me', 2023, 1, ['minshew', 10], ['mariota', 4]),
        row('me', 2024, 1, ['mariota', 20], ['dalton', 6]),
        row('me', 2024, 2, ['minshew', 2], ['mariota', 6]),
      ],
      'me',
      players,
    );
    const [top, second, third] = buildQbExposure(weeks);

    expect(top).toMatchObject({
      playerId: 'mariota',
      picks: 3,
      standardOnly: 1,
      deepOnly: 2,
      doubled: 0,
      byYear: { 2023: 1, 2024: 2 },
      averagePoints: 10,
      bestPoints: 20,
      worstPoints: 4,
    });
    expect(second.playerId).toBe('minshew');
    expect(third.playerId).toBe('dalton');
  });

  it('counts a doubled-up week as two picks', () => {
    const weeks = buildQbWeeks(
      [
        row('me', 2024, 1, ['dalton', 24], ['dalton', 24]),
        row('me', 2024, 2, ['dalton', 12], ['mariota', 6]),
      ],
      'me',
      players,
    );
    const [dalton] = buildQbExposure(weeks);

    expect(weeks[0].doubled).toBe(true);
    expect(dalton).toMatchObject({
      picks: 3,
      doubled: 1,
      standardOnly: 1,
      deepOnly: 0,
      byYear: { 2024: 3 },
      averagePoints: 20,
    });
    expect(
      buildQbCareer(
        buildQbSeasons({ weeks, finishes: new Map(), inProgressYear: null }),
      ).doubledWeeks,
    ).toBe(1);
  });
});
