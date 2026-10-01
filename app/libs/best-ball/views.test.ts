import {
  averagePositionCounts,
  buildStandings,
  draftOutliers,
  isSeasonComplete,
  positionCounts,
  rankByPointsFor,
  resolveRosterOwners,
  weeksToSync,
} from './views';
import type { PositionCounts } from './views';
import fs from 'fs';
import { sleeperBestBallDraftPicksJson } from '~/libs/sleeper/schemas';

const draft2026 = sleeperBestBallDraftPicksJson.parse(
  JSON.parse(
    fs.readFileSync(
      'test/fixtures/sleeper/best-ball-draft-picks-2026.json',
      'utf8',
    ),
  ),
);
const picksFor = (rosterId: number) =>
  draft2026
    .filter(p => p.roster_id === rosterId)
    .map(p => ({ position: p.metadata?.position }));

describe('positionCounts', () => {
  it('counts each position and groups the rest as Other', () => {
    expect(
      positionCounts([
        { position: 'QB' },
        { position: 'WR' },
        { position: 'WR' },
        { position: 'DB' },
        { position: null },
      ]),
    ).toEqual({ QB: 1, RB: 0, WR: 2, TE: 0, Other: 2 });
  });

  it('reads the 2026 autodraft the way Sleeper shows it', () => {
    // The 13-receiver team, and the one that took a defensive back.
    const wrHeavy = draft2026.find(
      p => p.picked_by === '784860156038144000',
    )!.roster_id;
    const withDb = draft2026.find(
      p => p.picked_by === '77283242814095360',
    )!.roster_id;

    expect(positionCounts(picksFor(wrHeavy))).toEqual({
      QB: 0,
      RB: 4,
      WR: 13,
      TE: 1,
      Other: 0,
    });
    expect(positionCounts(picksFor(withDb))).toEqual({
      QB: 2,
      RB: 7,
      WR: 6,
      TE: 2,
      Other: 1,
    });
  });
});

describe('draftOutliers', () => {
  it('names the most at each position, ties included, and anyone without one', () => {
    const counts = new Map<number, PositionCounts>([
      [1, { QB: 5, RB: 5, WR: 6, TE: 2, Other: 0 }],
      [2, { QB: 1, RB: 7, WR: 10, TE: 0, Other: 0 }],
      [3, { QB: 2, RB: 7, WR: 6, TE: 2, Other: 1 }],
    ]);
    const labels = (rosterId: number) =>
      draftOutliers(counts)
        .filter(o => o.rosterId === rosterId)
        .map(o => o.label);

    expect(labels(1)).toEqual(['Most QBs (5)', 'Most TEs (2)']);
    expect(labels(2)).toEqual(['Most RBs (7)', 'Most WRs (10)', 'No TE']);
    expect(labels(3)).toEqual([
      'Most RBs (7)',
      'Most TEs (2)',
      '1 off-position pick',
    ]);
  });

  it('covers every roster in the real draft without throwing', () => {
    const counts = new Map(
      [...new Set(draft2026.map(p => p.roster_id))].map(rosterId => [
        rosterId,
        positionCounts(picksFor(rosterId)),
      ]),
    );
    const outliers = draftOutliers(counts);
    expect(outliers.some(o => o.label === 'Most WRs (13)')).toBe(true);
    expect(outliers.some(o => o.label === 'No QB')).toBe(true);
  });
});

describe('averagePositionCounts', () => {
  it('averages to one decimal, and is null with nothing to average', () => {
    expect(
      averagePositionCounts([
        { QB: 1, RB: 6, WR: 6, TE: 2, Other: 0 },
        { QB: 2, RB: 5, WR: 7, TE: 1, Other: 0 },
        { QB: 2, RB: 5, WR: 7, TE: 1, Other: 1 },
      ]),
    ).toEqual({ QB: 1.7, RB: 5.3, WR: 6.7, TE: 1.3, Other: 0.3 });
    expect(averagePositionCounts([])).toBeNull();
  });
});

describe('rankByPointsFor', () => {
  it('sorts by points with ties sharing a place', () => {
    expect(
      rankByPointsFor([
        { id: 'a', pointsFor: 100 },
        { id: 'b', pointsFor: 120 },
        { id: 'c', pointsFor: 100 },
        { id: 'd', pointsFor: 90 },
      ]).map(t => [t.id, t.rank]),
    ).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
});

describe('buildStandings', () => {
  const team = (
    id: string,
    pointsFor: number,
    weeks: number[],
    finish: number | null = null,
  ) => ({
    id,
    rosterId: Number(id),
    pointsFor,
    finish,
    draftSlot: null,
    weekScores: weeks.map((points, i) => ({ week: i + 1, points })),
  });

  it('works out the gap, best week and weekly top scores', () => {
    const rows = buildStandings([
      team('1', 190, [100, 90]),
      team('2', 200, [80, 120]),
      team('3', 150, [100, 50]),
    ]);
    expect(
      rows.map(r => [r.id, r.rank, r.gap, r.bestWeek?.week, r.topScores]),
    ).toEqual([
      ['2', 1, 0, 2, 1],
      ['1', 2, 10, 1, 1],
      ['3', 3, 50, 1, 1],
    ]);
  });

  it('shows a settled finish over the live rank', () => {
    const rows = buildStandings([team('1', 100, [], 2), team('2', 100, [], 1)]);
    expect(rows.map(r => [r.id, r.rank])).toEqual([
      ['1', 2],
      ['2', 1],
    ]);
  });
});

describe('weeksToSync', () => {
  it('stops at week 17 and includes the week being played', () => {
    expect(weeksToSync({ status: 'pre_draft', lastScoredWeek: 0 })).toBe(0);
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 0 })).toBe(1);
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 3 })).toBe(4);
    expect(weeksToSync({ status: 'in_season', lastScoredWeek: 17 })).toBe(17);
    expect(weeksToSync({ status: 'complete', lastScoredWeek: 17 })).toBe(17);
  });
});

describe('isSeasonComplete', () => {
  it('waits until Sleeper has moved past week 17', () => {
    expect(isSeasonComplete({ status: 'in_season', lastScoredLeg: 16 })).toBe(
      false,
    );
    expect(isSeasonComplete({ status: 'in_season', lastScoredLeg: 17 })).toBe(
      false,
    );
    expect(isSeasonComplete({ status: 'in_season', lastScoredLeg: 18 })).toBe(
      true,
    );
    expect(isSeasonComplete({ status: 'complete', lastScoredLeg: 17 })).toBe(
      true,
    );
  });
});

describe('resolveRosterOwners', () => {
  it("falls back to whoever made a roster's picks", () => {
    const owners = resolveRosterOwners(
      [
        { roster_id: 1, owner_id: 'a' },
        { roster_id: 2, owner_id: null },
        { roster_id: 3, owner_id: null },
      ],
      [
        { roster_id: 1, picked_by: 'x' },
        { roster_id: 2, picked_by: 'b' },
      ],
    );
    expect([...owners]).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, null],
    ]);
  });
});
