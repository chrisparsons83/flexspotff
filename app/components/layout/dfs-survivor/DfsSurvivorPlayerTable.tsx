import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import type { DfsSurvivorSlot } from '~/libs/dfs-survivor/slots';
import { SLOT_POSITIONS } from '~/libs/dfs-survivor/slots';
import type { PickerPlayer } from '~/routes/games.dfs-survivor.entries._index';

type SortKey =
  | 'name'
  | 'teamAbbr'
  | 'opponentAbbr'
  | 'projection'
  | 'seasonPoints';

type Props = {
  players: PickerPlayer[];
  activeSlot: DfsSurvivorSlot;
  selectedWeek: number;
  /** Player IDs already in this week's lineup, including unsaved picks. */
  lineupPlayerIds: Set<string>;
  onSelectPlayer: (player: PickerPlayer) => void;
};

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'teamAbbr', label: 'Team', align: 'left' },
  { key: 'opponentAbbr', label: 'Opp', align: 'left' },
  { key: 'projection', label: 'Proj', align: 'right' },
  { key: 'seasonPoints', label: 'Season', align: 'right' },
];

/** A filter toggle styled to match the week rail, not the browser default. */
function FilterToggle({
  checked,
  onChange,
  className,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'border px-2 py-1 text-sm transition-colors',
        className,
        checked
          ? 'border-primary-edge bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The player picker. Replaces eleven 200px name-only dropdowns with one wide
 * table you can actually judge a pick from: matchup, this week's projection,
 * season points to date, and a clear marker on anyone already burned.
 */
export default function DfsSurvivorPlayerTable({
  players,
  activeSlot,
  selectedWeek,
  lineupPlayerIds,
  onSelectPlayer,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('projection');
  const [sortDescending, setSortDescending] = useState(true);
  const [hideUsed, setHideUsed] = useState(false);
  const [hideByes, setHideByes] = useState(true);

  const eligiblePositions = SLOT_POSITIONS[activeSlot];
  // Only worth labelling each row's position when the slot takes more than one.
  const showPosition = eligiblePositions.length > 1;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = players.filter(player => {
      if (!eligiblePositions.includes(player.position)) return false;
      if (hideByes && !player.opponentAbbr) return false;
      // A player already in this week's lineup is always worth showing, so the
      // user can see where their picks went.
      const isUsedElsewhere =
        player.usedInWeek !== null && player.usedInWeek !== selectedWeek;
      if (hideUsed && isUsedElsewhere) return false;
      if (query && !player.name.toLowerCase().includes(query)) return false;
      return true;
    });

    // Only genuinely unpickable players - on a bye, or already kicked off -
    // sink to the bottom. Players in this week's lineup or banked in another
    // week keep their natural sort position: both are still actionable, and
    // seeing your own picks ranked against the field is the whole point. The
    // Hide used toggle drops them entirely for anyone who'd rather not.
    const rank = (player: PickerPlayer) =>
      player.isLocked || !player.opponentAbbr ? 1 : 0;

    return filtered.sort((a, b) => {
      const rankDelta = rank(a) - rank(b);
      if (rankDelta !== 0) return rankDelta;

      const left = a[sortKey];
      const right = b[sortKey];

      // Nulls (no projection, bye week) always sort last, never above real data.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;

      const delta =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));

      return sortDescending ? -delta : delta;
    });
  }, [
    players,
    search,
    sortKey,
    sortDescending,
    hideUsed,
    hideByes,
    eligiblePositions,
    selectedWeek,
  ]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDescending(previous => !previous);
      return;
    }
    setSortKey(key);
    // Numbers are most useful highest-first, names and dates ascending.
    setSortDescending(key === 'projection' || key === 'seasonPoints');
  };

  return (
    <section className='overflow-hidden border border-border bg-card'>
      <header className='flex flex-col gap-2 border-b border-border px-2 py-2 sm:h-12 sm:flex-row sm:items-center sm:py-0'>
        <label className='min-w-0 sm:flex-1'>
          <span className='sr-only'>Search players</span>
          <input
            type='search'
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Search ${eligiblePositions.join('/')}\u2026`}
            data-testid='player-search'
            className='w-full border border-border bg-background px-2 py-1 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:max-w-xs'
          />
        </label>
        <div className='flex gap-2 sm:ml-auto'>
          <FilterToggle
            checked={hideUsed}
            onChange={setHideUsed}
            className='flex-1 sm:flex-none'
          >
            Hide used
          </FilterToggle>
          <FilterToggle
            checked={hideByes}
            onChange={setHideByes}
            className='flex-1 sm:flex-none'
          >
            Hide byes
          </FilterToggle>
        </div>
      </header>

      {/* Viewport-relative so the list fills the screen instead of stopping at
          seven rows, and scrollable on both axes on narrow screens. */}
      <div className='max-h-[calc(100vh-17rem)] min-h-[20rem] overflow-auto'>
        <table className='w-full border-collapse text-sm'>
          <thead className='sticky top-0 z-10 bg-background'>
            <tr>
              {COLUMNS.map(column => (
                <th
                  key={column.key}
                  scope='col'
                  aria-sort={
                    sortKey === column.key
                      ? sortDescending
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
                  className={clsx(
                    'whitespace-nowrap border-b border-border px-2 py-1.5 text-sm font-medium text-muted-foreground',
                    column.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  <button
                    type='button'
                    onClick={() => toggleSort(column.key)}
                    data-testid={`sort-${column.key}`}
                    className='hover:text-primary'
                  >
                    {column.label}
                    {sortKey === column.key && (sortDescending ? ' ▾' : ' ▴')}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className='p-6 text-center text-muted-foreground'
                >
                  No players match those filters.
                </td>
              </tr>
            )}
            {rows.map(player => {
              const inLineup = lineupPlayerIds.has(player.id);
              const isBye = !player.opponentAbbr;
              const usedElsewhere =
                player.usedInWeek !== null &&
                player.usedInWeek !== selectedWeek;
              const disabled = isBye || player.isLocked;

              return (
                <tr
                  key={player.id}
                  data-testid={`player-row-${player.id}`}
                  onClick={() => !disabled && onSelectPlayer(player)}
                  className={clsx(
                    'border-b border-border',
                    disabled
                      ? 'cursor-not-allowed text-muted-foreground'
                      : 'cursor-pointer hover:bg-secondary',
                    inLineup && 'bg-primary/20 odd:bg-primary/20',
                    usedElsewhere && !disabled && 'text-muted-foreground',
                  )}
                >
                  <td className='px-2 py-1.5'>
                    <span className='font-medium'>{player.name}</span>
                    {showPosition && (
                      <span className='ml-1.5 text-sm text-muted-foreground'>
                        {player.position}
                      </span>
                    )}
                    {(inLineup || usedElsewhere || player.isLocked) && (
                      <div className='text-sm text-muted-foreground'>
                        {inLineup && (
                          <span className='font-semibold text-foreground'>
                            In your lineup
                          </span>
                        )}
                        {usedElsewhere && (
                          <span
                            title={
                              player.usedPoints != null
                                ? `${player.usedPoints.toFixed(
                                    1,
                                  )} pts in week ${player.usedInWeek}`
                                : undefined
                            }
                          >
                            <Badge
                              size='sm'
                              fill='medal-bronze'
                              label={`Used week ${player.usedInWeek}`}
                            />
                          </span>
                        )}
                        {player.isLocked && (
                          <span className='block'>Kicked off</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className='px-2 py-1.5 text-foreground'>
                    {player.teamAbbr}
                  </td>
                  <td className='whitespace-nowrap px-2 py-1.5'>
                    {isBye ? (
                      <span className='text-muted-foreground'>BYE</span>
                    ) : (
                      <>
                        <span className='text-muted-foreground'>
                          {player.isHome ? 'vs ' : '@ '}
                        </span>
                        {player.opponentAbbr}
                      </>
                    )}
                  </td>
                  <td className='px-2 py-1.5 text-right font-medium tabular-nums'>
                    {player.projection == null
                      ? '–'
                      : player.projection.toFixed(1)}
                  </td>
                  <td className='px-2 py-1.5 text-right tabular-nums text-muted-foreground'>
                    {player.seasonPoints.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
