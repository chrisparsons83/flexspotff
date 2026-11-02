import { winnersOf } from '~/models/profile/sideGameScoring';
import type { SeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getSeasonState } from '~/models/seasonState.server';
import { getUsersByIds } from '~/models/user.server';
import { assignCompetitionRanks } from '~/utils/rank';

/** How many of each season's leaders a history page lists. */
export const HISTORY_PODIUM = 3;

export type GameHistory = Awaited<ReturnType<typeof getGameHistory>>;

/**
 * A game's past seasons and all-time titles from its season totals: each
 * season's top three, newest first, and how many finished seasons each member
 * has won. The season still being played is listed but wins nothing yet.
 */
export async function getGameHistory(totals: SeasonTotals) {
  const { inProgressYear } = await getSeasonState();

  const seasons = [...totals.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, byUser]) => ({
      year,
      inProgress: inProgressYear !== null && year >= inProgressYear,
      leaders: assignCompetitionRanks(
        [...byUser.entries()]
          .map(([userId, total]) => ({ userId, total }))
          .sort((a, b) => b.total - a.total),
        row => row.total,
      ).filter(row => row.rank <= HISTORY_PODIUM),
    }));

  const titles = new Map<string, number>();
  for (const season of seasons) {
    if (season.inProgress) continue;
    for (const winner of winnersOf(totals.get(season.year)!)) {
      titles.set(winner, (titles.get(winner) ?? 0) + 1);
    }
  }

  const userIds = new Set([
    ...seasons.flatMap(season => season.leaders.map(row => row.userId)),
    ...titles.keys(),
  ]);
  const users = await getUsersByIds([...userIds]);
  const member = (userId: string) => {
    const user = users.find(candidate => candidate.id === userId);
    return {
      id: userId,
      discordName: user?.discordName ?? 'Former member',
      discordUsername: user?.discordUsername ?? null,
    };
  };

  return {
    seasons: seasons.map(season => ({
      ...season,
      leaders: season.leaders.map(row => ({
        ...row,
        user: member(row.userId),
      })),
    })),
    titles: [...titles.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId, count]) => ({ user: member(userId), titles: count })),
  };
}

/** How many of this season's leaders a game's overview lists. */
export const OVERVIEW_LEADERS = 5;

/** The top of one season's totals, with the members' names. */
export async function getSeasonLeaders(
  totals: SeasonTotals,
  year: number,
  count = OVERVIEW_LEADERS,
) {
  const ranked = assignCompetitionRanks(
    [...(totals.get(year) ?? new Map<string, number>()).entries()]
      .map(([userId, total]) => ({ userId, total }))
      .sort((a, b) => b.total - a.total),
    row => row.total,
  ).slice(0, count);
  const users = await getUsersByIds(ranked.map(row => row.userId));
  return ranked.map(row => {
    const user = users.find(candidate => candidate.id === row.userId);
    return {
      rank: row.rank,
      total: row.total,
      user: {
        id: row.userId,
        discordName: user?.discordName ?? 'Former member',
        discordUsername: user?.discordUsername ?? null,
      },
    };
  });
}

/**
 * Where one member stands in a season's table, for listing them under the
 * leaders when they are not among them. Null when they have no total.
 */
export async function getMemberStanding(
  totals: SeasonTotals,
  year: number,
  userId: string,
) {
  const byUser = totals.get(year);
  if (!byUser?.has(userId)) return null;
  const ranked = assignCompetitionRanks(
    [...byUser.entries()]
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total),
    row => row.total,
  );
  const mine = ranked.find(row => row.id === userId)!;
  const [user] = await getUsersByIds([userId]);
  return {
    rank: mine.rank,
    total: mine.total,
    user: {
      id: userId,
      discordName: user?.discordName ?? 'Former member',
      discordUsername: user?.discordUsername ?? null,
    },
  };
}
