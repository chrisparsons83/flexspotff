import type { LoaderArgs } from "@remix-run/node";
import clsx from "clsx";

import { getAverageDraftPositionByYear } from "~/models/draftpick.server";
import { getLeaguesByYear } from "~/models/league.server";
import type { Player } from "~/models/players.server";
import { getPlayersByIDs } from "~/models/players.server";
import { getCurrentSeason } from "~/models/season.server";

import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  adp: Awaited<ReturnType<typeof getAverageDraftPositionByYear>>;
  playersMap: Map<string, Player>;
  year: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const year =
    params["*"] === ""
      ? currentSeason.year
      : Number.parseInt(params["*"] || "");

  const leagueCount = (await getLeaguesByYear(year)).filter(
    (league) => league.isDrafted
  ).length;
  const adp = await getAverageDraftPositionByYear(year);
  const players = await getPlayersByIDs(adp.map((player) => player.playerId));

  // Creating a map for speed purposes
  const playersMap: Map<string, Player> = new Map();
  for (const player of players) {
    playersMap.set(player.id, player);
  }

  for (const position of adp) {
    if (position._count.pickNumber !== leagueCount) {
      // Do some math if we have undrafted people
      position._max.pickNumber = 181;
      // Basically, we're reaveraging and counting undrafted as pick 180.
      // Setting undrafted to 181 makes for some weird numbers at the bottom, with an average draft
      // position worst than the actual number of picks. There isn't a great way to solve this but
      // we've picked a way, I think.
      position._avg.pickNumber =
        (position._avg.pickNumber! * position._count.pickNumber +
          180 * (leagueCount - position._count.pickNumber)) /
        leagueCount;
    }
  }

  return superjson<LoaderData>(
    { adp, playersMap, year },
    { headers: { "x-superjson": "true" } }
  );
};

export default function ADP() {
  const { adp, playersMap, year } = useSuperLoaderData<typeof loader>();

  // We do this because tailwind HATES dynamic class names
  const rankColors: Record<string, string> = {
    qb: "bg-qb",
    rb: "bg-rb",
    wr: "bg-wr",
    te: "bg-te",
    def: "bg-def",
  };

  return (
    <div>
      <h2>{year} Server ADP</h2>
      {adp.length === 0 ? (
        <div>To be loaded once leagues have started drafting.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Player</th>
              <th>Position</th>
              <th>ADP</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {adp.map((adpPlayer, index) => {
              const playerInfo = playersMap.get(adpPlayer.playerId);
              return (
                <tr
                  key={adpPlayer.playerId}
                  className={clsx(
                    index % 2 === 0 ? "bg-gray-900" : "bg-gray-800",
                    "p-2"
                  )}
                >
                  <td className="pl-1">
                    <div
                      className={clsx(
                        rankColors[playerInfo!.position!.toLowerCase()],
                        "mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm"
                      )}
                    >
                      {index + 1}
                    </div>
                  </td>
                  <td>{playerInfo?.fullName}</td>
                  <td>{playerInfo?.position}</td>
                  <td>{adpPlayer._avg.pickNumber?.toFixed(1)}</td>
                  <td>{adpPlayer._min.pickNumber}</td>
                  <td>
                    {adpPlayer._max.pickNumber === 181
                      ? "UD"
                      : adpPlayer._max.pickNumber}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
