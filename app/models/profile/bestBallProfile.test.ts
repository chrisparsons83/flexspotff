import type { BestBallLeagueInput, BestBallPickInput } from './bestBallProfile';
import { buildBestBallCareer, buildBestBallSeason } from './bestBallProfile';

const pick = (
  rosterId: number,
  pickNo: number,
  position: string,
): BestBallPickInput => ({
  pickNo,
  round: Math.ceil(pickNo / 2),
  rosterId,
  sleeperId: `p${pickNo}`,
  position,
  playerName: `Player ${pickNo}`,
  nflTeam: null,
});

const league = (
  year: number,
  isComplete: boolean,
  myPoints: number,
  otherPoints: number,
  myPositions: string[],
): BestBallLeagueInput => ({
  year,
  leagueName: `Autodraft BestBall Mania ${year}`,
  isComplete,
  rosterId: 1,
  teams: [
    {
      id: `${year}-1`,
      rosterId: 1,
      pointsFor: myPoints,
      finish: isComplete ? (myPoints >= otherPoints ? 1 : 2) : null,
      draftSlot: 1,
      weekScores: [
        { week: 1, points: myPoints / 2 },
        { week: 2, points: myPoints / 2 },
      ],
    },
    {
      id: `${year}-2`,
      rosterId: 2,
      pointsFor: otherPoints,
      finish: isComplete ? (otherPoints > myPoints ? 1 : 2) : null,
      draftSlot: 2,
      weekScores: [
        { week: 1, points: otherPoints / 2 },
        { week: 2, points: otherPoints / 2 },
      ],
    },
  ],
  picks: [
    ...myPositions.map((position, i) => pick(1, i * 2 + 1, position)),
    pick(2, 2, 'QB'),
    pick(2, 4, 'RB'),
    pick(2, 6, 'WR'),
    pick(2, 8, 'TE'),
  ],
});

describe('buildBestBallSeason', () => {
  it('places the member and compares their draft with the league', () => {
    const season = buildBestBallSeason(
      league(2025, true, 180, 200, ['QB', 'QB', 'QB', 'WR']),
    );
    expect(season).toMatchObject({
      place: 2,
      teamCount: 2,
      pointsFor: 180,
      gap: 20,
      draftSlot: 1,
      counts: { QB: 3, RB: 0, WR: 1, TE: 0, Other: 0 },
      leagueAverage: { QB: 2, RB: 0.5, WR: 1, TE: 0.5, Other: 0 },
    });
    expect(season.picks.map(p => p.pickNo)).toEqual([1, 3, 5, 7]);
  });
});

describe('buildBestBallCareer', () => {
  it('counts titles only from finished seasons', () => {
    const seasons = [
      buildBestBallSeason(league(2026, false, 300, 100, ['RB', 'WR'])),
      buildBestBallSeason(league(2025, true, 210, 200, ['QB', 'QB', 'QB'])),
    ];
    const career = buildBestBallCareer(seasons, 4);
    expect(career).toMatchObject({
      seasons: 2,
      titles: 1,
      podiums: 1,
      bestFinish: { place: 1, year: 2025 },
      averageFinish: 1,
      totalPoints: 510,
      averagePointsPerWeek: 127.5,
      bestWeek: { points: 150, week: 1, year: 2026 },
      positions: { QB: 3, RB: 1, WR: 1, TE: 0, Other: 0 },
    });
  });

  it('has no finish to report before a season is over', () => {
    const career = buildBestBallCareer(
      [buildBestBallSeason(league(2026, false, 300, 100, ['RB']))],
      2,
    );
    expect(career.titles).toBe(0);
    expect(career.bestFinish).toBeNull();
    expect(career.averageFinish).toBeNull();
  });
});
