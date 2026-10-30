import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import {
  LOCKS_HEADINGS,
  locksStandingsEntry,
} from '~/components/layout/locks-challenge/LocksChallengeStandingsRow';
import { TallyBars } from '~/components/ui/bars';
import { Section } from '~/components/ui/section';
import { getLocksGamesByYearAndWeek } from '~/models/locksgame.server';
import {
  getLocksGamePicksWonLossWeek,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import {
  getLocksWeekByYearAndWeek,
  getLocksWeeksByYear,
} from '~/models/locksweek.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getUsersByIds } from '~/models/user.server';
import { getLocksWeekCutoff, isLocksWeekLocked } from '~/utils/locks';
import type { RouteHandle } from '~/utils/route-handle';
import { getCurrentTime } from '~/utils/time';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  // Get this week
  const currentWeek = await getLocksWeekByYearAndWeek(year, week);
  if (!currentWeek) throw new Response('No such week', { status: 404 });

  const now = getCurrentTime();

  // Get current picks for the week. A pick is public once its game has kicked
  // off, or once the whole week has locked at 1PM ET on its Sunday. The cutoff
  // comes from the week's full game list rather than the picks, because scoring
  // deletes the inactive pick rows and would leave a partial slate behind.
  const weekLocked = isLocksWeekLocked(
    getLocksWeekCutoff(
      (await getLocksGamesByYearAndWeek(year, week)).map(({ game }) => game),
    ),
    now,
  );
  const activePicks = (await getLocksGamesPicksByLocksWeek(currentWeek)).filter(
    locksGamePick => locksGamePick.isActive !== 0,
  );
  const weeklyPicks = activePicks.filter(
    locksGamePick =>
      locksGamePick.locksGame.game.gameStartTime < now || weekLocked,
  );

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const totalPointsRaw = await getLocksGamePicksWonLossWeek(currentWeek);

  // A single loss voids the whole week - locksWeekPoints owns that rule,
  // shared with the overall standings and the profile title badges.
  const userIdToPointsMap: Map<string, number> = new Map(
    totalPointsRaw.map(amount => [amount.userId, locksWeekPoints(amount._sum)]),
  );
  const wonLossByUserId = new Map(
    totalPointsRaw.map(point => [point.userId, point._sum]),
  );

  // Create userIdToRankMap
  let userIdToRankMap: Map<string, number> = new Map();
  const userPointsArray = Array.from(userIdToPointsMap.entries());

  // Sort by points descending, then fewest losses, then most wins, so that
  // e.g. 5-1 comes before 3-1, and 3-1 comes before 7-2.
  userPointsArray.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const aLosses = wonLossByUserId.get(a[0])?.isLoss || 0;
    const bLosses = wonLossByUserId.get(b[0])?.isLoss || 0;
    if (aLosses !== bLosses) return aLosses - bLosses;
    const aWins = wonLossByUserId.get(a[0])?.isWin || 0;
    const bWins = wonLossByUserId.get(b[0])?.isWin || 0;
    return bWins - aWins;
  });
  // Assign ranks
  let currentRank = 1;
  let currentRankPoints = -1;
  userPointsArray.forEach(([userId, points], index) => {
    // If points change, update the rank
    if (points !== currentRankPoints) {
      currentRank = index + 1;
      currentRankPoints = points;
    }
    userIdToRankMap.set(userId, currentRank);
  });

  // Get an array of user IDs, preserving the points/losses/wins sort order above
  const sortedUserIds = userPointsArray.map(([userId]) => userId);

  // Create a map of totalPoints by userId for quick lookup
  const totalPointsMap = new Map<string, any>(
    totalPointsRaw.map(point => [point.userId, point]),
  );

  const totalPoints = sortedUserIds.map(userId => totalPointsMap.get(userId));

  const userIds = [
    ...new Set(totalPointsRaw.map(locksGameSum => locksGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  // How many picked each team, from the picks already public, and how the
  // team did.
  const pickers = await getUsersByIds([
    ...new Set(weeklyPicks.map(pick => pick.userId)),
  ]);
  const byTeam = new Map<
    string,
    { label: string; who: string[]; pick: (typeof weeklyPicks)[number] }
  >();
  for (const pick of weeklyPicks) {
    const row = byTeam.get(pick.teamBetId) ?? {
      label: pick.teamBet.mascot,
      who: [],
      pick,
    };
    row.who.push(
      pickers.find(user => user.id === pick.userId)?.discordName ??
        'Former member',
    );
    byTeam.set(pick.teamBetId, row);
  }
  const distribution = {
    // Ties in the count go alphabetically.
    tallies: [...byTeam.entries()]
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([key, { label, who, pick }]) => ({
        key,
        label,
        count: who.length,
        who,
        ...(pick.isWin === 1
          ? { detail: 'Won', detailTone: 'positive' as const }
          : pick.isLoss === 1
          ? { detail: 'Lost', detailTone: 'negative' as const }
          : pick.isTie === 1
          ? { detail: 'Tied' }
          : { detail: 'Pending' }),
      })),
    hidden: activePicks.length - weeklyPicks.length,
  };

  return typedjson({
    distribution,
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    weeks: (await getLocksWeeksByYear(year)).map(
      locksWeek => locksWeek.weekNumber,
    ),
    years: await sideGameYears('locks'),
    year,
    week,
  });
};

export default function LocksWeekStandings() {
  const {
    distribution,
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    year,
    week,
    weeks,
    years,
  } = useTypedLoaderData<typeof loader>();

  const entries = totalPoints.flatMap(result => {
    const user = users.find(candidate => candidate.id === result.userId);
    return user
      ? [
          locksStandingsEntry({
            rank: userIdToRankMap.get(result.userId),
            user,
            points: userIdToPointsMap.get(result.userId),
            locksChallengeWonLoss: result,
            picksLocked: weeklyPicks?.filter(
              pick => pick.userId === result.userId,
            ),
          }),
        ]
      : [];
  });

  return (
    <>
      <StandingsSection
        base='/games/locks-challenge/standings'
        year={year}
        week={week}
        years={years}
        weeks={weeks}
      >
        <LeaderboardTable
          entries={entries}
          nameHeading='Member'
          valueHeadings={LOCKS_HEADINGS}
          emptyMessage={`No picks scored yet for week ${week}.`}
        />
      </StandingsSection>
      {(distribution.tallies.length > 0 || distribution.hidden > 0) && (
        <Section
          title='Pick Distribution'
          footnote={
            distribution.hidden > 0 &&
            `${distribution.hidden} ${
              distribution.hidden === 1 ? 'pick is' : 'picks are'
            } hidden until their games kick off or the week locks.`
          }
        >
          {distribution.tallies.length > 0 ? (
            <div className='max-w-2xl'>
              <TallyBars tallies={distribution.tallies} />
            </div>
          ) : (
            <p className='text-muted-foreground'>
              No games have kicked off yet.
            </p>
          )}
        </Section>
      )}
    </>
  );
}
