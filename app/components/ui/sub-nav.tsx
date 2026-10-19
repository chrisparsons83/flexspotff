import { FOCUS_RING } from './styles';
import { Link, NavLink, useLocation } from '@remix-run/react';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

export type SubNavItem = {
  label: string;
  to: string;
  /**
   * Current only on this exact page, not the pages under it. Set it on an
   * overview whose path the other items extend.
   */
  end?: boolean;
  /**
   * Current on every page under this path, for an item whose link opens one
   * page of many, such as Weeks opening this week. A pattern matches the
   * whole path instead, for pages that are not all under one path.
   */
  match?: string | RegExp;
};

type Props = {
  items: SubNavItem[];
  /** Read by screen readers, e.g. "Spread pool". */
  label: string;
  /** Sits at the end of the row, such as the league picker. */
  picker?: ReactNode;
  className?: string;
};

const itemClass = (current: boolean) =>
  cn(
    'whitespace-nowrap border px-3 py-1.5 font-semibold no-underline transition-colors duration-fast',
    current
      ? 'border-primary-edge bg-primary text-primary-foreground'
      : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
    FOCUS_RING,
  );

/**
 * Moves between the pages of a section, league or game. The current page is
 * an accent block. Scrolls sideways on a phone rather than wrapping, so the
 * row keeps its shape. Tabs a game does not have are left out, not shown
 * empty.
 */
export function SubNav({ items, label, picker, className }: Props) {
  const { pathname } = useLocation();
  const matches = (match: string | RegExp) =>
    typeof match === 'string'
      ? pathname === match || pathname.startsWith(`${match}/`)
      : match.test(pathname);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4',
        className,
      )}
    >
      <nav aria-label={label} className='min-w-0 max-w-full'>
        <ul className='flex gap-1 overflow-x-auto'>
          {items.map(item => (
            <li key={item.to} className='flex'>
              {item.match ? (
                <Link
                  to={item.to}
                  prefetch='intent'
                  aria-current={matches(item.match) ? 'page' : undefined}
                  className={itemClass(matches(item.match))}
                >
                  {item.label}
                </Link>
              ) : (
                <NavLink
                  to={item.to}
                  end={item.end}
                  prefetch='intent'
                  className={({ isActive }) => itemClass(isActive)}
                >
                  {item.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {picker}
    </div>
  );
}
