import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import PoolCards from '~/components/layout/survivor/PoolCards';
import { EmptyState } from '~/components/ui/empty-state';
import { ExternalLink } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import { getSurvivorPools } from '~/libs/survivor/pools.server';
import { poolTitle } from '~/libs/survivor/views';

/** This season's pools. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);
  const { years } = await getSurvivorPools();
  return typedjson({ current: years[0] ?? null });
};

export default function SurvivorOverview() {
  const { current } = useTypedLoaderData<typeof loader>();
  if (!current)
    return (
      <EmptyState title='No survivor pools yet'>
        A pool appears here once it is set up on Sleeper.
      </EmptyState>
    );

  const open = current.pools.find(pool => pool.inviteUrl);

  return (
    <Section
      title={`${current.year} pools`}
      description={open ? `${poolTitle(open)} is running.` : undefined}
      action={
        open?.inviteUrl && (
          <ExternalLink href={open.inviteUrl} target='_blank'>
            Join on Sleeper
          </ExternalLink>
        )
      }
    >
      <PoolCards pools={current.pools} />
    </Section>
  );
}
