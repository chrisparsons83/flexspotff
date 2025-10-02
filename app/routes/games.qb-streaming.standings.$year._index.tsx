import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import QBStreamingStandingsRowComponent from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import {
  getQBSelectionsByWeek,
  getQBSelectionsByYear,
} from '~/models/qbselection.server';
import type { QBStreamingStandingsRow } from '~/models/qbstreamingweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year existing');
  const year = +yearParam;

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const qbStreamingWeeks = await getQBStreamingWeeks(year);
  const qbSelections = await getQBSelectionsByYear(year);

  // For 2025+ seasons, use top 12 weekly scores logic
  if (year >= 2025) {
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

      // Sort weekly scores by score descending to get top 12
      const sortedWeeklyScores = [...weeklyScores].sort(
        (a, b) => b.score - a.score,
      );
      const top12Scores = sortedWeeklyScores.slice(0, 12);
      const top12WeekIds = new Set(top12Scores.map(s => s.weekId));

      // Calculate total from top 12
      const totalPoints = top12Scores.reduce(
        (sum, score) => sum + score.score,
        0,
      );

      // Mark which weeks count toward top 12
      const weeklyScoresWithStatus = weeklyScores
        .map(ws => ({
          week: ws.week,
          score: ws.score,
          countsToward: top12WeekIds.has(ws.weekId),
        }))
        .sort((a, b) => a.week - b.week);

      qbStreamingResults.push({
        discordName: user.discordName,
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
      qbStreamingWeeks: qbStreamingWeeks
        .filter(week => week.isScored)
        .sort((a, b) => a.week - b.week),
    });
  }

  // Original logic for pre-2025 seasons
  const currentWeekPicks = await getQBSelectionsByWeek(qbStreamingWeeks[0].id);

  const qbStreamingResults: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    const existingResult = qbStreamingResults.findIndex(
      qbStreamingResult =>
        qbStreamingResult.discordName === qbSelection.user.discordName,
    );
    if (existingResult !== -1) {
      qbStreamingResults[existingResult].pointsScored +=
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored;
    } else {
      qbStreamingResults.push({
        discordName: qbSelection.user.discordName,
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
    qbStreamingWeeks: [],
  });
};

export default function QBStreamingStandingsYearIndex() {
  const {
    year,
    qbStreamingResults,
    currentWeekPicks,
    currentSeason,
    isTop12Season,
    qbStreamingWeeks,
  } = useTypedLoaderData<typeof loader>();

  const displayYear = +year !== currentSeason.year ? year : '';

  if (isTop12Season) {
    return (
      <>
        <h2>{displayYear} Overall Standings</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
              {qbStreamingWeeks.map(week => (
                <th key={week.id}>W{week.week}</th>
              ))}
            </tr>
          </thead>
          <tbody>
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
                  <td>{result.rank}</td>
                  <td>{result.discordName}</td>
                  <td>{result.pointsScored.toFixed(2)}</td>
                  {qbStreamingWeeks.map(week => {
                    const weekScore = resultWithWeekly.weeklyScores?.find(
                      ws => ws.week === week.week,
                    );
                    return (
                      <td
                        key={week.id}
                        className={
                          weekScore && !weekScore.countsToward
                            ? 'text-gray-400'
                            : ''
                        }
                        title={
                          weekScore && !weekScore.countsToward
                            ? 'Does not count toward top 12'
                            : ''
                        }
                      >
                        {weekScore ? weekScore.score.toFixed(2) : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  }

  // Original rendering for pre-2025 seasons
  return (
    <>
      <h2>{displayYear} Overall Standings</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingResults.map(result => {
            const currentWeekPick = currentWeekPicks.find(
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
