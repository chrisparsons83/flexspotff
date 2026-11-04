import { weekChangedAlert, weekOpenedAlert } from './alerts';
import { qbStreamingOpensAt } from './refresh';
import { refreshQbStreamingWeek } from './refresh.server';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import { getCurrentNflWeek, getWeekNflGames } from '~/models/nflgame.server';
import {
  createQBStreamingWeek,
  getQBStreamingWeekByYearAndWeek,
} from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';

export type QbStreamingSyncResult = {
  message: string;
  /** Set when the week changed but the admin alert about it failed to post. */
  alertError?: string;
};

/**
 * Opens and refreshes this week's QB Streaming, for the sync-qb-streaming job.
 *
 * The week is the one with the next game to kick off, so after Monday night it
 * moves on to the coming week. That week is created and opened on the first
 * run at or after 8am Eastern on the Wednesday before its first game. Checking
 * "at or after" rather than "at" means a missed or failed run is caught up by
 * the next one. After that every run refreshes it until the last game starts.
 *
 * A week an admin created by hand is refreshed the same way, but the sync only
 * opens weeks it creates, so a week an admin closed stays closed.
 */
export async function syncQbStreaming(
  now = new Date(),
): Promise<QbStreamingSyncResult> {
  const season = await getCurrentSeason();
  if (!season) return { message: 'No current season' };

  const week = await getCurrentNflWeek(season.year, now);
  if (!week) return { message: `No NFL games for ${season.year}` };

  const games = await getWeekNflGames(season.year, week);
  if (games.length === 0) return { message: `No NFL games in week ${week}` };

  const existing = await getQBStreamingWeekByYearAndWeek(season.year, week);

  if (!existing) {
    const opensAt = qbStreamingOpensAt(games[0].gameStartTime);
    if (now < opensAt) {
      return {
        message: `Week ${week} opens at ${opensAt.toISOString()}`,
      };
    }

    const created = await createQBStreamingWeek({
      year: season.year,
      week,
      isOpen: true,
      isScored: false,
    });
    const { added } = await refreshQbStreamingWeek(created, now);
    const message = `Opened week ${week} with ${added.length} QBs`;
    return {
      message,
      alertError: await alert(weekOpenedAlert(week, added)),
    };
  }

  if (existing.isScored) return { message: `Week ${week} is already scored` };
  if (games.every(game => game.gameStartTime <= now)) {
    return { message: `Every week ${week} game has started` };
  }

  const changes = await refreshQbStreamingWeek(existing, now);
  const message = `Week ${week}: ${changes.added.length} added, ${changes.restored.length} added back, ${changes.removed.length} removed`;
  const content = weekChangedAlert(week, changes);
  return {
    message,
    alertError: content ? await alert(content) : undefined,
  };
}

/**
 * Posts an admin alert, returning why it failed rather than throwing: the week
 * has already been written by then, and a Discord outage shouldn't undo it.
 */
async function alert(content: string) {
  try {
    const result = await postAdminAlert(content);
    if (result.status === 'skipped') console.warn(result.reason);
    return undefined;
  } catch (error) {
    console.error('Failed to post QB Streaming admin alert:', error);
    return error instanceof Error ? error.message : String(error);
  }
}
