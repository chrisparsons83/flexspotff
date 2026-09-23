import {
  historicalPlayoffWeekStart,
  isRegularSeasonWeek,
  isUsablePlayoffWeekStart,
  leaguePlayedMedianGames,
  regularSeasonWeeks,
  teamsHaveMedianResults,
} from './seasonStructure';
import { describe, expect, it } from 'vitest';

describe('historicalPlayoffWeekStart', () => {
  // These two values are the ones the 20240917050428 migration used to backfill
  // TeamGame.isRegularSeason. If they ever drift apart, old games silently
  // change classification.
  it('matches the boundary the isRegularSeason backfill migration used', () => {
    expect(historicalPlayoffWeekStart(2018)).toBe(14);
    expect(historicalPlayoffWeekStart(2020)).toBe(14);
    expect(historicalPlayoffWeekStart(2021)).toBe(15);
    expect(historicalPlayoffWeekStart(2025)).toBe(15);
  });
});

describe('isRegularSeasonWeek', () => {
  it('uses the league playoff start when it has been synced', () => {
    const league = { year: 2024, playoffWeekStart: 15 };

    expect(isRegularSeasonWeek({ week: 14, ...league })).toBe(true);
    expect(isRegularSeasonWeek({ week: 15, ...league })).toBe(false);
  });

  // The whole point of the column: a schedule change is data, not a deploy.
  it('follows a league that moved its playoffs a week later', () => {
    const league = { year: 2026, playoffWeekStart: 16 };

    expect(isRegularSeasonWeek({ week: 15, ...league })).toBe(true);
    expect(isRegularSeasonWeek({ week: 16, ...league })).toBe(false);
  });

  // A partial backfill must not reclassify every week as a playoff game, which
  // is what treating null as zero would do.
  it('falls back to the historical boundary when unsynced', () => {
    expect(
      isRegularSeasonWeek({ week: 13, year: 2019, playoffWeekStart: null }),
    ).toBe(true);
    expect(
      isRegularSeasonWeek({ week: 14, year: 2019, playoffWeekStart: null }),
    ).toBe(false);
    expect(
      isRegularSeasonWeek({ week: 14, year: 2022, playoffWeekStart: null }),
    ).toBe(true);
    expect(
      isRegularSeasonWeek({ week: 15, year: 2022, playoffWeekStart: null }),
    ).toBe(false);
  });

  // Sleeper can report 0 for a league whose playoffs were never configured.
  // `??` accepts it happily, and `week < 0` is false for every week - so the
  // whole season silently became postseason.
  it('ignores a zero playoff start rather than voiding the season', () => {
    for (const week of [1, 5, 13]) {
      expect(
        isRegularSeasonWeek({ week, year: 2024, playoffWeekStart: 0 }),
      ).toBe(true);
    }
    expect(
      isRegularSeasonWeek({ week: 15, year: 2024, playoffWeekStart: 0 }),
    ).toBe(false);
  });

  it('ignores a negative playoff start', () => {
    expect(
      isRegularSeasonWeek({ week: 3, year: 2024, playoffWeekStart: -1 }),
    ).toBe(true);
  });

  it('treats undefined the same as null', () => {
    expect(
      isRegularSeasonWeek({
        week: 14,
        year: 2019,
        playoffWeekStart: undefined,
      }),
    ).toBe(false);
  });
});

describe('teamsHaveMedianResults', () => {
  const team = (medianWins: number, medianLosses: number, medianTies = 0) => ({
    medianWins,
    medianLosses,
    medianTies,
  });

  it('is false for a league whose teams have no median results', () => {
    expect(teamsHaveMedianResults([team(0, 0), team(0, 0)])).toBe(false);
  });

  it('is true once any team has a median result', () => {
    expect(teamsHaveMedianResults([team(0, 0), team(7, 6)])).toBe(true);
  });

  // A team can go winless against the median and still have played it.
  it('counts median losses and ties, not just wins', () => {
    expect(teamsHaveMedianResults([team(0, 13)])).toBe(true);
    expect(teamsHaveMedianResults([team(0, 0, 1)])).toBe(true);
  });

  it('is false for a league with no teams yet', () => {
    expect(teamsHaveMedianResults([])).toBe(false);
  });
});

describe('leaguePlayedMedianGames', () => {
  const team = (wins: number, losses: number, ties = 0) => ({
    wins,
    losses,
    ties,
  });

  // The real shape of every season on the site.
  it('reads the seasons we have the way they actually ran', () => {
    // 2018 and 2019: thirteen games in thirteen weeks.
    expect(
      leaguePlayedMedianGames({
        teams: [team(9, 4), team(5, 8)],
        regularSeasonWeeks: 13,
      }),
    ).toBe(false);

    // 2020: twenty-six games in thirteen weeks.
    expect(
      leaguePlayedMedianGames({
        teams: [team(18, 8), team(13, 13)],
        regularSeasonWeeks: 13,
      }),
    ).toBe(true);

    // 2021 onward: twenty-eight in fourteen.
    expect(
      leaguePlayedMedianGames({
        teams: [team(17, 11), team(10, 18)],
        regularSeasonWeeks: 14,
      }),
    ).toBe(true);
  });

  // The reason this takes the maximum rather than asking every team.
  it('is not fooled by a replacement who joined mid-season', () => {
    expect(
      leaguePlayedMedianGames({
        teams: [team(17, 11), team(3, 5)],
        regularSeasonWeeks: 14,
      }),
    ).toBe(true);
  });

  it('is false before a ball has been played', () => {
    expect(
      leaguePlayedMedianGames({
        teams: [team(0, 0), team(0, 0)],
        regularSeasonWeeks: 14,
      }),
    ).toBe(false);
    expect(leaguePlayedMedianGames({ teams: [], regularSeasonWeeks: 14 })).toBe(
      false,
    );
  });

  // Mid-season, a median league has not yet reached twice the week count.
  it('is false part-way through a median season', () => {
    expect(
      leaguePlayedMedianGames({
        teams: [team(8, 6)],
        regularSeasonWeeks: 14,
      }),
    ).toBe(false);
  });

  it('is false for a season with no weeks', () => {
    expect(
      leaguePlayedMedianGames({ teams: [team(0, 0)], regularSeasonWeeks: 0 }),
    ).toBe(false);
  });
});

describe('regularSeasonWeeks', () => {
  it('uses a synced playoff start when there is one', () => {
    expect(regularSeasonWeeks({ year: 2020, playoffWeekStart: 15 })).toBe(14);
  });

  it('falls back to the historical boundary', () => {
    expect(regularSeasonWeeks({ year: 2020, playoffWeekStart: null })).toBe(13);
    expect(regularSeasonWeeks({ year: 2021, playoffWeekStart: null })).toBe(14);
  });

  it('ignores a playoff start that cannot be real', () => {
    expect(regularSeasonWeeks({ year: 2021, playoffWeekStart: 0 })).toBe(14);
  });
});

describe('isUsablePlayoffWeekStart', () => {
  it('accepts a real week', () => {
    expect(isUsablePlayoffWeekStart(15)).toBe(true);
  });

  it('rejects the values that would void a season', () => {
    expect(isUsablePlayoffWeekStart(0)).toBe(false);
    expect(isUsablePlayoffWeekStart(-1)).toBe(false);
    expect(isUsablePlayoffWeekStart(null)).toBe(false);
    expect(isUsablePlayoffWeekStart(undefined)).toBe(false);
    expect(isUsablePlayoffWeekStart(14.5)).toBe(false);
  });
});
