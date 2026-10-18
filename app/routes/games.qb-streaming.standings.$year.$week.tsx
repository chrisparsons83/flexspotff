import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { qbStreamingStandingsEntry } from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import { getQBSelectionsByWeek } from '~/models/qbselection.server';
import type { QBStreamingStandingsRow } from '~/models/qbstreamingweek.server';
import {
  getQBStreamingWeeks,
  getQBStreamingYears,
} from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const year = Number(params.year || currentSeason.year);
  const week = Number(params.week || '1');

  const [streamingWeeks, years] = await Promise.all([
    getQBStreamingWeeks(year),
    getQBStreamingYears(),
  ]);
  const streamingWeek = streamingWeeks.find(
    streamingWeek => streamingWeek.week === week,
  );
  if (!streamingWeek) throw new Response('No such week', { status: 404 });

  const qbSelections = await getQBSelectionsByWeek(streamingWeek.id);

  const rankings: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    rankings.push({
      discordName: qbSelection.user.discordName,
      discordUsername: qbSelection.user.discordUsername,
      pointsScored:
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored,
      userId: qbSelection.userId,
    });
  }

  rankings.sort((a, b) => b.pointsScored - a.pointsScored);

  const rankingScoreArray = rankings.map(ranking => ranking.pointsScored);

  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank =
      rankingScoreArray.findIndex(
        rankingScore => rankingScore === rankings[i].pointsScored,
      ) + 1;
  }

  return typedjson({
    qbSelections,
    rankings,
    year,
    week,
    weeks: streamingWeeks.map(streamingWeek => streamingWeek.week),
    years,
  });
};

export default function QBStreamingWeekStandings() {
  const { qbSelections, rankings, year, week, weeks, years } =
    useTypedLoaderData<typeof loader>();

  return (
    <StandingsSection
      base='/games/qb-streaming/standings'
      year={year}
      week={week}
      years={years}
      weeks={weeks}
    >
      <LeaderboardTable
        entries={rankings.map(result =>
          qbStreamingStandingsEntry({
            rank: result.rank,
            user: result,
            pointsScored: result.pointsScored,
            pick: qbSelections.find(pick => pick.userId === result.userId),
          }),
        )}
        nameHeading='Member'
        valueHeadings={['Points']}
        emptyMessage={`No scores yet for week ${week}.`}
      />
    </StandingsSection>
  );
}
