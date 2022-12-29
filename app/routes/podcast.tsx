//podcasts.apple.com/ph/podcast/trash-turtle-football/id1586577488
import type { LoaderArgs } from "@remix-run/node";

import { getEpisodes } from "~/models/episode.server";
import type { Episode } from "~/models/episode.server";

import { superjson, useSuperLoaderData } from "~/utils/data";

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

export default function Records() {
  const { episodes } = useSuperLoaderData<typeof loader>();
  return (
    <div className="text-center md:text-left">
      <h2 id="Title">Trash Turtle Football</h2>

      <img
        alt="Trash Turtle Football logo"
        src="/ttflogowords.jpg"
        className="h-36 w-36 lg:w-56 lg:h-56 mx-auto md:ml-4 mb-4 float-none md:float-right"
      ></img>
      <p className="my-1 font-semibold" id="Hosts">
        DrTrashdad and Bootzfantasy
      </p>

      <p id="Decription">
        Unleashed from the iconic Flexspot Fantasy Football Discord server, Dr.
        Trashdad and Bootz bring the next generation of a fantasy football
        podcast. A conversation between a numbers and spreadsheets analyst and a
        film room or gut drafter, Bootz and Trashdad talk about fantasy relevant
        topics to help you get the edge you need in your league. Redraft,
        dynasty, bestball, and even some sportsbetting are common topics. Listen
        to us to get in-depth and less talked-about fantasy knowledge without
        the fluff.
      </p>

      {episodes.map((episode) => (
        <div key={episode.id}>
          <h3 className="mb-0">{episode.title}</h3>
          <p className="mt-1">{episode.publishDate.toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
