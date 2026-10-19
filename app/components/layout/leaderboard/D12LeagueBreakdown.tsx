import StarterGrid from './StarterGrid';
import { Fragment } from 'react';
import { Table } from '~/components/ui/table';
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
    <Table headers={['League', 'Points']} numericColumns={[1]}>
      {byLeague
        .slice()
        .sort((a, b) => b.points - a.points)
        .map(league => (
          <Fragment key={league.leagueId}>
            <tr>
              <td>{league.leagueName}</td>
              <td className='text-right'>{league.points.toFixed(2)}</td>
            </tr>
            {showLineups && league.starters.length > 0 && (
              <tr>
                <td colSpan={2}>
                  <StarterGrid
                    starters={league.starters}
                    startingPlayers={players}
                    startingPlayerPoints={league.startingPlayerPoints}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
    </Table>
  );
}
