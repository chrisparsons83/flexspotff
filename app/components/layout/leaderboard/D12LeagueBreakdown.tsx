import StarterGrid from './StarterGrid';
import { Fragment } from 'react';
import { Table, useTableSort } from '~/components/ui/table';
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
  const { rows, sort } = useTableSort(
    byLeague,
    {
      league: league => league.leagueName,
      points: league => league.points,
    },
    { key: 'points' },
  );

  return (
    // As wide as its two columns need, not the whole row it opens in.
    <Table
      headers={['League', 'Points']}
      numericColumns={[1]}
      sortKeys={{ 0: 'league', 1: 'points' }}
      sort={sort}
      className='max-w-md'
    >
      {rows.map(league => (
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
