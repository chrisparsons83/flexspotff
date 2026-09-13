import { syncD12Week } from '~/libs/d12-sync.server';
import {
  getNflState,
  syncNflGameWeek,
  syncSleeperWeeklyScores,
} from '~/libs/syncs.server';
import { getD12SeasonByYear } from '~/models/d12season.server';
import { getActiveNflGames } from '~/models/nflgame.server';
import { createNflTeams } from '~/models/nflteam.server';
import { getCurrentSeason } from '~/models/season.server';

export type SyncReport = {
  synced: boolean;
  message: string;
  year?: number;
  week?: number;
  gamesInProgressBefore?: number;
  gamesInProgressAfter?: number;
  scoresResynced?: boolean;
  /** Per-league failures from the D12 sync. Empty when everything landed. */
  d12Errors?: string[];
};

/**
 * Pulls the current week's NFL game state, then resyncs every scoreboard that
 * depends on it.
 *
 * This is the single definition of "sync what's happening right now". It used
 * to exist twice - once in the scheduled monitor job and once in an API route -
 * and neither copy knew about D12, which is why the D12 leaderboard only moved
 * when an admin pressed a button.
 */
export async function syncCurrentWeekScores({
  force = false,
}: {
  /**
   * Resync scores even when no game is in progress. The scheduled job leaves
   * this off so a quiet Tuesday costs nothing, but a human pressing "resync"
   * means it - usually to pick up a Sleeper stat correction days after the
   * games ended.
   */
  force?: boolean;
} = {}): Promise<SyncReport> {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return { synced: false, message: 'No current season found, skipping sync' };
  }
  const year = currentSeason.year;

  // Games in progress before the sync. A game that finished since the last run
  // is no longer InGame afterwards, so checking only after would miss the final
  // score of the last game of the day.
  const gamesInProgressBefore = (await getActiveNflGames())._count.id;

  const nflGameState = await getNflState();
  const week = nflGameState.display_week;

  // Set up teams (required for sync)
  await createNflTeams();

  await syncNflGameWeek(year, [week]);

  const gamesInProgressAfter = (await getActiveNflGames())._count.id;
  const scoresResynced =
    force || gamesInProgressBefore > 0 || gamesInProgressAfter > 0;

  let d12Errors: string[] = [];
  if (scoresResynced) {
    await syncSleeperWeeklyScores(year, week);

    // D12 runs its own Sleeper leagues on the same NFL week, so it resyncs off
    // the same trigger. A D12 season only exists for years the game has run.
    const d12Season = await getD12SeasonByYear(year);
    if (d12Season) {
      d12Errors = await syncD12Week(year, week);
    }
  }

  return {
    synced: true,
    message: scoresResynced
      ? `Scores synced for ${year} week ${week}. Games in progress before: ${gamesInProgressBefore}, after: ${gamesInProgressAfter}`
      : `NFL game state synced for ${year} week ${week}. No games in progress, so scores were left alone.`,
    year,
    week,
    gamesInProgressBefore,
    gamesInProgressAfter,
    scoresResynced,
    d12Errors,
  };
}
