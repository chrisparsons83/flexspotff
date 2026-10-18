import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { ExternalLink, Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { getAllOmniSeasons } from '~/models/omniseason.server';
import { BRACKT_URL } from '~/utils/brackt';

export const loader = async () => {
  const seasons = await getAllOmniSeasons();
  return typedjson({ years: seasons.map(season => season.year) });
};

export default function OmniArchive() {
  const { years } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Omni'
        description='Omni now runs on Brackt. These are the seasons played here.'
        actions={
          BRACKT_URL && (
            <ExternalLink href={BRACKT_URL} target='_blank'>
              This season on Brackt
            </ExternalLink>
          )
        }
      />
      {years.length === 0 ? (
        <EmptyState title='No Omni seasons yet' />
      ) : (
        <ul className='grid gap-2 text-xl font-bold'>
          {years.map(year => (
            <li key={year}>
              <Link to={`/games/omni/${year}`}>{year}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
