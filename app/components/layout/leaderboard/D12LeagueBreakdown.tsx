import StarterGrid from './StarterGrid';
import type { D12LeagueTotal } from '~/models/d12weekscore.server';
import type { Player } from '~/models/players.server';

type Props = {
  byLeague: D12LeagueTotal[];
  /**
   * Show the best-ball lineup behind each team's points. Only the weekly board
   * passes this: over a whole season a team's `starters` cover one week of many,
   * so there is no single lineup to show.
   */
  showLineups?: boolean;
  /** Players behind the starter IDs, in any order. Needed with `showLineups`. */
  players?: Player[];
};

/** A manager's points split across the D12 leagues they play in. */
export default function D12LeagueBreakdown({
  byLeague,
  showLineups = false,
  players = [],
}: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>League</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {byLeague
          .slice()
          .sort((a, b) => b.points - a.points)
          .map(league => {
            const lineup =
              showLineups && league.starters.length > 0 ? (
                <tr key={`${league.leagueId}-lineup`}>
                  <td colSpan={2}>
                    <StarterGrid
                      starters={league.starters}
                      startingPlayers={players}
                      startingPlayerPoints={league.startingPlayerPoints}
                    />
                  </td>
                </tr>
              ) : null;

            return [
              <tr key={league.leagueId}>
                <td>{league.leagueName}</td>
                <td>{league.points.toFixed(2)}</td>
              </tr>,
              lineup,
            ];
          })}
      </tbody>
    </table>
  );
}
