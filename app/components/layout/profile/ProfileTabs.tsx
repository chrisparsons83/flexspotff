import { Link, useLocation } from '@remix-run/react';
import clsx from 'clsx';

/**
 * The profile tab bar.
 *
 * These are links rather than a client-side tab component so each tab is its own
 * route with its own loader - opening a profile queries one contest instead of
 * all of them, and every tab can be linked to directly.
 *
 * Only contests a member actually played are shown. A row of tabs leading to
 * "hasn't played this" is noise, and it reads the same whether they skipped the
 * game or it did not exist during their seasons.
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
] as const;

/** Always shown, so a profile is never left with no tabs at all. */
const ALWAYS_SHOWN = 'league';

type Props = {
  userId: string;
  contestsPlayed: string[];
};

export default function ProfileTabs({ userId, contestsPlayed }: Props) {
  const { pathname } = useLocation();
  const played = new Set(contestsPlayed);
  const visible = PROFILE_TABS.filter(
    tab => tab.key === ALWAYS_SHOWN || played.has(tab.key),
  );

  // A solid bar rather than bare text on the page background. Every section
  // below is a bordered panel, so tabs drawn as loose links read as the least
  // important thing on the page when they are the main way around it. It
  // scrolls sideways on a phone instead of wrapping into a second row.
  return (
    <nav
      aria-label='Profile sections'
      className='not-prose mt-6 overflow-x-auto rounded-lg border border-slate-600/50 bg-slate-900/70 p-1'
    >
      <ul className='m-0 flex min-w-max gap-1 p-0'>
        {visible.map(tab => {
          const to = `/members/${userId}/${tab.key}`;
          const isActive = pathname === to;

          return (
            <li key={tab.key} className='list-none'>
              <Link
                to={to}
                prefetch='intent'
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'block whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold no-underline transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900 shadow'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white',
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
