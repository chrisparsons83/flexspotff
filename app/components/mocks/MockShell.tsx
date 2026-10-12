import { LEAGUES } from './data';
import { Square, useMockHref } from './parts';
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

/** The accent mixed into the ground, as a share from 0 to 100. */
const tinted = (share: number) =>
  `color-mix(in oklch, oklch(var(--primary)) ${share}%, oklch(var(--background)))`;

/** A glow of the accent from the top centre, fading out by mid-page. */
const glow = (share: number) =>
  `radial-gradient(90% 680px at 50% 0, ${tinted(share)}, transparent)`;

/**
 * Placeholder mark until the logo (#192): the five league colours as a row
 * of squares.
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

/** Development-only controls for reviewing themes and options. */
function ReviewBar() {
  const { pathname, search } = useLocation();
  return (
    <div className='bg-secondary text-sm'>
      <div className='mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-4 py-2'>
        <span className='flex gap-3'>
          <span className='text-muted-foreground'>Theme</span>
          {THEMES.map(theme => (
            <a
              key={theme}
              href={`/resources/theme?theme=${theme}&redirectTo=${encodeURIComponent(
                pathname + search,
              )}`}
              className='hover:underline'
            >
              {theme[0].toUpperCase() + theme.slice(1)}
            </a>
          ))}
        </span>
      </div>
    </div>
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
  const href = useMockHref();
  return (
    <div className='min-h-full bg-background text-foreground'>
      <ReviewBar />
      <div
        className='relative'
        style={{ backgroundImage: glow(32), backgroundRepeat: 'no-repeat' }}
      >
        <header className='relative bg-card'>
          <div className='mx-auto grid max-w-6xl grid-cols-12 items-center gap-x-6 px-4 py-4'>
            <Link
              to={href('/design')}
              className='col-span-12 flex items-center gap-3 md:col-span-3'
            >
              <Mark />
              <span className='font-extrabold tracking-tight'>
                The Flex Spot
              </span>
            </Link>
            <nav
              aria-label='Main'
              className='col-span-10 mt-3 md:col-span-8 md:mt-0'
            >
              <ul className='flex gap-1 overflow-x-auto text-sm'>
                {NAV.map(item => (
                  <li key={item.label}>
                    <Link
                      to={href(item.to)}
                      aria-current={item.label === current ? 'page' : undefined}
                      className={clsx(
                        'block whitespace-nowrap rounded-md px-3 py-1.5 transition-colors duration-fast',
                        item.label === current
                          ? 'bg-secondary font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <Link
              to={href('/design/profile')}
              className='col-span-2 mt-3 text-right text-sm font-semibold md:col-span-1 md:mt-0'
            >
              Me
            </Link>
          </div>
        </header>
        <main className='relative mx-auto max-w-6xl px-4 pb-24 pt-14'>
          {children}
        </main>
      </div>
    </div>
  );
}
