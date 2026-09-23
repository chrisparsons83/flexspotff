import { deriveMedianRecords } from './median';
import { prisma } from '~/db.server';
import type { League } from '~/models/league.server';
import { updateLeague } from '~/models/league.server';
import { getTeams, updateTeamMedianRecord } from '~/models/team.server';
import {
  isRegularSeasonWeek,
  leaguePlayedMedianGames,
  regularSeasonWeeks,
  teamsHaveMedianResults,
} from '~/utils/seasonStructure';

/**
 * Rebuilds every league's median record from the scores on file.
 *
 * Sleeper only describes a league's median games for the most recent seasons,
 * so the columns the weekly sync fills are empty for 2018-2023 and partly empty
 * for 2024. The scores are all still here though, so the whole history can be
 * recomputed without asking Sleeper anything - see `app/libs/median.ts`.
 *
 * This is a correction pass, so it is authoritative in both directions: a
 * finished league that did not play medians has its columns zeroed rather than
 * left alone. A league still being played is only ever added to, never
 * cleared. Running it twice changes nothing the second time.
 */
export async function backfillLeagueMedianRecords(league: League): Promise<{
  hasMedianScoring: boolean;
  teamsUpdated: number;
}> {
  const teams = await getTeams(league.id);
  const weeks = regularSeasonWeeks({
    year: league.year,
    playoffWeekStart: league.playoffWeekStart,
  });

  // Three signals, same as the weekly sync. The games count is exact but only
  // settles once the regular season is over, so on its own it reads a season
  // still being played as a non-median league.
  const playedMedians =
    league.hasMedianScoring ||
    teamsHaveMedianResults(teams) ||
    leaguePlayedMedianGames({ teams, regularSeasonWeeks: weeks });

  // Clearing a league's medians is only safe once its regular season has
  // actually been played. In September a median league has barely any games
  // and looks exactly like a league that never played them - zeroing then
  // would throw away what Sleeper told us in week one.
  const seasonPlayed = teams.some(
    team => team.wins + team.losses + team.ties >= weeks,
  );

  if (!playedMedians) {
    if (!seasonPlayed) return { hasMedianScoring: false, teamsUpdated: 0 };

    await Promise.all(
      teams
        .filter(
          team => team.medianWins + team.medianLosses + team.medianTies > 0,
        )
        .map(team =>
          updateTeamMedianRecord({
            id: team.id,
            medianWins: 0,
            medianLosses: 0,
            medianTies: 0,
          }),
        ),
    );
    await updateLeague({ id: league.id, hasMedianScoring: false });

    return { hasMedianScoring: false, teamsUpdated: 0 };
  }

  const games = await prisma.teamGame.findMany({
    where: { team: { leagueId: league.id } },
    select: { teamId: true, week: true, pointsScored: true },
  });

  // Deliberately not filtering on the stored `isRegularSeason` column. That was
  // set by a 2024 backfill migration using the hardcoded boundary, and a league
  // whose `playoffWeekStart` has since been synced can disagree with it. The
  // boundary is cheap to apply here and is the one the rest of this pass uses.
  const regularSeason = games.filter(game =>
    isRegularSeasonWeek({
      week: game.week,
      year: league.year,
      playoffWeekStart: league.playoffWeekStart,
    }),
  );

  const records = deriveMedianRecords(regularSeason);

  await Promise.all(
    teams.map(team =>
      updateTeamMedianRecord({
        id: team.id,
        ...(records.get(team.id) ?? {
          medianWins: 0,
          medianLosses: 0,
          medianTies: 0,
        }),
      }),
    ),
  );
  await updateLeague({ id: league.id, hasMedianScoring: true });

  return { hasMedianScoring: true, teamsUpdated: teams.length };
}

/**
 * The same across many leagues.
 *
 * Failures are collected rather than thrown, so one league with no scores on
 * file cannot abort a backfill of every season since 2018.
 */
export async function backfillMedianRecords(leagues: League[]): Promise<{
  leaguesProcessed: number;
  medianLeagues: number;
  teamsUpdated: number;
  errors: Array<{ leagueName: string; error: string }>;
}> {
  let leaguesProcessed = 0;
  let medianLeagues = 0;
  let teamsUpdated = 0;
  const errors: Array<{ leagueName: string; error: string }> = [];

  for (const league of leagues) {
    try {
      const result = await backfillLeagueMedianRecords(league);
      leaguesProcessed++;
      if (result.hasMedianScoring) medianLeagues++;
      teamsUpdated += result.teamsUpdated;
    } catch (error) {
      errors.push({
        leagueName: `${league.name} ${league.year}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { leaguesProcessed, medianLeagues, teamsUpdated, errors };
}
