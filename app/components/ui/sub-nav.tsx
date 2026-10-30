import { FOCUS_RING, NAV_LABEL } from './styles';
import { Link, NavLink, useLocation } from '@remix-run/react';
import { type ReactNode, useEffect, useRef } from 'react';
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
    // On a phone the tabs trade width for height: narrower, so more fit
    // without scrolling, and 44px tall, a finger's tap target.
    'whitespace-nowrap border px-2 py-2.5 font-semibold no-underline transition-colors duration-fast sm:px-3 sm:py-1.5',
    current
      ? 'border-tab-edge bg-tab bg-accent-gradient bg-[length:100%_var(--tab-bar)] bg-bottom bg-no-repeat text-tab-foreground [background-origin:border-box]'
      : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
    NAV_LABEL,
    FOCUS_RING,
  );

/**
 * Moves between the pages of a section, league or game. The current page is
 * underlined with the accent gradient, or an accent block, as the depth
 * tokens say. Scrolls sideways on a phone rather than wrapping, so the
 * row keeps its shape, and opens scrolled to the current tab. Tabs a game does not have are left out, not shown
 * empty.
 */
export function SubNav({ items, label, picker, className }: Props) {
  const { pathname } = useLocation();
  const list = useRef<HTMLUListElement>(null);

  // A current tab past the edge of a phone would otherwise be out of sight.
  useEffect(() => {
    const current = list.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!list.current || !current) return;
    const { offsetLeft, offsetWidth } = current;
    const { scrollLeft, clientWidth } = list.current;
    if (offsetLeft + offsetWidth > scrollLeft + clientWidth) {
      list.current.scrollLeft = offsetLeft + offsetWidth - clientWidth;
    } else if (offsetLeft < scrollLeft) {
      list.current.scrollLeft = offsetLeft;
    }
  }, [pathname]);
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
        <ul ref={list} className='relative flex overflow-x-auto sm:gap-1'>
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
