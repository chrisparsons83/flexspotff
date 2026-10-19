import type { LoaderFunctionArgs } from '@remix-run/node';
import { useTypedLoaderData } from 'remix-typedjson';
import { z } from 'zod';
import OmniDraftBoard from '~/components/layout/omni/OmniDraftBoard';
import { Section } from '~/components/ui/section';
import { getOmniSeason } from '~/models/omniseason.server';
import { type RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  width: 'full',
  title: 'Draft board',
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = z.string().parse(params.year);

  const season = await getOmniSeason(Number(year));
  if (!season) {
    throw new Response('No Omni that year', { status: 404 });
  }

  for (const omniTeam of season.omniTeams) {
    omniTeam.draftPicks.sort((a, b) => a.pickNumber - b.pickNumber);
  }

  season.omniTeams.sort(
    (a, b) => a.draftPicks[0].pickNumber - b.draftPicks[0].pickNumber,
  );

  return { year, season };
};

export default function OmniDraft() {
  const { season } = useTypedLoaderData<typeof loader>();

  return (
    <Section
      title='Draft board'
      description='Each pick shaded by the points it scored; red is a pick whose season ended with none.'
    >
      <OmniDraftBoard teams={season.omniTeams} />
    </Section>
  );
}
