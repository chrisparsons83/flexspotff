import { LEAGUES } from './data';
import { Square } from './parts';
import { Link, useLocation } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

const NAV = [
  { label: 'Home', to: '/design/home' },
  { label: 'Leagues', to: '/design/standings' },
  { label: 'Games', to: '/design' },
  { label: 'Omni', to: '/design' },
  { label: 'Members', to: '/design' },
  { label: 'Podcast', to: '/design' },
];

const THEMES = ['dark', 'light', 'system'] as const;

/**
 * Placeholder mark until the logo (#192): the five league colours as a row
 * of squares, the rule the palette is built on.
 */
function Mark() {
  return (
    <span className='flex gap-0.5' aria-hidden>
      {LEAGUES.map(league => (
        <Square key={league.key} fill={league.fill} />
      ))}
    </span>
  );
}

/** The new site frame as the mocks see it: nav, then the page on the grid. */
export function MockShell({
  current,
  children,
}: {
  current: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();

  return (
    <div className='min-h-full bg-background text-foreground'>
      <header className='bg-card'>
        <div className='mx-auto grid max-w-6xl grid-cols-12 items-center gap-x-6 px-4 py-4'>
          <Link
            to='/design'
            className='col-span-12 flex items-center gap-3 md:col-span-3'
          >
            <Mark />
            <span className='font-extrabold'>The Flex Spot</span>
          </Link>
          <nav
            aria-label='Main'
            className='col-span-12 mt-3 md:col-span-7 md:mt-0'
          >
            <ul className='flex gap-5 overflow-x-auto text-sm'>
              {NAV.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    aria-current={item.label === current ? 'page' : undefined}
                    className={clsx(
                      'whitespace-nowrap border-b-4 pb-1',
                      item.label === current
                        ? 'border-primary font-semibold text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className='col-span-12 mt-3 flex items-center justify-between gap-4 text-sm md:col-span-2 md:mt-0 md:justify-end'>
            {/* Development switch for reviewing both themes. */}
            <span className='flex gap-2 text-muted-foreground'>
              {THEMES.map(theme => (
                <a
                  key={theme}
                  href={`/resources/theme?theme=${theme}&redirectTo=${encodeURIComponent(
                    pathname,
                  )}`}
                  className='hover:text-foreground'
                >
                  {theme[0].toUpperCase() + theme.slice(1)}
                </a>
              ))}
            </span>
            <Link to='/design/profile' className='font-semibold'>
              Me
            </Link>
          </div>
        </div>
      </header>
      <main className='mx-auto max-w-6xl px-4 pb-24 pt-12'>{children}</main>
    </div>
  );
}
