import { typedjson } from 'remix-typedjson';
import type { ScoreArray } from '~/models/cup.server';
import { getCupByYear } from '~/models/cup.server';
import { getCupGamesByCup } from '~/models/cupgame.server';
import { getCupWeeks } from '~/models/cupweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamGameMultiweekTotalsSeparated } from '~/models/teamgame.server';
import { assertSeasonHasDataOrIsCurrent } from '~/utils/standings';

export type CupBracketData = Awaited<ReturnType<typeof getCupBracket>>;

/**
 * A year's cup games, each team's score per round and the weeks each round
 * is scored over, or null when that year has no cup. A round can span
 * several weeks, so a team's score for it is the sum of its weeks.
 */
export async function getCupBracket(year: number) {
  const cup = await getCupByYear(year);
  if (!cup) return null;

  const [cupGames, allCupWeeks] = await Promise.all([
    getCupGamesByCup(cup.id),
    getCupWeeks(cup.id),
  ]);
  const cupWeeks = allCupWeeks.filter(cupWeek => cupWeek.mapping !== 'SEEDING');

  const scores = await getTeamGameMultiweekTotalsSeparated(
    cupWeeks.map(cupWeek => cupWeek.week),
    cup.year,
  );

  const scoreArray: ScoreArray[] = [];
  for (const score of scores) {
    const round = cupWeeks.find(cupWeek => cupWeek.week === score.week);
    if (!round) continue;
    const existing = scoreArray.find(
      entry => entry.teamId === score.teamId && entry.mapping === round.mapping,
    );
    if (existing) {
      existing.pointsScored += score.pointsScored;
    } else {
      scoreArray.push({
        teamId: score.teamId,
        mapping: round.mapping,
        pointsScored: score.pointsScored,
      });
    }
  }

  // The NFL weeks each round is scored over, in order.
  const weeksByRound: Record<string, number[]> = {};
  for (const cupWeek of [...cupWeeks].sort((a, b) => a.week - b.week)) {
    (weeksByRound[cupWeek.mapping] ??= []).push(cupWeek.week);
  }

  return { cupGames, scoreArray, weeksByRound };
}

/** A year's cup page, for /leagues/cup and /leagues/cup/:year. */
export async function loadCupPage(year: number) {
  const [currentSeason, bracket] = await Promise.all([
    getCurrentSeason(),
    getCupBracket(year),
  ]);
  assertSeasonHasDataOrIsCurrent(
    year,
    !!bracket,
    currentSeason?.year,
    'No cup that year',
  );
  return typedjson({
    year,
    bracket,
  });
}
