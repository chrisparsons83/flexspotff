import type { LoaderArgs } from "@remix-run/node";
import clsx from "clsx";

import { getCupByYear } from "~/models/cup.server";
import { getCupGamesByCup } from "~/models/cupgame.server";
import { getCupWeeks } from "~/models/cupweek.server";
import { getTeamGameMultiweekTotalsSeparated } from "~/models/teamgame.server";

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

export type ScoreArray = {
  teamId: string;
  mapping: string;
  pointsScored: number;
};

type LoaderData = {
  cupGames: Awaited<ReturnType<typeof getCupGamesByCup>>;
  scoreArray: ScoreArray[];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const cup = await getCupByYear(CURRENT_YEAR);
  if (!cup) throw new Error("No cup found for this year");

  const cupGames = await getCupGamesByCup(cup.id);

  const cupWeeks = (await getCupWeeks(cup.id)).filter(
    (cupWeek) => cupWeek.mapping !== "SEEDING"
  );

  // Get all weekly scores and then map them into [{userId, ROUND_OF_64, ROUND_OF_32, etc}]
  const scores = await getTeamGameMultiweekTotalsSeparated(
    cupWeeks.map((cupWeek) => cupWeek.week)
  );

  const scoreArray: ScoreArray[] = [];
  for (const score of scores) {
    const roundToAddTo = cupWeeks.find(
      (cupWeek) => cupWeek.week === score.week
    );
    if (!roundToAddTo) {
      continue;
    }
    const index = scoreArray.findIndex(
      (player) =>
        player.teamId === score.teamId &&
        player.mapping === roundToAddTo.mapping
    );
    if (index !== -1) {
      scoreArray[index]["pointsScored"] += score.pointsScored;
    } else {
      scoreArray.push({
        teamId: score.teamId,
        mapping: roundToAddTo.mapping,
        pointsScored: score.pointsScored,
      });
    }
  }

  return superjson<LoaderData>(
    { cupGames, scoreArray },
    { headers: { "x-superjson": "true" } }
  );
};

export default function CupYear() {
  const { cupGames, scoreArray } = useSuperLoaderData<typeof loader>();

  const rankColors: Record<string, string> = {
    admiral: "bg-admiral text-gray-900",
    champions: "bg-champions text-gray-900",
    dragon: "bg-dragon text-gray-900",
    galaxy: "bg-galaxy text-gray-900",
    monarch: "bg-monarch text-gray-900",
  };

  return (
    <>
      <h2>2022 Cup</h2>
      <div className="lg:flex lg:flex-row not-prose lg:text-xs">
        {roundNameMapping.map((roundName) => {
          const gamesInRound = cupGames.filter(
            (cupGame) => cupGame.round === roundName.key
          );
          return (
            <div
              key={roundName.key}
              className="mb-8 lg:mb-0 lg:block lg:flex-1"
            >
              <h3 className="text-md font-bold lg:font-normal lg:text-center">
                {roundName.label}
              </h3>
              <ul className="grid grid-cols-2 gap-1 lg:gap-0 lg:flex lg:flex-row lg:flex-wrap lg:justify-center lg:h-full lg:min-h-full">
                {gamesInRound.map((game) => {
                  const topTeamScore = scoreArray.find(
                    (score) =>
                      score.teamId === game.topTeam?.teamId &&
                      score.mapping === roundName.key
                  )?.pointsScored;
                  const bottomTeamScore = scoreArray.find(
                    (score) =>
                      score.teamId === game.bottomTeam?.teamId &&
                      score.mapping === roundName.key
                  )?.pointsScored;

                  return (
                    <li
                      key={game.id}
                      className="lg:flex lg:flex-initial lg:flex-col lg:justify-center lg:w-full lg:p-1"
                    >
                      <div className="bg-slate-800 p-1">
                        <div
                          className={clsx(
                            game.winningTeamId === game.topTeamId &&
                              "font-bold",
                            game.losingTeamId === game.topTeamId &&
                              "text-gray-400",
                            "flex"
                          )}
                        >
                          <div className="flex-none w-1/6 min-h-[2em]">
                            {game.topTeam?.seed ? (
                              <div
                                className={clsx(
                                  rankColors[
                                    game.topTeam.team.league.name.toLocaleLowerCase()
                                  ],
                                  "md:mx-1 lg:mx-0 w-6 lg:w-5 text-center"
                                )}
                              >
                                {game.topTeam?.seed}
                              </div>
                            ) : (
                              ""
                            )}
                          </div>
                          <div className="flex-none w-1/2 overflow-hidden whitespace-nowrap text-ellipsis">
                            {game.topTeam?.team.user?.discordName}
                          </div>
                          <div className="flex-none w-1/3 text-right">
                            {topTeamScore && topTeamScore.toFixed(2)}
                          </div>
                        </div>
                        <div
                          className={clsx(
                            game.winningTeamId === game.bottomTeamId &&
                              "font-bold",
                            game.losingTeamId === game.bottomTeamId &&
                              "text-gray-500",
                            "flex"
                          )}
                        >
                          <div className="flex-none w-1/6 min-h-[1em]">
                            {game.bottomTeam?.seed ? (
                              <div
                                className={clsx(
                                  rankColors[
                                    game.bottomTeam.team.league.name.toLocaleLowerCase()
                                  ],
                                  "md:mx-1 lg:mx-0 w-6 lg:w-5 text-center"
                                )}
                              >
                                {game.bottomTeam?.seed}
                              </div>
                            ) : (
                              ""
                            )}
                          </div>
                          <div className="flex-none w-1/2 overflow-hidden whitespace-nowrap text-ellipsis">
                            {game.containsBye
                              ? "Bye"
                              : game.bottomTeam?.team.user?.discordName}
                          </div>
                          <div className="flex-none w-1/3 text-right">
                            {bottomTeamScore && bottomTeamScore.toFixed(2)}
                          </div>
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
