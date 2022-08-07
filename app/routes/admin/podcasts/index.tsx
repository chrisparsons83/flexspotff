import { getEpisodes } from "~/models/episode.server";
import { superjson, useSuperLoaderData } from "~/utils/data";
import type { LoaderArgs } from "@remix-run/node";
import type { Episode } from "~/models/episode.server";
import { Link } from "@remix-run/react";

type LoaderData = {
  episodes: Episode[];
};

export const loader = async ({ request }: LoaderArgs) => {
  const episodes = await getEpisodes();

  return superjson<LoaderData>(
    { episodes },
    { headers: { "x-superjson": "true" } }
  );
};

export default function PodcastEpisodeList() {
  const { episodes } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2 className="mt-0">Podcasts</h2>
      <table className="w-full">
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
          {episodes.map((episode) => (
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
