import { ExternalLink, Link } from './link';
import { NavBar } from './nav-bar';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '~/utils';

export const DISCORD_INVITE = 'https://discord.gg/VVsEXujWEY';

/**
 * The accent mixed into the ground, as a share from 0 to 100. Mixed in
 * OKLab: OKLCH would turn the hue from the orange to the ground's violet on
 * the way, through pink.
 */
const tinted = (share: number) =>
  `color-mix(in oklab, oklch(var(--primary)) ${share}%, oklch(var(--background)))`;

/**
 * The one sanctioned gradient: a glow of the accent from the top centre of
 * the page, fading out by mid-page.
 */
export const PAGE_GLOW = {
  backgroundImage: `radial-gradient(90% 680px at 50% 0, ${tinted(
    32,
  )}, transparent)`,
  backgroundRepeat: 'no-repeat',
};

type Props = ComponentProps<typeof NavBar> & {
  /**
   * `contained` sets the page on the 6xl grid. `full` gives it the whole
   * width, for the draft boards.
   */
  width?: 'contained' | 'full';
  children: ReactNode;
};

/** Every public page: the nav, the page on the grid, and the footer. */
export function AppShell({ width = 'contained', children, ...nav }: Props) {
  return (
    <div
      // Marks the one sanctioned gradient for the Storybook pattern check.
      data-page-glow
      className='flex min-h-full flex-col bg-background text-foreground'
      style={PAGE_GLOW}
    >
      <a
        href='#main'
        className='sr-only z-50 bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4'
      >
        Skip to content
      </a>
      <NavBar {...nav} />
      <main
        id='main'
        className={cn(
          'w-full flex-1 px-4 pb-24 pt-10',
          width === 'contained' && 'mx-auto max-w-6xl',
        )}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** The Discord invite and the podcast archive. */
export function Footer() {
  return (
    <footer className='bg-card text-card-foreground'>
      <ul className='mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-4 py-8 text-sm'>
        <li>
          <ExternalLink href={DISCORD_INVITE} variant='quiet'>
            Join the Discord
          </ExternalLink>
        </li>
        <li>
          <Link to='/podcast' variant='quiet'>
            Podcast archive
          </Link>
        </li>
      </ul>
    </footer>
  );
}
