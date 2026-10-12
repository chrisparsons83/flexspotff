import { LEAGUES } from './data';
import { Square, useMockHref } from './parts';
import { Link, useLocation, useSearchParams } from '@remix-run/react';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

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

/**
 * Background options under review. Each is built from the theme tokens, so
 * it follows dark and light.
 */
const BACKGROUNDS: Record<string, { label: string; style?: CSSProperties }> = {
  plain: { label: 'Plain' },
  dots: {
    label: 'Dots',
    style: {
      backgroundImage:
        'radial-gradient(oklch(var(--border)) 1.2px, transparent 1.2px)',
      backgroundSize: '20px 20px',
    },
  },
  steps: {
    label: 'Stepped',
    style: {
      backgroundImage: `linear-gradient(to bottom, ${[24, 18, 12, 6]
        .map((share, i) => `${tinted(share)} ${i * 72}px ${(i + 1) * 72}px`)
        .join(', ')}, transparent 288px)`,
      backgroundRepeat: 'no-repeat',
    },
  },
  smooth: {
    label: 'Smooth',
    style: {
      backgroundImage: `linear-gradient(to bottom, ${tinted(
        20,
      )}, transparent 560px)`,
      backgroundRepeat: 'no-repeat',
    },
  },
};

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

/** Development-only controls for reviewing themes and backgrounds. */
function ReviewBar() {
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();
  const current = params.get('bg') ?? 'plain';

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
        <span className='flex gap-3'>
          <span className='text-muted-foreground'>Background</span>
          {Object.entries(BACKGROUNDS).map(([key, { label }]) => (
            <Link
              key={key}
              to={`${pathname}?bg=${key}`}
              className={clsx(
                key === current ? 'font-bold underline' : 'hover:underline',
              )}
            >
              {label}
            </Link>
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
  const [params] = useSearchParams();
  const background =
    BACKGROUNDS[params.get('bg') ?? 'plain'] ?? BACKGROUNDS.plain;

  return (
    <div className='min-h-full bg-background text-foreground'>
      <ReviewBar />
      <header className='border-b-2 border-ink bg-card'>
        <div className='mx-auto grid max-w-6xl grid-cols-12 items-center gap-x-6 px-4 py-4'>
          <Link
            to={href('/design')}
            className='col-span-12 flex items-center gap-3 md:col-span-3'
          >
            <Mark />
            <span className='font-extrabold'>The Flex Spot</span>
          </Link>
          <nav
            aria-label='Main'
            className='col-span-10 mt-3 md:col-span-8 md:mt-0'
          >
            <ul className='flex gap-5 overflow-x-auto text-sm'>
              {NAV.map(item => (
                <li key={item.label}>
                  <Link
                    to={href(item.to)}
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
          <Link
            to={href('/design/profile')}
            className='col-span-2 mt-3 text-right text-sm font-semibold md:col-span-1 md:mt-0'
          >
            Me
          </Link>
        </div>
      </header>
      <div style={background.style}>
        <main className='mx-auto max-w-6xl px-4 pb-24 pt-12'>{children}</main>
      </div>
    </div>
  );
}
