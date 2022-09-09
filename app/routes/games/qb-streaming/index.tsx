import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import {
  getQBSelectionsByWeek,
  getQBSelectionsByYear,
} from "~/models/qbselection.server";
import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";
import type { User } from "~/models/user.server";

import QBStreamingStandingsRowComponent from "~/components/layout/qb-streaming/QBStreamingStandingsRow";
import { authenticator } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

export type QBStreamingStandingsRow = {
  rank?: number;
  discordName: User["discordName"];
  userId: User["id"];
  pointsScored: number;
};

type LoaderData = {
  user: User;
  qbStreamingWeeks: Awaited<ReturnType<typeof getQBStreamingWeeks>>;
  qbStreamingResults: QBStreamingStandingsRow[];
  currentWeekPicks: Awaited<ReturnType<typeof getQBSelectionsByWeek>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const qbStreamingWeeks = await getQBStreamingWeeks(CURRENT_YEAR);

  const qbSelections = await getQBSelectionsByYear(CURRENT_YEAR);

  const currentWeekPicks = await getQBSelectionsByWeek(qbStreamingWeeks[0].id);

  const qbStreamingResults: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    const existingResult = qbStreamingResults.findIndex(
      (qbStreamingResult) =>
        qbStreamingResult.discordName === qbSelection.user.discordName
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

  const sortedResults = [...qbStreamingResults].sort(
    (a, b) => b.pointsScored - a.pointsScored
  );
  for (let i = 0; i < qbStreamingResults.length; i++) {
    qbStreamingResults[i].rank =
      sortedResults.findIndex(
        (result) => result.discordName === qbStreamingResults[i].discordName
      ) + 1;
  }

  return superjson<LoaderData>(
    { user, qbStreamingWeeks, qbStreamingResults, currentWeekPicks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingIndex() {
  const { qbStreamingWeeks, qbStreamingResults, currentWeekPicks } =
    useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>QB Streaming Challenge</h2>
      <h3>Rules</h3>
      <p>
        Each week, pick two low-rostered QBs to stream from the available lists
        given. Earn points based on the following point system:
      </p>
      <ul>
        <li>0.04 per passing yard</li>
        <li>0.1 per rushing/receiving yard</li>
        <li>4 points per passing TD</li>
        <li>6 points per rushing/receiving TD</li>
        <li>-2 per interception/fumble</li>
        <li>2 per 2-point conversion</li>
      </ul>
      <p>Highest score at the end of the season wins.</p>
      <h3>My Entries</h3>
      <ul>
        {qbStreamingWeeks.map((qbStreamingWeek) => (
          <li key={qbStreamingWeek.id}>
            <Link to={`./${qbStreamingWeek.id}`}>
              Week {qbStreamingWeek.week}
            </Link>
          </li>
        ))}
      </ul>
      <h3>Overall Standings</h3>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingResults.map((result) => {
            const currentWeekPick = currentWeekPicks.find(
              (pick) => pick.userId === result.userId
            );
            const standardPlayer = !currentWeekPick
              ? "No pick"
              : currentWeekPick.standardPlayer.nflGame.gameStartTime <
                new Date()
              ? currentWeekPick.standardPlayer.player.fullName
              : "Pending";

            const deepPlayer = !currentWeekPick
              ? "No pick"
              : currentWeekPick.deepPlayer.nflGame.gameStartTime < new Date()
              ? currentWeekPick.deepPlayer.player.fullName
              : "Pending";
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
