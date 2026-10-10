import { classifyBracket, sleeperBracketJson } from './bracket';
import { getLeagueInfo } from '~/libs/sleeper/api.server';
import type { League } from '~/models/league.server';
import {
  deletePlayoffGamesForLeague,
  upsertPlayoffGame,
} from '~/models/playoffgame.server';
import { getTeams } from '~/models/team.server';
import { isUsablePlayoffWeekStart } from '~/utils/seasonStructure';

/**
 * Pulls both postseason brackets for a league out of Sleeper and stores them.
 *
 * Sleeper serves the winners and losers brackets separately, and they share a
 * shape, so both go through the same classification. Which side advances is
 * detected per bracket rather than assumed - the sacko bracket advances whoever
 * scores least - so the sacko lands on the right member.
 */

const BRACKETS = [
  { bracket: 'WINNERS', path: 'winners_bracket' },
  { bracket: 'LOSERS', path: 'losers_bracket' },
] as const;

/**
 * Whether Sleeper's brackets for a league are still provisional.
 *
 * During the regular season Sleeper still serves both brackets, seeded from the
 * current standings, so a team in last place at week 5 would be stored as a
 * sacko bracket team. Sleeper may keep reporting `in_season` into the playoffs,
 * so for that status the last scored week decides: once the regular season has
 * been scored, the seeding is final.
 */
async function bracketsAreProvisional(sleeperLeagueId: string) {
  let info;
  try {
    info = await getLeagueInfo(sleeperLeagueId);
  } catch (error) {
    // Old leagues may no longer be served at all; their brackets are final, and
    // the bracket fetches below already treat a missing league as no bracket.
    console.warn(`Could not read league status for ${sleeperLeagueId}:`, error);
    return false;
  }

  const { status, settings } = info;
  if (status === 'pre_draft' || status === 'drafting') return true;
  if (status !== 'in_season') return false;

  const lastScored = settings?.last_scored_leg;
  const playoffStart = settings?.playoff_week_start;
  if (
    typeof lastScored === 'number' &&
    isUsablePlayoffWeekStart(playoffStart)
  ) {
    return lastScored < playoffStart - 1;
  }
  return true;
}

export async function syncLeagueBrackets(league: League): Promise<number> {
  if (await bracketsAreProvisional(league.sleeperLeagueId)) {
    // Anything already stored was a provisional bracket from an earlier sync.
    await deletePlayoffGamesForLeague(league.id);
    return 0;
  }

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

    // Before a bracket is generated Sleeper answers 200 with a null body rather
    // than a 404, so this is the ordinary in-season case, not a failure.
    const body = await res.json();
    if (body === null) continue;

    const entries = sleeperBracketJson.parse(body);
    const { games } = classifyBracket(entries, bracket);

    for (const game of games) {
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
        advancingTeamId: resolve(game.advancingRosterId),
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
