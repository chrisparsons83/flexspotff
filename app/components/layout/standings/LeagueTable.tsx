import clsx from "clsx";

import type { GetLeaguesByYearElement } from "~/models/league.server";

type Props = {
  league: GetLeaguesByYearElement;
};

export default function LeagueTable({ league }: Props) {
  const rankColors: Record<string, string> = {
    admiral: "bg-admiral text-gray-900",
    champions: "bg-champions text-gray-900",
    dragon: "bg-dragon text-gray-900",
    galaxy: "bg-galaxy text-gray-900",
    monarch: "bg-monarch text-gray-900",
  };

  return (
    <section>
      <h3>{league.name} League</h3>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Record</th>
            <th>PF</th>
            <th>PA</th>
          </tr>
        </thead>
        <tbody>
          {league.teams.map((team, index) => (
            <tr
              key={team.id}
              className={clsx(index % 2 === 0 ? "bg-gray-900" : "bg-gray-800")}
            >
              <td>
                <div
                  className={clsx(
                    rankColors[league.name.toLocaleLowerCase()],
                    "mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm"
                  )}
                >
                  {index + 1}
                </div>
              </td>
              <td>{team.user?.discordName}</td>
              <td>
                {team.wins}-{team.losses}-{team.ties}
              </td>
              <td>{team.pointsFor}</td>
              <td>{team.pointsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
