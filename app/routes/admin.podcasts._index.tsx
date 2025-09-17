import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getEpisodes } from '~/models/episode.server';

export const loader = async () => {
  const episodes = await getEpisodes();

  return typedjson({ episodes }, { headers: { 'x-superjson': 'true' } });
};

export default function PodcastEpisodeList() {
  const { episodes } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2 className='mt-0'>Podcasts</h2>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Season</th>
            <th>Episode</th>
            <th>Title</th>
            <th>Publish Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </>
  );
}
