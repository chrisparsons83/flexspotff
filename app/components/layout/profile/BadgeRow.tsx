import type { Badge } from '~/models/profile/badges';

type Props = {
  badges: Badge[];
};

/**
 * Tiers are shown as filled pips rather than a number, so a badge's weight
 * reads at a glance and two members' badges are comparable without arithmetic.
 */
function Tier({ tier, tierCount }: { tier: number; tierCount: number }) {
  return (
    <span
      className='tracking-tighter text-amber-300'
      aria-label={`Tier ${tier} of ${tierCount}`}
    >
      {'★'.repeat(tier)}
      <span className='text-gray-500'>{'☆'.repeat(tierCount - tier)}</span>
    </span>
  );
}

export default function BadgeRow({ badges }: Props) {
  if (badges.length === 0) return null;

  return (
    <ul className='not-prose mt-4 flex flex-wrap gap-2 p-0'>
      {badges.map(badge => (
        <li
          key={badge.key}
          title={`${badge.description} (${badge.value})`}
          className='flex items-center gap-1.5 rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-100'
        >
          <span aria-hidden='true'>{badge.emoji}</span>
          <span>{badge.label}</span>
          <Tier tier={badge.tier} tierCount={badge.tierCount} />
        </li>
      ))}
    </ul>
  );
}
