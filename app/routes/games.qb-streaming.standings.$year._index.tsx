import type { LoaderFunctionArgs } from '@remix-run/node';
import type { ReactNode } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { qbStreamingStandingsEntry } from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { Table } from '~/components/ui/table';
import {
  QB_STREAMING_COUNTING_WEEKS,
  qbStreamingSeasonTotal,
  qbStreamingUsesTopWeeks,
  selectCountingWeeks,
} from '~/models/profile/sideGameScoring';
import {
  getQBSelectionsByWeek,
  getQBSelectionsByYear,
} from '~/models/qbselection.server';
import type { QBStreamingStandingsRow } from '~/models/qbstreamingweek.server';
import {
  getQBStreamingWeeks,
  getQBStreamingYears,
} from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { cn } from '~/utils';
import { assertSeasonHasDataOrIsCurrent } from '~/utils/standings';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const [qbStreamingWeeks, qbSelections, years] = await Promise.all([
    getQBStreamingWeeks(year),
    getQBSelectionsByYear(year),
    getQBStreamingYears(),
  ]);
  assertSeasonHasDataOrIsCurrent(
    year,
    qbStreamingWeeks.length > 0,
    currentSeason.year,
    'No QB Streaming that year',
  );

  // The best-twelve rule only applies from 2025; qbStreamingUsesTopWeeks owns
  // the cutover, shared with the profile title badges.
  if (qbStreamingUsesTopWeeks(year)) {
    // Group selections by user and week
    const userWeeklyScores = new Map<
      string,
      Array<{ week: number; score: number; weekId: string }>
    >();

    for (const qbSelection of qbSelections) {
      const userId = qbSelection.user.id;
      const weekScore =
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored;
      const week =
        qbStreamingWeeks.find(w => w.id === qbSelection.qbStreamingWeekId)
          ?.week || 0;

      if (!userWeeklyScores.has(userId)) {
        userWeeklyScores.set(userId, []);
      }

      userWeeklyScores.get(userId)!.push({
        week,
        score: weekScore,
        weekId: qbSelection.qbStreamingWeekId,
      });
    }

    // Calculate top 12 scores for each user
    const qbStreamingResults: (QBStreamingStandingsRow & {
      weeklyScores: Array<{
        week: number;
        score: number;
        countsToward: boolean;
      }>;
    })[] = [];

    for (const [userId, weeklyScores] of userWeeklyScores) {
      const user = qbSelections.find(s => s.user.id === userId)?.user;
      if (!user) continue;

      const countingWeeks = selectCountingWeeks(
        weeklyScores,
        week => week.score,
        QB_STREAMING_COUNTING_WEEKS,
      );
      const countingWeekIds = new Set(countingWeeks.map(week => week.weekId));

      const totalPoints = qbStreamingSeasonTotal(
        weeklyScores.map(week => week.score),
        year,
      );

      // Weeks that were dropped are still shown, marked as not counting.
      const weeklyScoresWithStatus = weeklyScores
        .map(ws => ({
          week: ws.week,
          score: ws.score,
          countsToward: countingWeekIds.has(ws.weekId),
        }))
        .sort((a, b) => a.week - b.week);

      qbStreamingResults.push({
        discordName: user.discordName,
        discordUsername: user.discordUsername,
        userId: user.id,
        pointsScored: totalPoints,
        weeklyScores: weeklyScoresWithStatus,
      });
    }

    const sortedResults = [...qbStreamingResults].sort((a, b) => {
      if (a.pointsScored !== b.pointsScored) {
        return b.pointsScored - a.pointsScored;
      }
      return a.discordName.localeCompare(b.discordName);
    });

    const rankArray = sortedResults.map(result => result.pointsScored);
    for (let i = 0; i < sortedResults.length; i++) {
      sortedResults[i].rank =
        rankArray.findIndex(
          result => sortedResults[i].pointsScored === result,
        ) + 1;
    }

    return typedjson({
      qbStreamingResults: sortedResults,
      currentWeekPicks: [],
      year,
      currentSeason,
      isTop12Season: true,
      years,
      weeks: qbStreamingWeeks.map(week => week.week),
      qbStreamingWeeks: qbStreamingWeeks
        .filter(week => week.isScored)
        .sort((a, b) => a.week - b.week),
    });
  }

  // Original logic for pre-2025 seasons
  const currentWeekPicks =
    qbStreamingWeeks.length > 0
      ? await getQBSelectionsByWeek(qbStreamingWeeks[0].id)
      : [];

  const qbStreamingResults: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    const existingResult = qbStreamingResults.findIndex(
      qbStreamingResult => qbStreamingResult.userId === qbSelection.user.id,
    );
    if (existingResult !== -1) {
      qbStreamingResults[existingResult].pointsScored +=
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored;
    } else {
      qbStreamingResults.push({
        discordName: qbSelection.user.discordName,
        discordUsername: qbSelection.user.discordUsername,
        userId: qbSelection.user.id,
        pointsScored:
          qbSelection.standardPlayer.pointsScored +
          qbSelection.deepPlayer.pointsScored,
      });
    }
  }

  const sortedResults = [...qbStreamingResults].sort((a, b) => {
    if (a.pointsScored !== b.pointsScored) {
      return b.pointsScored - a.pointsScored;
    }
    return a.discordName.localeCompare(b.discordName);
  });

  const rankArray = sortedResults.map(result => result.pointsScored);
  for (let i = 0; i < sortedResults.length; i++) {
    sortedResults[i].rank =
      rankArray.findIndex(result => sortedResults[i].pointsScored === result) +
      1;
  }

  return typedjson({
    qbStreamingResults: sortedResults,
    currentWeekPicks,
    year,
    currentSeason,
    isTop12Season: false,
    years,
    weeks: qbStreamingWeeks.map(week => week.week),
    qbStreamingWeeks: [],
  });
};

export default function QBStreamingStandings() {
  const {
    year,
    qbStreamingResults,
    currentWeekPicks,
    isTop12Season,
    qbStreamingWeeks,
    years,
    weeks,
  } = useTypedLoaderData<typeof loader>();

  const section = (children: ReactNode, description?: string) => (
    <StandingsSection
      base='/games/qb-streaming/standings'
      year={Number(year)}
      years={years}
      weeks={weeks}
      description={description}
    >
      {children}
    </StandingsSection>
  );

  if (isTop12Season) {
    return section(
      <Table
        headers={[
          'Rank',
          'Member',
          'Points',
          ...qbStreamingWeeks.map(week => `Week ${week.week}`),
        ]}
        numericColumns={[0, 2, ...qbStreamingWeeks.map((_, i) => i + 3)]}
        primaryColumns={[1, 2]}
        stickyHeader
      >
        {qbStreamingResults.map(result => {
          const resultWithWeekly = result as typeof result & {
            weeklyScores: Array<{
              week: number;
              score: number;
              countsToward: boolean;
            }>;
          };
          return (
            <tr key={result.userId}>
              <td className='text-right text-muted-foreground'>
                {result.rank}
              </td>
              <td>
                <ProfileLink userId={result.userId}>
                  <MemberName user={result} />
                </ProfileLink>
              </td>
              <td className='text-right font-semibold'>
                {result.pointsScored.toFixed(2)}
              </td>
              {qbStreamingWeeks.map(week => {
                const weekScore = resultWithWeekly.weeklyScores?.find(
                  ws => ws.week === week.week,
                );
                const dropped = weekScore && !weekScore.countsToward;
                return (
                  <td
                    key={week.id}
                    className={cn(
                      'text-right',
                      dropped && 'text-muted-foreground line-through',
                    )}
                    title={dropped ? 'Not one of the best 12' : undefined}
                  >
                    {weekScore ? weekScore.score.toFixed(2) : '–'}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </Table>,
      'Weeks struck through do not count.',
    );
  }

  // Before 2025 every week counted.
  return section(
    <LeaderboardTable
      entries={qbStreamingResults.map(result =>
        qbStreamingStandingsEntry({
          rank: result.rank,
          user: result,
          pointsScored: result.pointsScored,
          pick: currentWeekPicks.find(pick => pick.userId === result.userId),
        }),
      )}
      nameHeading='Member'
      valueHeadings={['Points']}
      emptyMessage='No scores yet this season.'
    />,
  );
}
