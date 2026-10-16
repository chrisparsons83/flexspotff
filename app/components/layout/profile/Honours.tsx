import { Badge as BadgeBlock } from '~/components/ui/badge';
import { type Fill, SEQUENCE } from '~/components/ui/fills';
import type { Badge } from '~/models/profile/badges';

/**
 * A banded badge steps up the value sequence with its tier, from the middle
 * of the sequence to its lightest step, so the top tier is the brightest
 * block whatever the badge's number of tiers.
 */
const fillFor = (badge: Badge): Fill => {
  if (badge.fill !== 'sequence') return badge.fill;
  const top = SEQUENCE.length - 1;
  const bottom = Math.floor(top / 2);
  const step = Math.round(
    bottom + ((top - bottom) * badge.tier) / badge.tierCount,
  );
  return SEQUENCE[Math.min(step, top)];
};

/**
 * What the block's number counts. A tallied badge counts its wins; a banded
 * one shows its tier, with how many there are said underneath.
 */
const detailFor = (badge: Badge) =>
  badge.scale === 'tally'
    ? undefined
    : `Tier ${badge.tier} of ${badge.tierCount}`;

/** One award as the system draws it: a block of its colour, its name under. */
export function Honour({
  badge,
  size = 'md',
}: {
  badge: Badge;
  size?: 'md' | 'lg';
}) {
  return (
    <BadgeBlock
      fill={fillFor(badge)}
      size={size}
      mark={badge.tier}
      label={badge.label}
      detail={detailFor(badge)}
    />
  );
}

/** A member's awards on the grid, in the catalog's order. */
export default function Honours({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <ul className='not-prose mt-6 grid grid-cols-3 gap-x-6 gap-y-8 p-0 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'>
      {badges.map(badge => (
        <li key={badge.key} className='list-none'>
          <Honour badge={badge} />
        </li>
      ))}
    </ul>
  );
}
