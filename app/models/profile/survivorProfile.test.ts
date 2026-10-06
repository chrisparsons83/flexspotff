import type { SurvivorPoolInput } from './survivorProfile';
import {
  buildSurvivorCareer,
  buildSurvivorPool,
  buildSurvivorTeams,
} from './survivorProfile';

// "me" wins the first pool outright with the crowd's picks, then goes out to
// the Jets in the second, which two others share the win of.
const first: SurvivorPoolInput = {
  poolId: 'p1',
  poolName: 'Flex Spot FF',
  year: 2023,
  isComplete: true,
  startWeek: 1,
  entryId: 'me',
  entries: [
    {
      id: 'me',
      eliminatedWeek: null,
      survivedWeek: 3,
      finish: 1,
      picks: [
        { week: 1, team: 'BUF', result: 'WIN' },
        { week: 2, team: 'KC', result: 'WIN' },
        { week: 3, team: 'DET', result: 'WIN' },
      ],
    },
    {
      id: 'a',
      eliminatedWeek: 2,
      survivedWeek: 1,
      finish: 2,
      picks: [
        { week: 1, team: 'BUF', result: 'WIN' },
        { week: 2, team: 'NYJ', result: 'LOSS' },
      ],
    },
    {
      id: 'b',
      eliminatedWeek: 1,
      survivedWeek: 0,
      finish: 3,
      picks: [{ week: 1, team: 'BUF', result: 'LOSS' }],
    },
  ],
};

const second: SurvivorPoolInput = {
  poolId: 'p2',
  poolName: 'Redemption',
  year: 2023,
  isComplete: true,
  startWeek: 4,
  entryId: 'me',
  entries: [
    {
      id: 'me',
      eliminatedWeek: 5,
      survivedWeek: 4,
      finish: 3,
      picks: [
        { week: 4, team: 'BUF', result: 'WIN' },
        { week: 5, team: 'NYJ', result: 'LOSS' },
      ],
    },
    {
      id: 'c',
      eliminatedWeek: null,
      survivedWeek: 6,
      finish: 1,
      picks: [
        { week: 4, team: 'SF', result: 'WIN' },
        { week: 5, team: 'PHI', result: 'WIN' },
        { week: 6, team: 'MIA', result: 'WIN' },
      ],
    },
    {
      id: 'd',
      eliminatedWeek: null,
      survivedWeek: 6,
      finish: 1,
      picks: [
        { week: 4, team: 'SF', result: 'WIN' },
        { week: 5, team: 'PHI', result: 'WIN' },
        { week: 6, team: 'DAL', result: 'WIN' },
      ],
    },
  ],
};

describe('buildSurvivorPool', () => {
  it('reads a pool they won', () => {
    const result = buildSurvivorPool(first);
    expect(result).toMatchObject({
      place: 1,
      winners: 1,
      isAlive: true,
      weeksWon: 3,
      outlasted: 1,
      outBy: null,
      missedPick: false,
      weeks: [1, 2, 3],
    });
  });

  it('reads a pool they went out of, and who did it', () => {
    const result = buildSurvivorPool(second);
    expect(result).toMatchObject({
      place: 3,
      winners: 2,
      eliminatedWeek: 5,
      outBy: 'NYJ',
      outlasted: 0,
      weeks: [4, 5, 6],
    });
    expect(result.cells[2]).toEqual({ kind: 'none' });
  });

  it('marks a missed pick', () => {
    const result = buildSurvivorPool({
      ...second,
      entries: [
        { ...second.entries[0], picks: [second.entries[0].picks[0]] },
        ...second.entries.slice(1),
      ],
    });
    expect(result.missedPick).toBe(true);
    expect(result.outBy).toBeNull();
    expect(result.cells[1]).toEqual({ kind: 'missed' });
  });

  it('leaves the place open while the pool runs', () => {
    const result = buildSurvivorPool({ ...first, isComplete: false });
    expect(result.place).toBeNull();
    expect(result.outlasted).toBeNull();
  });
});

describe('buildSurvivorCareer', () => {
  const pools = [first, second];
  const career = buildSurvivorCareer(pools, pools.map(buildSurvivorPool));

  it('counts pools and wins', () => {
    expect(career.pools).toBe(2);
    expect(career.wins).toBe(1);
    expect(career.sharedWins).toBe(0);
    expect(career.bestPlace).toEqual({
      place: 1,
      year: 2023,
      poolName: 'Flex Spot FF',
    });
  });

  it('tallies their picks', () => {
    expect([career.pickWins, career.pickLosses, career.missedPicks]).toEqual([
      4, 1, 0,
    ]);
    expect(career.longestRun).toEqual({
      weeks: 3,
      year: 2023,
      poolName: 'Flex Spot FF',
    });
  });

  it('averages the share of the field they outlasted', () => {
    expect(career.averageOutlasted).toBe(0.5);
  });

  it('measures how often they went with the crowd', () => {
    // Week 1 of the first pool was everyone's BUF; nothing else was shared.
    expect(career.withCrowd).toBeCloseTo(1 / 5);
  });

  it('only names a nemesis that got them more than once', () => {
    expect(career.nemesis).toBeNull();
    const twice = buildSurvivorCareer(
      [second, second],
      [second, second].map(buildSurvivorPool),
    );
    expect(twice.nemesis).toEqual({ team: 'NYJ', times: 2 });
  });
});

describe('buildSurvivorTeams', () => {
  it('lists teams by how often they were picked, with their record', () => {
    expect(buildSurvivorTeams([first, second]).slice(0, 2)).toEqual([
      { team: 'BUF', picks: 2, wins: 2, losses: 0 },
      { team: 'DET', picks: 1, wins: 1, losses: 0 },
    ]);
  });
});
