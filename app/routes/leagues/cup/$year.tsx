import type { LoaderArgs } from "@remix-run/node";

import { getCupByYear } from "~/models/cup.server";
import { getCupGamesByCup } from "~/models/cupgame.server";

import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type RoundName = {
  key: string;
  label: string;
};
const roundNameMapping: RoundName[] = [
  { key: "ROUND_OF_64", label: "Round of 64" },
  { key: "ROUND_OF_32", label: "Round of 32" },
  { key: "ROUND_OF_16", label: "Round of 16" },
  { key: "ROUND_OF_8", label: "Quarterfinals" },
  { key: "ROUND_OF_4", label: "Semifinals" },
  { key: "ROUND_OF_2", label: "Finals" },
];

const trimName = (name: string | undefined): string => {
  if (!name) return "";
  if (name.length <= 16) return name;

  return name.slice(0, 14) + "...";
};

type LoaderData = {
  cupGames: Awaited<ReturnType<typeof getCupGamesByCup>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const cup = await getCupByYear(CURRENT_YEAR);
  if (!cup) throw new Error("No cup found for this year");

  const cupGames = await getCupGamesByCup(cup.id);

  return superjson<LoaderData>(
    { cupGames },
    { headers: { "x-superjson": "true" } }
  );
};

export default function CupYear() {
  const { cupGames } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>2022 Cup</h2>
      <div className="flex flex-row not-prose text-xs">
        {roundNameMapping.map((roundName) => {
          const gamesInRound = cupGames.filter(
            (cupGame) => cupGame.round === roundName.key
          );
          console.log(gamesInRound);
          return (
            <div key={roundName.key} className="block flex-1">
              <h3 className="text-center">{roundName.label}</h3>
              <ul className="flex flex-row flex-wrap justify-center h-full min-h-full">
                {gamesInRound.map((game) => {
                  console.log(game);
                  return (
                    <li
                      key={game.id}
                      className="flex flex-initial flex-col justify-center w-full p-1"
                    >
                      <div className="game bg-slate-800 p-1">
                        <div className="flex font-bold">
                          <div className="basis-1/6">{game.topTeam?.seed}</div>
                          <div className="basis-1/2">
                            {trimName(game.topTeam?.team.user?.discordName)}
                          </div>
                          <div className="basis-1/3 text-right">200.32</div>
                        </div>
                        <div className="flex text-gray-400">
                          <div className="basis-1/6">
                            {game.bottomTeam?.seed}
                          </div>
                          <div className="basis-1/2">
                            {game.containsBye
                              ? "Bye"
                              : trimName(
                                  game.bottomTeam?.team.user?.discordName
                                )}
                          </div>
                          <div className="basis-1/3 text-right">132.25</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
