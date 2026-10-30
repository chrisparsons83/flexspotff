import { PositionBar as Bar } from '~/components/ui/bars';
import { FILLS, positionFill } from '~/components/ui/fills';
import { Swatch } from '~/components/ui/swatch';
import type { PositionCounts, PositionGroup } from '~/libs/best-ball/views';
import { POSITION_GROUPS } from '~/libs/best-ball/views';

export const positionColor = (group: PositionGroup | string) => {
  const fill = positionFill(group);
  return fill ? FILLS[fill] : 'bg-secondary';
};

/** How many of each position a roster took: a swatch, the position, the count. */
export function PositionTally({ counts }: { counts: PositionCounts }) {
  return (
    <span className='inline-flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums'>
      {POSITION_GROUPS.filter(g => g !== 'Other' || counts.Other > 0).map(
        group => (
          <span
            key={group}
            className={
              counts[group] === 0
                ? 'inline-flex items-center gap-1.5 text-muted-foreground'
                : 'inline-flex items-center gap-1.5'
            }
          >
            <Swatch fill={positionFill(group)} />
            {group === 'Other' ? 'OTH' : group} {counts[group]}
          </span>
        ),
      )}
    </span>
  );
}

/** A best-ball roster's positions as one bar, in the draft's order. */
export function PositionBar({
  counts,
  label,
  size,
}: {
  counts: PositionCounts;
  label?: string;
  size?: 'normal' | 'small';
}) {
  return (
    <Bar
      counts={Object.fromEntries(POSITION_GROUPS.map(g => [g, counts[g]]))}
      label={label}
      size={size}
    />
  );
}
