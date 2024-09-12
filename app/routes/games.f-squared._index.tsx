import type { LoaderArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import React from 'react';
import FSquaredStandingsRow from '~/components/layout/f-squared/FSquaredStandingsRow';
import type { currentResultsBase } from '~/models/fsquared.server';
import {
  getEntryByUserAndYear,
  getResultsForYear,
} from '~/models/fsquared.server';
import type { Season } from '~/models/season.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  currentResults: currentResultsBase[];
  existingEntry: Awaited<ReturnType<typeof getEntryByUserAndYear>> | null;
  currentSeason: Season;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const existingEntry = user
    ? await getEntryByUserAndYear(user.id, currentSeason.year)
    : null;

  const currentResults = (await getResultsForYear(currentSeason.year))
    .map(entry => {
      const totalPoints = entry.teams.reduce(
        (prev, curr) => prev + curr.pointsFor,
        0,
      );
      return { ...entry, totalPoints };
    })
    .sort((a, b) => {
      const pointsDiff = b.totalPoints - a.totalPoints;
      if (pointsDiff !== 0) return pointsDiff;

      return a.user.discordName.localeCompare(b.user.discordName);
    });

  // Sort the teams in each entry by league and name
  for (const entry of currentResults) {
    entry.teams.sort((a, b) => {
      if (a.league.tier !== b.league.tier) {
        return a.league.tier - b.league.tier;
      }

      return a.league.name.localeCompare(b.league.name);
    });
  }

  return superjson<LoaderData>(
    { currentResults, existingEntry, currentSeason },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function FSquaredIndex() {
  const { currentResults, existingEntry, currentSeason } =
    useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>F²</h2>
      <p>
        Pick two teams from each league before they draft. Get points based on
        how many fantasy points they earn during the season. Most combined
        points wins.
      </p>
      <div>
        <h3>My entry</h3>
        <p>Status: {existingEntry ? `Submitted` : `Not Submitted`}</p>
        <p>
          {currentSeason.isOpenForFSquared && (
            <Link to='my-entry'>View/Edit My Entry</Link>
          )}
        </p>
      </div>
      <section>
        <h3>Standings</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {currentResults.map((result, index) => (
              <FSquaredStandingsRow
                rank={index + 1}
                result={result}
                key={result.id}
              />
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
