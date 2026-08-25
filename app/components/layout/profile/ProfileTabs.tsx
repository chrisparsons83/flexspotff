import { Link, useLocation } from '@remix-run/react';
import clsx from 'clsx';

/**
 * The profile tab bar.
 *
 * These are links rather than a client-side tab component so each tab is its own
 * route with its own loader - opening a profile queries one contest instead of
 * all nine, and every tab can be linked to directly.
 *
 * Tabs a member has never played are still shown, greyed, so the bar does not
 * change shape from one profile to the next.
 */

export const PROFILE_TABS = [
  { key: 'league', label: 'League' },
  { key: 'cup', label: 'Cup' },
  { key: 'd12', label: 'D12' },
  { key: 'qb-streaming', label: 'QB Streaming' },
  { key: 'spread-pool', label: 'Spread Pool' },
  { key: 'locks', label: 'Locks' },
  { key: 'dfs-survivor', label: 'DFS Survivor' },
  { key: 'f-squared', label: 'F²' },
  { key: 'omni', label: 'Omni' },
] as const;

type Props = {
  userId: string;
  contestsPlayed: string[];
};

export default function ProfileTabs({ userId, contestsPlayed }: Props) {
  const { pathname } = useLocation();
  const played = new Set(contestsPlayed);

  return (
    <nav className='not-prose mt-6 border-b border-gray-700'>
      <ul className='flex flex-wrap gap-1 p-0'>
        {PROFILE_TABS.map(tab => {
          const to = `/members/${userId}/${tab.key}`;
          const isActive = pathname === to;
          const hasPlayed = played.has(tab.key);

          return (
            <li key={tab.key} className='list-none'>
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'inline-block rounded-t-md px-3 py-2 text-sm font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : hasPlayed
                    ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    : 'text-gray-500 hover:bg-gray-800',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
