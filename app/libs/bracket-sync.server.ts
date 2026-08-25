import { classifyBracket, sleeperBracketJson } from './bracket';
import type { League } from '~/models/league.server';
import { upsertPlayoffGame } from '~/models/playoffgame.server';
import { getTeams } from '~/models/team.server';

/**
 * Pulls both postseason brackets for a league out of Sleeper and stores them.
 *
 * Sleeper serves the winners and losers brackets separately, and they share a
 * shape, so both go through the same classification. The losers bracket's title
 * game is the toilet bowl.
 */

const BRACKETS = [
  { bracket: 'WINNERS', path: 'winners_bracket' },
  { bracket: 'LOSERS', path: 'losers_bracket' },
] as const;

export async function syncLeagueBrackets(league: League): Promise<number> {
  // Sleeper identifies bracket sides by roster id, which is only unique within
  // a league, so the lookup has to be built per league.
  const teams = await getTeams(league.id);
  const teamIdByRosterId = new Map(teams.map(team => [team.rosterId, team.id]));
  const resolve = (rosterId: number | null) =>
    rosterId === null ? null : teamIdByRosterId.get(rosterId) ?? null;

  let gamesStored = 0;

  for (const { bracket, path } of BRACKETS) {
    const res = await fetch(
      `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/${path}`,
    );

    // A league whose season never reached the playoffs has no bracket, and old
    // leagues may no longer be served at all. Neither is an error.
    if (!res.ok) {
      console.warn(
        `No ${path} for league ${league.name} (${league.year}): HTTP ${res.status}`,
      );
      continue;
    }

    const entries = sleeperBracketJson.parse(await res.json());

    for (const game of classifyBracket(entries)) {
      await upsertPlayoffGame({
        leagueId: league.id,
        bracket,
        round: game.round,
        matchupId: game.matchupId,
        placement: game.placement,
        isTitleGame: game.isTitleGame,
        countsTowardRecord: game.countsTowardRecord,
        topTeamId: resolve(game.topRosterId),
        bottomTeamId: resolve(game.bottomRosterId),
        winningTeamId: resolve(game.winningRosterId),
        losingTeamId: resolve(game.losingRosterId),
      });
      gamesStored++;
    }
  }

  return gamesStored;
}

/**
 * Backfills brackets across many leagues.
 *
 * Failures are collected rather than thrown so one league Sleeper no longer
 * serves cannot abort a backfill of every season since 2018.
 */
export async function syncMultipleLeagueBrackets(leagues: League[]): Promise<{
  syncedCount: number;
  gamesStored: number;
  errorCount: number;
  errors: Array<{ leagueName: string; error: string }>;
}> {
  let syncedCount = 0;
  let gamesStored = 0;
  let errorCount = 0;
  const errors: Array<{ leagueName: string; error: string }> = [];

  for (const league of leagues) {
    try {
      gamesStored += await syncLeagueBrackets(league);
      syncedCount++;
    } catch (error) {
      errorCount++;
      errors.push({
        leagueName: `${league.name} ${league.year}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(
        `Failed to sync brackets for ${league.name} ${league.year}:`,
        error,
      );
    }
  }

  return { syncedCount, gamesStored, errorCount, errors };
}
