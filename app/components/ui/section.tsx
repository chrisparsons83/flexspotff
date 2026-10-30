import { Link } from './link';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

type Props = {
  title: ReactNode;
  /** Links the title to the page the section summarises. */
  to?: string;
  /** What the section counts or shows, in a sentence. Written once, here. */
  description?: ReactNode;
  /** Controls belonging to the section, such as a year filter. */
  action?: ReactNode;
  /** Small print under the content. */
  footnote?: ReactNode;
  /** h2 on a page; h3 inside a section of its own. */
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A block of a page, separated from the next by space rather than a border
 * or a card. Its heading sits on the grid with any controls at the end of
 * the row.
 */
export function Section({
  title,
  to,
  description,
  action,
  footnote,
  as: Heading = 'h2',
  id,
  className,
  children,
}: Props) {
  return (
    <section aria-labelledby={id} className={cn('mt-16 first:mt-0', className)}>
      <div className='mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
        <div>
          <Heading
            id={id}
            className={cn(
              'font-extrabold tracking-tight',
              Heading === 'h2' ? 'text-2xl' : 'text-xl',
            )}
          >
            {to ? (
              <Link to={to} variant='quiet' className='inline-flex'>
                {title}
                <ChevronRightIcon
                  aria-hidden
                  className='ml-1 size-6 self-center text-primary'
                />
              </Link>
            ) : (
              title
            )}
          </Heading>
          {description && (
            <p className='mt-1 max-w-prose text-muted-foreground'>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
      {footnote && (
        <p className='mt-4 max-w-prose text-sm text-muted-foreground'>
          {footnote}
        </p>
      )}
    </section>
  );
}
