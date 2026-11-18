import { locksChallengeOpener } from './locks-opening.server';
import { locksChallengeScorer } from './locks.server';
import { spreadPoolOpener } from './pool-opening.server';
import { poolScorer } from './pool.server';
import type {
  SideGameAction,
  SideGameOpener,
  SideGameScorer,
  SideGameSyncReport,
} from './types';
import { scoringCandidateWeeks } from './weeks';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { getCurrentNflWeek, getWeekNflGames } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { LAST_AUTOMATED_WEEK } from '~/utils/helpers';

/**
 * The scoring phase's per-game modules, one line per game. #259 adds QB
 * Streaming and DFS Survivor here; each module owns its own eligibility rule
 * and writes.
 */
const SCORING_GAMES: SideGameScorer[] = [locksChallengeScorer, poolScorer];

/**
 * The opening phase's per-game modules, one line per game. Each module owns
 * its own eligibility rule and writes.
 */
const OPENING_GAMES: SideGameOpener[] = [
  locksChallengeOpener,
  spreadPoolOpener,
];

/**
 * Converges the weekly side games on `now`: scores what is due, then opens what
 * is due, and reports what it did so the job runner can log and fail the run.
 *
 * Both jobs are thin wrappers over this, so the Monday-night scoring cadence and
 * the Tuesday-morning opening one cannot disagree about a week. Without a
 * current season there is nothing to converge and the function says so.
 */
export async function syncSideGameWeeks(
  now = new Date(),
): Promise<SideGameSyncReport> {
  const report: SideGameSyncReport = {
    message: '',
    scored: [],
    opened: [],
    warnings: [],
    errors: [],
  };

  const season = await getCurrentSeason();
  if (!season) {
    report.message = 'No current season';
    return report;
  }

  const currentWeek = await getCurrentNflWeek(season.year, now);

  await scoreDueWeeks(season.year, scoringCandidateWeeks(currentWeek), report);
  await openDueWeeks(season.year, currentWeek, now, report);

  report.message = summarise(report);
  return report;
}

/**
 * Scores every candidate week each game still owes a score for. A game that is
 * not due skips itself; a game that throws is reported without stopping the
 * others, so one broken side game cannot leave the rest unscored.
 */
async function scoreDueWeeks(
  year: number,
  weeks: number[],
  report: SideGameSyncReport,
) {
  for (const week of weeks) {
    for (const game of SCORING_GAMES) {
      let action: SideGameAction;
      try {
        const outcome = await game.scoreWeek(year, week);
        if (outcome.status !== 'scored') continue;

        action = { game: game.game, week };
        if (outcome.detail) action.detail = outcome.detail;
      } catch (error) {
        report.errors.push(`${game.game} week ${week}: ${errorMessage(error)}`);
        continue;
      }

      report.scored.push(action);
      await alertScored(action, report);
    }
  }
}

/**
 * The opening phase runs after scoring, so a Tuesday-morning run settles the
 * week just finished before opening the next one.
 *
 * Only the coming NFL week is considered, within weeks 1-17. The stored
 * schedule decides which week that is: normally `getCurrentNflWeek` already
 * points at the next week, but on the Tuesday morning before its slate has been
 * stored it still points at the finished week, and every one of those games has
 * kicked off. Then the next week is the coming one, because NFL weeks are
 * contiguous.
 *
 * That week's slate is synced before it is opened and then re-read, so the
 * opener does not depend on anyone having pressed "Resync NFL Games". A game
 * that throws is reported without stopping the others, mirroring scoring.
 */
async function openDueWeeks(
  year: number,
  currentWeek: number | null,
  now: Date,
  report: SideGameSyncReport,
) {
  if (currentWeek === null || currentWeek > LAST_AUTOMATED_WEEK) return;

  const week = await comingNflWeek(year, currentWeek, now);
  if (week === null || week > LAST_AUTOMATED_WEEK) return;

  await syncNflGameWeek(year, [week]);
  const games = await getWeekNflGames(year, week);
  if (games.length === 0) return;

  const firstGameStart = games[0].gameStartTime;

  for (const game of OPENING_GAMES) {
    let action: SideGameAction;
    try {
      const outcome = await game.openWeek(year, week, firstGameStart, now);
      // A module reports non-fatal trouble itself, such as a first-failure
      // alert it could not post; the writes it made must still stand.
      if (outcome.warning) report.warnings.push(outcome.warning);
      if (outcome.status !== 'opened') continue;

      action = { game: game.game, week };
      if (outcome.detail) action.detail = outcome.detail;
    } catch (error) {
      report.errors.push(`${game.game} week ${week}: ${errorMessage(error)}`);
      continue;
    }

    report.opened.push(action);
    await alertOpened(action, report);
  }
}

/**
 * The week the opener should consider: normally the current NFL week, or the
 * one after it when the current week has no stored games or has entirely
 * kicked off.
 */
async function comingNflWeek(
  year: number,
  currentWeek: number,
  now: Date,
): Promise<number | null> {
  const games = await getWeekNflGames(year, currentWeek);
  const finished =
    games.length === 0 || games.every(game => game.gameStartTime <= now);

  return finished ? currentWeek + 1 : currentWeek;
}

/**
 * Posts one alert per opened week. The week is already written by then, so a
 * Discord outage is a warning in the report rather than a failure that would
 * undo the open.
 */
async function alertOpened(action: SideGameAction, report: SideGameSyncReport) {
  const detail = action.detail ? ` ${action.detail}` : '';

  try {
    const result = await postAdminAlert(
      `**${action.game}** week ${action.week} has been opened.${detail}`,
    );
    if (result.status === 'skipped') console.warn(result.reason);
  } catch (error) {
    report.warnings.push(
      `Admin alert failed for ${action.game} week ${
        action.week
      }: ${errorMessage(error)}`,
    );
  }
}

/**
 * Posts one alert per scored week. The week is already written by then, so a
 * Discord outage is a warning in the report rather than a failure that would
 * undo the score.
 */
async function alertScored(action: SideGameAction, report: SideGameSyncReport) {
  const detail = action.detail ? ` ${action.detail}` : '';

  try {
    const result = await postAdminAlert(
      `**${action.game}** week ${action.week} has been scored.${detail}`,
    );
    if (result.status === 'skipped') console.warn(result.reason);
  } catch (error) {
    report.warnings.push(
      `Admin alert failed for ${action.game} week ${
        action.week
      }: ${errorMessage(error)}`,
    );
  }
}

function summarise(report: SideGameSyncReport) {
  const parts = [
    report.scored.length && `scored ${report.scored.length} weeks`,
    report.opened.length && `opened ${report.opened.length} weeks`,
    report.errors.length && `${report.errors.length} errors`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Nothing to do';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
