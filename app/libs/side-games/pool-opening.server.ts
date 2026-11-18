import { fetchSpreadLinesResult } from './pool-odds.server';
import type { SpreadLinesFailureReason } from './pool-odds.server';
import type { SideGameOpener, SideGameOpenOutcome } from './types';
import { sideGameWeekOpensAt } from './weeks';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import { getWeekNflGames } from '~/models/nflgame.server';
import type { PoolLine, PoolWeek } from '~/models/poolweek.server';
import {
  createAndOpenPoolWeek,
  createClosedPoolWeekWithLines,
  getPoolWeekByYearAndWeek,
  markPoolWeekOpenAlerted,
  openPoolWeekWithLines,
  writeClosedPoolWeekLines,
} from '~/models/poolweek.server';
import { LAST_AUTOMATED_WEEK } from '~/utils/helpers';

/**
 * The Spread Pool half of the opening phase.
 *
 * It opens at 8am Eastern on the Tuesday before the week's first kickoff, like
 * Locks, but only once every NFL game of the week has a line. Until then it
 * writes the lines it has into a closed, automation-owned week and retries on
 * the next run, so an admin can see the partial week and finish it by hand.
 *
 * The first failed attempt posts one admin alert naming the reason and records
 * `openAlertedAt`; later retries stay quiet. Opening the week clears the
 * marker, so a failure later in the same season can alert again. A week an
 * admin owns is left completely alone: no odds call, no writes.
 */
export const spreadPoolOpener: SideGameOpener = {
  game: 'Spread Pool',
  async openWeek(year, week, firstGameStart, now) {
    if (week > LAST_AUTOMATED_WEEK) return { status: 'skipped' };
    if (firstGameStart <= now) return { status: 'skipped' };
    if (now < sideGameWeekOpensAt(firstGameStart)) {
      return { status: 'skipped' };
    }

    const existing = await getPoolWeekByYearAndWeek(year, week);
    if (
      existing &&
      (existing.isOpen || existing.isWeekScored || !existing.autoManaged)
    ) {
      return { status: 'skipped' };
    }

    const nflGames = await getWeekNflGames(year, week);
    if (nflGames.length === 0) return { status: 'skipped' };

    const odds = await fetchSpreadLinesResult(nflGames);
    if (!odds.ok) {
      // The marker lives on the week, so a due week needs a row even when the
      // odds call failed; it is also the partial week an admin can finish.
      const poolWeek =
        existing ?? (await createClosedPoolWeekWithLines(year, week, []));

      return failOpen(poolWeek, oddsFailureReason(odds.reason), week);
    }

    const lines: PoolLine[] = [];
    for (const game of nflGames) {
      const spread = odds.linesByTeam.get(game.homeTeam.name);
      if (spread !== undefined) {
        lines.push({ gameId: game.id, homeSpread: spread });
      }
    }

    if (lines.length < nflGames.length) {
      const poolWeek = existing
        ? await writeClosedPoolWeekLines(existing, lines)
        : await createClosedPoolWeekWithLines(year, week, lines);

      return failOpen(
        poolWeek,
        missingLineReason(nflGames.length - lines.length),
        week,
      );
    }

    if (existing) {
      await openPoolWeekWithLines(existing, lines);
    } else {
      await createAndOpenPoolWeek(year, week, lines);
    }

    return { status: 'opened', detail: lineCount(lines.length) };
  },
};

/**
 * Posts the one first-failure alert and records it. The alert comes after the
 * week's write, and a failed post only becomes a warning: the partial week and
 * the marker must survive a Discord outage.
 */
async function failOpen(
  poolWeek: PoolWeek,
  reason: string,
  week: number,
): Promise<SideGameOpenOutcome> {
  if (poolWeek.openAlertedAt) return { status: 'skipped' };

  let warning: string | undefined;
  try {
    const result = await postAdminAlert(
      `**Spread Pool** week ${week} failed to open: ${reason}`,
    );
    if (result.status === 'skipped') console.warn(result.reason);
  } catch (error) {
    warning = `Admin alert failed for Spread Pool week ${week}: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }

  await markPoolWeekOpenAlerted(poolWeek);
  return warning ? { status: 'skipped', warning } : { status: 'skipped' };
}

function oddsFailureReason(reason: SpreadLinesFailureReason) {
  return reason.kind === 'missing-api-key'
    ? 'SPREADS_API_KEY is missing.'
    : reason.message;
}

function missingLineReason(count: number) {
  return `${count} ${count === 1 ? 'game has' : 'games have'} no line.`;
}

function lineCount(count: number) {
  return `${count} ${count === 1 ? 'game has' : 'games have'} lines`;
}
