import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import FSquaredStandingsTable from '~/components/layout/f-squared/FSquaredStandingsTable';
import FSquaredYearPicker from '~/components/layout/f-squared/FSquaredYearPicker';
import {
  getEntryByUserAndYear,
  getFSquaredYears,
  getStandingsForYear,
} from '~/models/fsquared.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const [existingEntry, currentResults, years] = await Promise.all([
    user ? getEntryByUserAndYear(user.id, currentSeason.year) : null,
    getStandingsForYear(currentSeason.year),
    getFSquaredYears(),
  ]);

  return typedjson({ currentResults, existingEntry, currentSeason, years });
};

export default function FSquaredIndex() {
  const { currentResults, existingEntry, currentSeason, years } =
    useTypedLoaderData<typeof loader>();

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
        <FSquaredYearPicker years={years} />
        <h3>Standings</h3>
        <FSquaredStandingsTable results={currentResults} />
      </section>
    </>
  );
}
