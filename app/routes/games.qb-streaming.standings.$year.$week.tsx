import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import QBStreamingStandingsRowComponent from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import GoBox from '~/components/ui/GoBox';
import { getQBSelectionsByWeek } from '~/models/qbselection.server';
import type { QBStreamingStandingsRow } from '~/models/qbstreamingweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const year = params.year || `${currentSeason.year}`;
  const week = Number(params.week || '1');

  const streamingWeeks = await getQBStreamingWeeks(+year);
  const streamingWeek = streamingWeeks.find(
    streamingWeek => streamingWeek.week === week,
  );
  if (!streamingWeek) throw new Error('No streaming week found');

  const maxWeek = streamingWeeks[0].week;

  const qbSelections = await getQBSelectionsByWeek(streamingWeek.id);

  const rankings: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    rankings.push({
      discordName: qbSelection.user.discordName,
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
    maxWeek,
  });
};

export default function QBStreamingStandingsYearWeek() {
  const { qbSelections, rankings, year, week, maxWeek } =
    useTypedLoaderData<typeof loader>();

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/games/qb-streaming/standings/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>
        {year} Standings for Week {week}
      </h2>

      <div className='float-right mb-4'>
        <GoBox options={weekArray} buttonText='Choose Week' />
      </div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map(result => {
            const currentWeekPick = qbSelections.find(
              pick => pick.userId === result.userId,
            );
            const standardPlayer = !currentWeekPick
              ? 'No pick'
              : currentWeekPick.standardPlayer.nflGame.gameStartTime <
                new Date()
              ? currentWeekPick.standardPlayer.player.fullName
              : 'Pending';

            const deepPlayer = !currentWeekPick
              ? 'No pick'
              : currentWeekPick.deepPlayer.nflGame.gameStartTime < new Date()
              ? currentWeekPick.deepPlayer.player.fullName
              : 'Pending';
            return (
              <QBStreamingStandingsRowComponent
                key={result.userId}
                rank={result.rank}
                discordName={result.discordName}
                pointsScored={result.pointsScored}
                standardPlayer={standardPlayer}
                deepPlayer={deepPlayer}
              />
            );
          })}
        </tbody>
      </table>
    </>
  );
}
