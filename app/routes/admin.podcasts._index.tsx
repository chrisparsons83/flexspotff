import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getEpisodes } from '~/models/episode.server';
import { authenticator, requirePodcastEditor } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requirePodcastEditor(currentUser);

  const episodes = await getEpisodes();

  return typedjson({ episodes }, { headers: { 'x-superjson': 'true' } });
};

export default function PodcastEpisodeList() {
  const { episodes } = useTypedLoaderData<typeof loader>();

  return (
    <Section
      title='Podcasts'
      action={
        <Button asChild>
          <Link to='/admin/podcasts/new' variant='quiet'>
            Add podcast
          </Link>
        </Button>
      }
    >
      <Table
        headers={['Season', 'Episode', 'Title', 'Publish date', 'Actions']}
      >
        {episodes.map(episode => (
          <tr key={episode.id}>
            <td>{episode.season}</td>
            <td>{episode.episode}</td>
            <td>{episode.title}</td>
            <td>{episode.publishDate.toLocaleDateString()}</td>
            <td>
              <Link to={`./${episode.id}`}>Edit</Link>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
