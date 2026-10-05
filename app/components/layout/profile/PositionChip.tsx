import clsx from 'clsx';
import { POSITION_RANK_COLORS } from '~/utils/constants';

/** A player's position as a coloured chip, the way every profile tab shows it. */
export default function PositionChip({
  position,
}: {
  position: string | null;
}) {
  return (
    <span
      className={clsx(
        'inline-block w-8 rounded px-1 text-center text-[0.65rem] font-bold text-white',
        POSITION_RANK_COLORS[position?.toLowerCase() ?? ''] ?? 'bg-slate-600',
      )}
    >
      {position ?? '?'}
    </span>
  );
}
