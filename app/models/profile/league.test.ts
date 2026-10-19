import {
  buildTierRecords,
  rankStandings,
  type ProfileTeam,
} from './league.server';
import { describe, expect, it } from 'vitest';

const season = (
  year: number,
  pointsFor: number,
  overrides: Partial<ProfileTeam> = {},
): ProfileTeam => ({
  id: `team-${year}`,
  wins: 0,
  losses: 0,
  ties: 0,
  medianWins: 0,
  medianLosses: 0,
  medianTies: 0,
  pointsFor,
  pointsAgainst: pointsFor - 100,
  draftPosition: null,
  league: {
    id: `league-${year}`,
    year,
    name: 'Champions',
    tier: 1,
    hasMedianScoring: false,
  },
  ...overrides,
});

describe('buildTierRecords', () => {
  it('averages points per season over finished seasons only', () => {
    // Two full seasons and five weeks of a third.
    const [tier] = buildTierRecords(
      [season(2024, 1800), season(2025, 2000), season(2026, 600)],
      { inProgressYear: 2026, settledWeek: 5 },
    );

    expect(tier.seasons).toBe(3);
    expect(tier.pointsFor).toBe(4400);
    expect(tier.pointsForPerSeason).toBe(1900);
    expect(tier.pointsAgainstPerSeason).toBe(1800);
    expect(tier.includesCurrentSeason).toBe(true);
  });

  it('has no average for a tier whose only season is still running', () => {
    const [tier] = buildTierRecords([season(2026, 600)], {
      inProgressYear: 2026,
      settledWeek: 5,
    });

    expect(tier.pointsForPerSeason).toBeNull();
    expect(tier.pointsAgainstPerSeason).toBeNull();
  });

  it('counts every season once none is being played', () => {
    const [tier] = buildTierRecords([season(2025, 2000), season(2026, 1600)], {
      inProgressYear: null,
      settledWeek: 0,
    });

    expect(tier.pointsForPerSeason).toBe(1800);
    expect(tier.includesCurrentSeason).toBe(false);
  });
});

describe('rankStandings', () => {
  const team = (
    id: string,
    wins: number,
    losses: number,
    pointsFor: number,
    leagueId = 'league-1',
  ) => ({ id, leagueId, wins, losses, ties: 0, pointsFor });

  it('ranks by record, then points for, within each league', () => {
    const standings = rankStandings([
      team('a', 3, 1, 450),
      team('b', 4, 0, 400),
      team('c', 3, 1, 500),
      team('d', 0, 4, 900, 'league-2'),
    ]);

    expect(standings.get('b')).toEqual({ place: 1, fieldSize: 3 });
    expect(standings.get('c')).toEqual({ place: 2, fieldSize: 3 });
    expect(standings.get('a')).toEqual({ place: 3, fieldSize: 3 });
    expect(standings.get('d')).toEqual({ place: 1, fieldSize: 1 });
  });

  it('counts a tie as half a win, as Sleeper does', () => {
    const standings = rankStandings([
      { id: 'a', leagueId: 'l', wins: 5, losses: 0, ties: 1, pointsFor: 700 },
      { id: 'b', leagueId: 'l', wins: 5, losses: 1, ties: 0, pointsFor: 750 },
    ]);

    expect(standings.get('a')?.place).toBe(1);
    expect(standings.get('b')?.place).toBe(2);
  });

  it('shares a place between teams level on record and points', () => {
    const standings = rankStandings([
      team('a', 2, 2, 400),
      team('b', 2, 2, 400),
      team('c', 1, 3, 380),
    ]);

    expect(standings.get('a')?.place).toBe(1);
    expect(standings.get('b')?.place).toBe(1);
    expect(standings.get('c')?.place).toBe(3);
  });
});
