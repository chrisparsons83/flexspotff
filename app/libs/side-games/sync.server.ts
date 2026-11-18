import { dfsSurvivorScorer } from './dfs-survivor.server';
import { locksChallengeScorer } from './locks.server';
import { poolScorer } from './pool.server';
import { qbStreamingScorer } from './qb-streaming.server';
import type {
  SideGameAction,
  SideGameScorer,
  SideGameSyncReport,
} from './types';
import { scoringCandidateWeeks } from './weeks';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';

/**
 * The scoring phase's per-game modules, one line per game. Each module owns its
 * own eligibility rule and writes.
 */
const SCORING_GAMES: SideGameScorer[] = [
  locksChallengeScorer,
  poolScorer,
  qbStreamingScorer,
  dfsSurvivorScorer,
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
      let warning: string | undefined;
      try {
        const outcome = await game.scoreWeek(year, week);
        if (outcome.status !== 'scored') continue;

        action = { game: game.game, week };
        if (outcome.detail) action.detail = outcome.detail;
        warning = outcome.warning;
      } catch (error) {
        report.errors.push(`${game.game} week ${week}: ${errorMessage(error)}`);
        continue;
      }

      report.scored.push(action);
      if (warning) {
        report.warnings.push(`${game.game} week ${week}: ${warning}`);
      }
      await alertScored(action, report);
    }
  }
}

/**
 * The opening phase runs after scoring, so a Tuesday-morning run settles the
 * week just finished before opening the next one.
 *
 * Opening ships in #260: it adds the per-game opening modules and opens only the
 * current NFL week, within weeks 1-17, once the clock passes 8am Eastern on the
 * Tuesday before that week's first kickoff.
 */
async function openDueWeeks(
  _year: number,
  _currentWeek: number | null,
  _now: Date,
  _report: SideGameSyncReport,
) {
  // No-op until #260.
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
