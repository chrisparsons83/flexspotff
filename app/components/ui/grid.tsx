import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * The 12-column grid every page is set on, with the gutters from the spacing
 * scale: 24px between columns, 40px between rows.
 */
export function Grid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid grid-cols-12 gap-x-6 gap-y-10', className)}>
      {children}
    </div>
  );
}

type Span = 3 | 4 | 6 | 8 | 9 | 12;
type Breakpoint = 'base' | 'sm' | 'md' | 'lg';

/** Written out whole, because Tailwind only builds classes it can find. */
const SPANS: Record<Breakpoint, Record<Span, string>> = {
  base: {
    3: 'col-span-3',
    4: 'col-span-4',
    6: 'col-span-6',
    8: 'col-span-8',
    9: 'col-span-9',
    12: 'col-span-12',
  },
  sm: {
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    6: 'sm:col-span-6',
    8: 'sm:col-span-8',
    9: 'sm:col-span-9',
    12: 'sm:col-span-12',
  },
  md: {
    3: 'md:col-span-3',
    4: 'md:col-span-4',
    6: 'md:col-span-6',
    8: 'md:col-span-8',
    9: 'md:col-span-9',
    12: 'md:col-span-12',
  },
  lg: {
    3: 'lg:col-span-3',
    4: 'lg:col-span-4',
    6: 'lg:col-span-6',
    8: 'lg:col-span-8',
    9: 'lg:col-span-9',
    12: 'lg:col-span-12',
  },
};

/**
 * A block on the grid, by how many of the 12 columns it takes at each
 * breakpoint: `span={{ base: 12, md: 6 }}`. Full width on a phone unless it
 * says otherwise.
 */
export function GridItem({
  span = {},
  className,
  children,
}: {
  span?: Partial<Record<Breakpoint, Span>>;
  className?: string;
  children: ReactNode;
}) {
  const spans = { base: 12 as Span, ...span };
  return (
    <div
      className={cn(
        (Object.keys(spans) as Breakpoint[]).map(
          breakpoint => SPANS[breakpoint][spans[breakpoint]!],
        ),
        className,
      )}
    >
      {children}
    </div>
  );
}
