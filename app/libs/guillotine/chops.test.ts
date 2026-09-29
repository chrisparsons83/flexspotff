import rawFixtures from '../__fixtures__/guillotine-leagues.json';
import type { ChopRoster, ChopWeekRow } from './chops';
import {
  GUILLOTINE_FINAL_WEEK,
  resolveChops,
  resolveRosterOwners,
  weeksToSync,
} from './chops';

type Fixture = {
  status: string;
  lastScoredLeg: number;
  /** [rosterId, eliminated, hasPlayers] */
  rosters: [number, number | null, boolean][];
  /** week -> [rosterId, points, playerCount][] */
  weeks: Record<string, [number, number, number][]>;
};

const fixtures = rawFixtures as unknown as Record<
  'native2026' | 'manual2025' | 'manual2021',
  Fixture
>;

/**
 * Real Sleeper data from the three league formats, trimmed to what the chop
 * logic reads: the 2026 league (Sleeper's own guillotine), 2025 (chopped by
 * hand) and the first league, 2021 (chopped by hand, managers removed after).
 */
function load(fixture: Fixture) {
  const rosters: ChopRoster[] = fixture.rosters.map(
    ([rosterId, eliminated, hasPlayers]) => ({
      rosterId,
      eliminated,
      hasPlayers,
    }),
  );
  const weeks = new Map<number, ChopWeekRow[]>(
    Object.entries(fixture.weeks).map(([week, rows]) => [
      Number(week),
      rows.map(([rosterId, points, playerCount]) => ({
        rosterId,
        points,
        playerCount,
      })),
    ]),
  );
  return {
    rosters,
    weeks,
    lastScoredWeek: Math.min(fixture.lastScoredLeg, GUILLOTINE_FINAL_WEEK),
  };
}

/** Roster IDs in the order they were chopped. */
const chopOrder = (choppedWeek: Map<number, number | null>) =>
  [...choppedWeek.entries()]
    .filter((entry): entry is [number, number] => entry[1] !== null)
    .sort((a, b) => a[1] - b[1])
    .map(([rosterId]) => rosterId);

describe('resolveChops', () => {
  it("reads a native league's chops from Sleeper's eliminated week", () => {
    const result = resolveChops({
      format: 'NATIVE',
      ...load(fixtures.native2026),
    });

    expect(result.choppedWeek.get(16)).toBe(1);
    expect(result.choppedWeek.get(18)).toBe(2);
    expect(result.choppedWeek.get(8)).toBe(3);
    expect(chopOrder(result.choppedWeek)).toEqual([16, 18, 8]);
    // Mid-season: the chopped teams are placed, everyone else is still alive.
    expect(result.finish.get(16)).toBe(18);
    expect(result.finish.get(8)).toBe(16);
    expect(result.finish.size).toBe(3);
    expect(result.championRosterId).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('dates a manual chop by the last week the roster had players', () => {
    const result = resolveChops({
      format: 'MANUAL',
      ...load(fixtures.manual2025),
    });

    expect(chopOrder(result.choppedWeek)).toEqual([
      7, 18, 3, 13, 4, 1, 2, 8, 10, 5, 15, 17, 6, 12, 16, 9, 11,
    ]);
    expect(result.choppedWeek.get(7)).toBe(1);
    expect(result.choppedWeek.get(9)).toBe(16);
    expect(result.warnings).toEqual([]);
  });

  it('settles a manual final on week 17 and ignores week 18', () => {
    // 2025: roster 14 beat roster 11 in week 17, 118.80 to 114.48. Both also
    // played week 18, which never counts.
    const result = resolveChops({
      format: 'MANUAL',
      ...load(fixtures.manual2025),
    });

    expect(result.choppedWeek.get(11)).toBe(GUILLOTINE_FINAL_WEEK);
    expect(result.championRosterId).toBe(14);
    expect(result.finish.get(14)).toBe(1);
    expect(result.finish.get(11)).toBe(2);
    expect(result.finish.get(9)).toBe(3);
    expect(result.finish.get(7)).toBe(18);
  });

  it('handles the 2021 league, where week 18 shows every roster again', () => {
    const result = resolveChops({
      format: 'MANUAL',
      ...load(fixtures.manual2021),
    });

    expect(chopOrder(result.choppedWeek)).toEqual([
      8, 14, 18, 7, 13, 9, 17, 12, 6, 16, 1, 4, 2, 10, 5, 11, 15,
    ]);
    // Roster 3 beat roster 15 in week 17, 154.00 to 95.36.
    expect(result.championRosterId).toBe(3);
    expect(result.finish.get(15)).toBe(2);
    expect(new Set(result.finish.values()).size).toBe(18);
    expect(result.warnings).toEqual([]);
  });

  it('has no champion while week 17 is unscored', () => {
    const { rosters, weeks } = load(fixtures.manual2025);
    const result = resolveChops({
      format: 'MANUAL',
      rosters,
      weeks,
      lastScoredWeek: 16,
    });

    expect(result.championRosterId).toBeNull();
    expect(result.choppedWeek.get(11)).toBeNull();
    expect(result.choppedWeek.get(14)).toBeNull();
    expect(result.finish.get(9)).toBe(3);
  });

  it('keeps a native final Sleeper already recorded', () => {
    const result = resolveChops({
      format: 'NATIVE',
      rosters: [
        { rosterId: 1, eliminated: 17, hasPlayers: false },
        { rosterId: 2, eliminated: null, hasPlayers: true },
        { rosterId: 3, eliminated: 16, hasPlayers: false },
      ],
      weeks: new Map([
        [
          17,
          [
            { rosterId: 1, points: 150, playerCount: 14 },
            { rosterId: 2, points: 100, playerCount: 14 },
          ],
        ],
      ]),
      lastScoredWeek: 17,
    });

    // Sleeper's record wins over the scores.
    expect(result.championRosterId).toBe(2);
    expect(result.finish.get(1)).toBe(2);
  });

  it('reports a tied final instead of picking a champion', () => {
    const result = resolveChops({
      format: 'MANUAL',
      rosters: [
        { rosterId: 1, eliminated: null, hasPlayers: true },
        { rosterId: 2, eliminated: null, hasPlayers: true },
      ],
      weeks: new Map([
        [
          17,
          [
            { rosterId: 1, points: 100, playerCount: 14 },
            { rosterId: 2, points: 100, playerCount: 14 },
          ],
        ],
      ]),
      lastScoredWeek: 17,
    });

    expect(result.championRosterId).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it('dates a manual chop made before Sleeper marks the week scored', () => {
    // Week 2 is still unscored in Sleeper, but the commissioner has already
    // emptied roster 2 after its week-2 game.
    const result = resolveChops({
      format: 'MANUAL',
      rosters: [
        { rosterId: 1, eliminated: null, hasPlayers: true },
        { rosterId: 2, eliminated: null, hasPlayers: false },
      ],
      weeks: new Map([
        [
          1,
          [
            { rosterId: 1, points: 90, playerCount: 14 },
            { rosterId: 2, points: 95, playerCount: 14 },
          ],
        ],
        [
          2,
          [
            { rosterId: 1, points: 90, playerCount: 14 },
            { rosterId: 2, points: 60, playerCount: 14 },
          ],
        ],
      ]),
      lastScoredWeek: 1,
    });

    expect(result.choppedWeek.get(2)).toBe(2);
  });

  it('warns about an empty roster that never played', () => {
    const result = resolveChops({
      format: 'MANUAL',
      rosters: [{ rosterId: 1, eliminated: null, hasPlayers: false }],
      weeks: new Map([[1, [{ rosterId: 1, points: 0, playerCount: 0 }]]]),
      lastScoredWeek: 1,
    });

    expect(result.choppedWeek.get(1)).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });
});

describe('resolveRosterOwners', () => {
  it("falls back to the drafter when Sleeper has lost a roster's owner", () => {
    const owners = resolveRosterOwners(
      [
        { roster_id: 1, owner_id: 'a' },
        { roster_id: 2, owner_id: null },
        { roster_id: 3, owner_id: null },
      ],
      [
        { roster_id: 1, picked_by: 'someone-else' },
        { roster_id: 2, picked_by: 'b' },
        { roster_id: 2, picked_by: 'b' },
      ],
    );

    expect(owners.get(1)).toBe('a');
    expect(owners.get(2)).toBe('b');
    expect(owners.get(3)).toBeNull();
  });
});

describe('weeksToSync', () => {
  it('syncs nothing before the draft', () => {
    expect(weeksToSync({ status: 'pre_draft', lastScoredWeek: 0 })).toBe(0);
  });

  it('includes the week in progress during a season', () => {
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 3 })).toBe(4);
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 0 })).toBe(1);
  });

  it('never goes past the final', () => {
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 17 })).toBe(17);
    expect(weeksToSync({ status: 'complete', lastScoredWeek: 18 })).toBe(17);
  });
});
