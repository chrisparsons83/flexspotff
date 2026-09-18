import clsx from 'clsx';
import type { DfsSurvivorSlot } from '~/libs/dfs-survivor/slots';
import { DFS_SURVIVOR_SLOTS, formatSlotName } from '~/libs/dfs-survivor/slots';
import type {
  PickerPlayer,
  SlotEntry,
} from '~/routes/games.dfs-survivor.entries._index';

/** What a lineup row needs to render, from either a saved entry or the picker. */
type SlotDisplay = {
  name: string;
  teamAbbr: string;
  opponentAbbr: string | null;
  isHome: boolean;
  projection: number | null;
};

type Props = {
  lineup: Record<DfsSurvivorSlot, string | null>;
  playersById: Map<string, PickerPlayer>;
  /** What the server has saved for this week, per slot. */
  entries: Partial<Record<DfsSurvivorSlot, SlotEntry>>;
  activeSlot: DfsSurvivorSlot;
  onActivateSlot: (slot: DfsSurvivorSlot) => void;
  onClearSlot: (slot: DfsSurvivorSlot) => void;
  lockedSlots: Partial<Record<DfsSurvivorSlot, string>>;
  isWeekScored: boolean;
};

function matchupLabel(player: SlotDisplay) {
  if (!player.opponentAbbr) return 'BYE';
  return `${player.isHome ? 'vs' : '@'} ${player.opponentAbbr}`;
}

/**
 * The eleven lineup slots for the selected week. A slot is the target for the
 * next pick from the player table, so clicking a row here focuses it.
 */
export default function DfsSurvivorLineup({
  lineup,
  playersById,
  entries,
  activeSlot,
  onActivateSlot,
  onClearSlot,
  lockedSlots,
  isWeekScored,
}: Props) {
  return (
    <div>
      {DFS_SURVIVOR_SLOTS.map(slot => {
        const playerId = lineup[slot];
        const saved = entries[slot];
        // Prefer the saved entry's own snapshot: a released player is no longer
        // in the picker list, and looking them up there would blank the row.
        const player: SlotDisplay | undefined = !playerId
          ? undefined
          : saved?.playerId === playerId
          ? saved
          : playersById.get(playerId);
        const lockReason = lockedSlots[slot];
        const isActive = slot === activeSlot && !lockReason;

        return (
          <div
            key={slot}
            data-testid={`slot-${slot}`}
            className={clsx(
              // `group` so the clear button can appear on hover rather than
              // leaving a permanent ragged gutter.
              'group flex h-10 items-center gap-2 border-b border-slate-700/50 px-3 last:border-b-0',
              isActive && 'bg-blue-900/40',
              lockReason && 'opacity-60',
            )}
          >
            <button
              type='button'
              disabled={!!lockReason}
              onClick={() => onActivateSlot(slot)}
              title={lockReason}
              className='flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed'
            >
              <span
                className={clsx(
                  'w-11 shrink-0 text-right text-[0.7rem] font-bold uppercase tracking-wide',
                  isActive ? 'text-blue-300' : 'text-slate-500',
                )}
              >
                {formatSlotName(slot)}
              </span>

              {player ? (
                <span className='min-w-0 flex-1 truncate'>
                  <span className='text-sm font-medium text-white'>
                    {player.name}
                  </span>
                  <span className='ml-1.5 text-xs text-slate-400'>
                    {player.teamAbbr} {matchupLabel(player)}
                  </span>
                </span>
              ) : (
                // A dashed rule reads as "slot waiting to be filled" without
                // repeating the word "Empty" eleven times down the panel.
                <span
                  className={clsx(
                    'h-px flex-1 border-t border-dashed',
                    isActive ? 'border-blue-400/70' : 'border-slate-600/70',
                  )}
                />
              )}
            </button>

            <span className='w-12 shrink-0 text-right text-xs tabular-nums'>
              {/* Final points are white and bold, projections grey, so a
                  half-played week reads at a glance. */}
              {isWeekScored ? (
                <span title='Final' className='font-semibold text-white'>
                  {(saved?.points ?? 0).toFixed(2)}
                </span>
              ) : saved?.playerId === playerId && saved.actualPoints != null ? (
                <span title='Final' className='font-semibold text-white'>
                  {saved.actualPoints.toFixed(2)}
                </span>
              ) : (
                player?.projection != null && (
                  <span title='Projected' className='text-slate-400'>
                    {player.projection.toFixed(1)}
                  </span>
                )
              )}
            </span>

            <button
              type='button'
              aria-label={`Clear ${formatSlotName(slot)}`}
              title={lockReason ?? `Clear ${formatSlotName(slot)}`}
              data-testid={`clear-${slot}`}
              disabled={!player || !!lockReason}
              className={clsx(
                'w-4 shrink-0 text-xs text-slate-500 hover:text-red-400 disabled:invisible',
                // Visible on hover, or on keyboard focus so it stays reachable.
                'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100',
              )}
              onClick={() => onClearSlot(slot)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
