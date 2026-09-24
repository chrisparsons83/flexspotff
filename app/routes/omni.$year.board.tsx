import type { LoaderFunctionArgs } from '@remix-run/node';
import { useTypedLoaderData } from 'remix-typedjson';
import { z } from 'zod';
import OmniDraftBoard from '~/components/layout/omni/OmniDraftBoard';
import { getOmniSeason } from '~/models/omniseason.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = z.string().parse(params.year);

  const season = await getOmniSeason(Number(year));
  if (!season) {
    throw new Error(`No season found for year ${year}`);
  }

  for (const omniTeam of season.omniTeams) {
    omniTeam.draftPicks.sort((a, b) => a.pickNumber - b.pickNumber);
  }

  season.omniTeams.sort(
    (a, b) => a.draftPicks[0].pickNumber - b.draftPicks[0].pickNumber,
  );

  return { year, season };
};

const OmniYearDraftboard = () => {
  const { year, season } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h2>Omni Draftboard for {year}</h2>
      <OmniDraftBoard teams={season.omniTeams} />
    </div>
  );
};

export default OmniYearDraftboard;
