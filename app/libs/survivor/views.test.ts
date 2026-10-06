import type { ViewEntry } from './views';
import {
  buildAllTime,
  buildBoard,
  poolTitle,
  poolWeeks,
  summarizeWeeks,
} from './views';

const member = (id: string) => ({ id, discordName: id.toUpperCase() });

// A pool starting week 4: Ann wins, Ben loses week 5, Cat misses week 5 and
// Dan loses straight away.
const entries: ViewEntry[] = [
  {
    id: 'ann',
    displayName: 'ann_on_sleeper',
    user: member('ann'),
    eliminatedWeek: null,
    survivedWeek: 6,
    finish: 1,
    picks: [
      { week: 4, team: 'BUF', result: 'WIN' },
      { week: 5, team: 'KC', result: 'WIN' },
      { week: 6, team: 'DET', result: 'WIN' },
    ],
  },
  {
    id: 'ben',
    displayName: 'ben',
    user: member('ben'),
    eliminatedWeek: 5,
    survivedWeek: 4,
    finish: 2,
    picks: [
      { week: 4, team: 'BUF', result: 'WIN' },
      { week: 5, team: 'NYJ', result: 'LOSS' },
    ],
  },
  {
    id: 'cat',
    displayName: 'cat',
    entryName: "Cat's Picks",
    user: null,
    eliminatedWeek: 5,
    survivedWeek: 4,
    finish: 2,
    picks: [{ week: 4, team: 'SF', result: 'WIN' }],
  },
  {
    id: 'dan',
    displayName: 'dan',
    user: member('dan'),
    eliminatedWeek: 4,
    survivedWeek: 0,
    finish: 4,
    picks: [{ week: 4, team: 'NYJ', result: 'LOSS' }],
  },
];

describe('poolWeeks', () => {
  it('runs from the first week to the last pick or out', () => {
    expect(poolWeeks(4, entries)).toEqual([4, 5, 6]);
  });

  it('is just the start week for an empty pool', () => {
    expect(poolWeeks(1, [])).toEqual([1]);
  });
});

describe('buildBoard', () => {
  const { weeks, rows } = buildBoard(4, entries);

  it('orders entries by how far they got', () => {
    expect(weeks).toEqual([4, 5, 6]);
    expect(rows.map(row => row.id)).toEqual(['ann', 'ben', 'cat', 'dan']);
  });

  it('marks a missed pick in the week it knocked the entry out', () => {
    expect(rows.find(row => row.id === 'cat')!.cells).toEqual([
      { kind: 'pick', team: 'SF', result: 'WIN' },
      { kind: 'missed' },
      { kind: 'none' },
    ]);
  });

  it('names an unmatched entry by its source name', () => {
    const cat = rows.find(row => row.id === 'cat')!;
    expect(cat.name).toBe('cat');
    expect(cat.userId).toBeNull();
  });

  it('keeps the pick set name only when it adds something', () => {
    expect(rows.find(row => row.id === 'cat')!.entryName).toBeNull();
    const { rows: renamed } = buildBoard(4, [
      { ...entries[2], entryName: 'Moose pack' },
    ]);
    expect(renamed[0].entryName).toBe('Moose pack');
    const { rows: yahooDefault } = buildBoard(4, [
      { ...entries[2], entryName: "Nicholas's Matchless Pick Set" },
    ]);
    expect(yahooDefault[0].entryName).toBeNull();
  });

  it('puts the living ahead of the knocked out while a pool runs', () => {
    const live = entries.map(entry => ({ ...entry, finish: null }));
    const { rows: liveRows } = buildBoard(4, [
      { ...live[1] },
      { ...live[0], picks: live[0].picks.slice(0, 1), survivedWeek: 4 },
    ]);
    expect(liveRows.map(row => row.id)).toEqual(['ann', 'ben']);
  });
});

describe('summarizeWeeks', () => {
  const weeks = summarizeWeeks(4, entries);

  it('counts who was alive either side of each week', () => {
    expect(
      weeks.map(({ week, aliveBefore, aliveAfter }) => [
        week,
        aliveBefore,
        aliveAfter,
      ]),
    ).toEqual([
      [4, 4, 3],
      [5, 3, 1],
      [6, 1, 1],
    ]);
  });

  it('finds the popular pick and the team that knocked people out', () => {
    expect(weeks[0].topPick).toEqual({ team: 'BUF', count: 2, result: 'WIN' });
    expect(weeks[0].topBust).toEqual({ team: 'NYJ', count: 1 });
  });

  it('counts missed picks', () => {
    expect(weeks[1].missed).toBe(1);
    expect(weeks[0].missed).toBe(0);
  });
});

describe('buildAllTime', () => {
  it('ranks members by pools won, then their longest run', () => {
    const rows = buildAllTime([
      { isComplete: true, entries },
      {
        isComplete: true,
        entries: [
          { ...entries[1], finish: 1 },
          { ...entries[3], finish: 2 },
        ],
      },
      // Still running, so nobody has won it yet.
      { isComplete: false, entries: [{ ...entries[3], finish: 1 }] },
    ]);
    expect(
      rows.map(({ userId, pools, wins, longestRun }) => [
        userId,
        pools,
        wins,
        longestRun,
      ]),
    ).toEqual([
      ['ann', 1, 1, 3],
      ['ben', 2, 1, 1],
      ['dan', 3, 0, 0],
    ]);
  });
});

describe('poolTitle', () => {
  it('puts the year in front of a name that lacks it', () => {
    expect(poolTitle({ year: 2023, name: 'Flex Spot FF' })).toBe(
      '2023 Flex Spot FF',
    );
  });

  it('leaves a name that already has it', () => {
    expect(poolTitle({ year: 2025, name: 'FlexSpot 2025 Part 1 of X' })).toBe(
      'FlexSpot 2025 Part 1 of X',
    );
  });
});
