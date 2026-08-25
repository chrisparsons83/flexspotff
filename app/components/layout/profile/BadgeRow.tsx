import type { Badge } from '~/models/profile/summary.server';

type Props = {
  badges: Badge[];
};

export default function BadgeRow({ badges }: Props) {
  if (badges.length === 0) return null;

  return (
    <ul className='not-prose mt-4 flex flex-wrap gap-2 p-0'>
      {badges.map(badge => (
        <li
          key={badge.key}
          title={badge.description}
          className='flex items-center gap-1.5 rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-100'
        >
          <span aria-hidden='true'>{badge.emoji}</span>
          <span>{badge.label}</span>
          {badge.count !== undefined && badge.count > 1 && (
            <span className='font-bold text-white'>×{badge.count}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
