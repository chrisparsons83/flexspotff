import {
  chopLine,
  gameProgress,
  projectStarter,
  projectTeam,
  scoreProjection,
} from './projection';

describe('scoreProjection', () => {
  it("scores a stat line with the league's own settings", () => {
    expect(
      scoreProjection(
        { pass_yd: 250, pass_td: 2, pass_int: 1, rec: 4, pts_half_ppr: 99 },
        { pass_yd: 0.04, pass_td: 4, pass_int: -1, rec: 0.5 },
      ),
    ).toBe(19);
  });

  it('scores a missing projection as nothing', () => {
    expect(scoreProjection(null, { rec: 0.5 })).toBe(0);
  });
});

describe('gameProgress', () => {
  const kickoff = new Date('2026-10-04T17:00:00Z');
  const minutesIn = (minutes: number) =>
    new Date(kickoff.getTime() + minutes * 60_000);

  it('is nothing before kickoff and everything once final', () => {
    expect(
      gameProgress({ state: 'pre_game', kickoff, now: minutesIn(-5) }),
    ).toBe(0);
    expect(
      gameProgress({ state: 'complete', kickoff, now: minutesIn(200) }),
    ).toBe(1);
  });

  it('estimates how far through a live game is', () => {
    expect(
      gameProgress({ state: 'in_game', kickoff, now: minutesIn(92.5) }),
    ).toBeCloseTo(0.5);
  });

  it('never calls a live game finished', () => {
    expect(
      gameProgress({ state: 'in_game', kickoff, now: minutesIn(240) }),
    ).toBe(0.95);
  });
});

describe('projectStarter', () => {
  it('adds the unplayed share of the projection to points so far', () => {
    expect(
      projectStarter({
        sleeperId: '1',
        points: 8,
        projection: 16,
        progress: 0.5,
      }),
    ).toBe(16);
  });

  it('counts only real points once the game is over', () => {
    expect(
      projectStarter({
        sleeperId: '1',
        points: 3,
        projection: 16,
        progress: 1,
      }),
    ).toBe(3);
  });

  it('uses the whole projection before kickoff', () => {
    expect(
      projectStarter({
        sleeperId: '1',
        points: 0,
        projection: 12.5,
        progress: 0,
      }),
    ).toBe(12.5);
  });
});

describe('projectTeam', () => {
  it('totals the lineup and counts who is left to play', () => {
    const team = projectTeam([
      { sleeperId: '1', points: 20, projection: 15, progress: 1 },
      { sleeperId: '2', points: 5, projection: 10, progress: 0.5 },
      { sleeperId: '3', points: 0, projection: 12, progress: 0 },
      { sleeperId: '0', points: 0, projection: 0, progress: 0 },
    ]);

    expect(team).toEqual({
      points: 25,
      projected: 42,
      playersRemaining: 2,
      playersYetToPlay: 1,
    });
  });
});

describe('chopLine', () => {
  const team = (name: string, projected: number, points = 0) => ({
    name,
    projected,
    points,
    playersRemaining: 0,
    playersYetToPlay: 0,
  });

  it('puts the lowest projection on the block, with the gap to safety', () => {
    const line = chopLine([team('a', 100), team('b', 80), team('c', 90)]);

    expect(line.map(t => t.name)).toEqual(['a', 'c', 'b']);
    expect(line[2]).toMatchObject({ onTheBlock: true, margin: -10, rank: 3 });
    expect(line[1]).toMatchObject({ onTheBlock: false, margin: 10 });
    expect(line[0].margin).toBe(20);
  });

  it('breaks a tied projection on points already scored', () => {
    const line = chopLine([team('a', 90, 10), team('b', 90, 40)]);

    expect(line[1].name).toBe('a');
    expect(line[1].onTheBlock).toBe(true);
  });

  it('has nobody on the block with one team left', () => {
    expect(chopLine([team('a', 90)])[0].onTheBlock).toBe(false);
  });
});
