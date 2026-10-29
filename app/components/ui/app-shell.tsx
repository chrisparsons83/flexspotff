import { Breadcrumb } from './breadcrumb';
import { ExternalLink, Link } from './link';
import { NavBar } from './nav-bar';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '~/utils';
import type { Crumb } from '~/utils/route-handle';

export const DISCORD_INVITE = 'https://discord.gg/VVsEXujWEY';

/**
 * A glow of the accent from the top centre of the page, fading out by
 * mid-page. Its strength and reach are depth tokens; the accent is mixed in
 * OKLab, as OKLCH would turn the hue toward the ground's violet through pink.
 */
export const PAGE_GLOW = {
  backgroundImage: 'var(--page-glow)',
  backgroundRepeat: 'no-repeat',
};

/**
 * The texture behind the top of the page, fading out downward and toward the
 * sides. Behind everything, and never in the way. Goes inside an element
 * with the page glow that is `relative isolate`.
 */
export function PageTexture() {
  return (
    <div
      aria-hidden
      // Marks the page glow for the Storybook pattern check.
      data-page-glow
      className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[var(--page-texture-reach)] [background-image:var(--page-texture)] [background-position:var(--page-texture-position)] [background-repeat:var(--page-texture-repeat)] [background-size:var(--page-texture-size)] [mask-image:radial-gradient(ellipse_70%_100%_at_50%_0,black,transparent)]'
    />
  );
}

type Props = ComponentProps<typeof NavBar> & {
  /**
   * `contained` sets the page on the 6xl grid. `full` gives it the whole
   * width, for the draft boards.
   */
  width?: 'contained' | 'full';
  /** The way down to this page, shown above it when it is two levels deep. */
  breadcrumbs?: Crumb[];
  children: ReactNode;
};

/** Every public page: the nav, the page on the grid, and the footer. */
export function AppShell({
  width = 'contained',
  breadcrumbs = [],
  children,
  ...nav
}: Props) {
  return (
    <div
      // Marks the page glow for the Storybook pattern check.
      data-page-glow
      className='relative isolate flex min-h-full flex-col bg-background text-foreground'
      style={PAGE_GLOW}
    >
      <PageTexture />
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
        <Breadcrumb items={breadcrumbs} />
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** The Discord invite and the podcast archive. */
export function Footer() {
  return (
    <footer className='border-t border-hairline bg-chrome text-card-foreground'>
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
