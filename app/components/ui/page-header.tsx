import type { ReactNode } from 'react';
import { cn } from '~/utils';

type Props = {
  title: ReactNode;
  /** A sentence or two under the title. */
  description?: ReactNode;
  /** Buttons or a picker, set at the end of the title row. */
  actions?: ReactNode;
  /** The section's SubNav, under the title. */
  nav?: ReactNode;
  className?: string;
};

/**
 * The top of a page: an extra-bold title on the grid, what the page is in
 * plain words, and the way around its section. No label above the title.
 */
export function PageHeader({
  title,
  description,
  actions,
  nav,
  className,
}: Props) {
  return (
    <header
      className={cn('mb-10 grid grid-cols-[minmax(0,1fr)] gap-6', className)}
    >
      <div className='grid grid-cols-12 items-end gap-x-6 gap-y-4'>
        <div className={cn('col-span-12', actions && 'md:col-span-8')}>
          <h1 className='text-4xl tracking-tight [font-stretch:var(--title-width)] [font-weight:var(--title-weight)]'>
            {title}
          </h1>
          {description && (
            <p className='mt-3 max-w-prose text-lg text-muted-foreground'>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className='col-span-12 flex flex-wrap gap-3 md:col-span-4 md:justify-end'>
            {actions}
          </div>
        )}
      </div>
      {nav}
    </header>
  );
}
