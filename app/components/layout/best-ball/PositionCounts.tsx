import clsx from 'clsx';
import type { PositionCounts, PositionGroup } from '~/libs/best-ball/views';
import { POSITION_GROUPS } from '~/libs/best-ball/views';
import { POSITION_RANK_COLORS } from '~/utils/constants';

export const positionColor = (group: PositionGroup | string) =>
  POSITION_RANK_COLORS[group.toLowerCase()] ?? 'bg-slate-600';

/** One small chip per position: "QB 3 · RB 6 · WR 5 · TE 4". */
export function PositionChips({ counts }: { counts: PositionCounts }) {
  return (
    <span className='inline-flex flex-wrap gap-1'>
      {POSITION_GROUPS.filter(g => g !== 'Other' || counts.Other > 0).map(
        group => (
          <span
            key={group}
            title={`${counts[group]} ${group}`}
            className={clsx(
              'rounded px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-white',
              positionColor(group),
              counts[group] === 0 && 'opacity-40',
            )}
          >
            {group === 'Other' ? 'OTH' : group} {counts[group]}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * A full-width bar split by how many of each position were taken. The small
 * one is fainter, for a comparison set right under a full-size bar.
 */
export function PositionBar({
  counts,
  label,
  size = 'normal',
}: {
  counts: PositionCounts;
  label?: string;
  size?: 'normal' | 'small';
}) {
  const total = POSITION_GROUPS.reduce((sum, g) => sum + counts[g], 0);
  return (
    <div
      className={clsx(
        'flex w-full overflow-hidden rounded bg-slate-700',
        size === 'small' ? 'h-4 opacity-60' : 'h-6',
      )}
      role='img'
      aria-label={
        label ??
        POSITION_GROUPS.filter(g => counts[g] > 0)
          .map(g => `${counts[g]} ${g}`)
          .join(', ')
      }
    >
      {total > 0 &&
        POSITION_GROUPS.filter(g => counts[g] > 0).map(group => (
          <div
            key={group}
            title={`${group}: ${counts[group]}`}
            className={clsx(
              'flex items-center justify-center overflow-hidden whitespace-nowrap font-semibold text-white',
              size === 'small' ? 'text-[0.6rem]' : 'text-[0.7rem]',
              positionColor(group),
            )}
            style={{ width: `${(counts[group] / total) * 100}%` }}
          >
            {/* A sliver too narrow for its label keeps it in the tooltip. */}
            {counts[group] / total >= 0.06 &&
              `${group === 'Other' ? 'OTH' : group} ${counts[group]}`}
          </div>
        ))}
    </div>
  );
}
