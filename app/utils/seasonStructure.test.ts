import {
  historicalPlayoffWeekStart,
  isRegularSeasonWeek,
  isUsablePlayoffWeekStart,
  leaguePlayedMedianGames,
  isSettledWeek,
  regularSeasonIsOver,
  regularSeasonWeeks,
  seasonStateFromSchedule,
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

describe('seasonStateFromSchedule', () => {
  // A Thursday-to-Monday week, kicking off 2026-09-10 for week 1.
  const schedule = (weeks: number) =>
    Array.from({ length: weeks }, (_, i) => ({
      week: i + 1,
      // Monday night, 00:15 UTC on the Tuesday.
      lastKickoff: new Date(Date.UTC(2026, 8, 15 + i * 7, 0, 15)),
    }));

  it('settles every week whose last game has finished', () => {
    // Saturday of week 5.
    const state = seasonStateFromSchedule({
      year: 2026,
      lastKickoffByWeek: schedule(18),
      now: new Date(Date.UTC(2026, 9, 10)),
    });

    expect(state).toEqual({ inProgressYear: 2026, settledWeek: 4 });
  });

  it('holds a week open while Monday night is still being played', () => {
    // An hour after week 5's last kickoff.
    const state = seasonStateFromSchedule({
      year: 2026,
      lastKickoffByWeek: schedule(18),
      now: new Date(Date.UTC(2026, 9, 13, 1, 15)),
    });

    expect(state.settledWeek).toBe(4);
  });

  it('settles the week by the Tuesday morning league sync', () => {
    const state = seasonStateFromSchedule({
      year: 2026,
      lastKickoffByWeek: schedule(18),
      now: new Date(Date.UTC(2026, 9, 13, 7)),
    });

    expect(state.settledWeek).toBe(5);
  });

  it('stops at a gap in the schedule rather than skipping it', () => {
    const state = seasonStateFromSchedule({
      year: 2026,
      lastKickoffByWeek: schedule(18).filter(week => week.week !== 3),
      now: new Date(Date.UTC(2026, 9, 10)),
    });

    expect(state.settledWeek).toBe(2);
  });

  it('ends the season a week after the final NFL week', () => {
    const lastKickoff = schedule(18)[17].lastKickoff.getTime();
    const day = 24 * 60 * 60 * 1000;

    expect(
      seasonStateFromSchedule({
        year: 2026,
        lastKickoffByWeek: schedule(18),
        now: new Date(lastKickoff + 2 * day),
      }),
    ).toEqual({ inProgressYear: 2026, settledWeek: 18 });

    expect(
      seasonStateFromSchedule({
        year: 2026,
        lastKickoffByWeek: schedule(18),
        now: new Date(lastKickoff + 8 * day),
      }),
    ).toEqual({ inProgressYear: null, settledWeek: 0 });
  });

  it('never ends a season whose schedule stops short of the final week', () => {
    const state = seasonStateFromSchedule({
      year: 2026,
      lastKickoffByWeek: schedule(10),
      now: new Date(Date.UTC(2027, 5, 1)),
    });

    expect(state).toEqual({ inProgressYear: 2026, settledWeek: 10 });
  });

  it('is at week zero before any schedule is synced', () => {
    expect(
      seasonStateFromSchedule({
        year: 2026,
        lastKickoffByWeek: [],
        now: new Date(Date.UTC(2026, 6, 1)),
      }),
    ).toEqual({ inProgressYear: 2026, settledWeek: 0 });
  });
});

describe('isSettledWeek', () => {
  const state = { inProgressYear: 2026, settledWeek: 4 };

  it('treats past seasons as final', () => {
    expect(isSettledWeek({ year: 2025, week: 17 }, state)).toBe(true);
  });

  it('splits the running season at the settled week', () => {
    expect(isSettledWeek({ year: 2026, week: 4 }, state)).toBe(true);
    expect(isSettledWeek({ year: 2026, week: 5 }, state)).toBe(false);
  });
});

describe('regularSeasonIsOver', () => {
  const league = { year: 2026, playoffWeekStart: 15 };

  it('is not over in week 5', () => {
    expect(
      regularSeasonIsOver(league, { inProgressYear: 2026, settledWeek: 4 }),
    ).toBe(false);
  });

  it('is over once the last regular-season week settles', () => {
    expect(
      regularSeasonIsOver(league, { inProgressYear: 2026, settledWeek: 14 }),
    ).toBe(true);
  });

  it('is always over for a past season', () => {
    expect(
      regularSeasonIsOver(
        { year: 2025, playoffWeekStart: 15 },
        { inProgressYear: 2026, settledWeek: 0 },
      ),
    ).toBe(true);
  });

  it('falls back to the historical boundary for an unsynced league', () => {
    expect(
      regularSeasonIsOver(
        { year: 2026, playoffWeekStart: null },
        { inProgressYear: 2026, settledWeek: 13 },
      ),
    ).toBe(false);
  });
});
