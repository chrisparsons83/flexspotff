import { Link } from './link';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '~/utils';
import type { Crumb } from '~/utils/route-handle';

type Props = {
  /** Outermost first. The last is this page. */
  items: Crumb[];
  className?: string;
};

/**
 * Where a deep page sits, above its title: the section, then each level
 * down, linked. The chevron between them stands for "in". On a phone only
 * the level above shows, as a way back up; the rest is hidden from sight
 * but not from screen readers, which hear the whole trail, and shows
 * again when a keyboard reaches it. A trail of one
 * level is no trail, so it shows nothing.
 */
export function Breadcrumb({ items, className }: Props) {
  if (items.length < 2) return null;
  const parentIndex = items.length - 2;
  return (
    <nav aria-label='Breadcrumb' className={cn('mb-4 text-sm', className)}>
      <ol className='flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground'>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li
              key={item.to}
              className={cn(
                'flex min-w-0 items-center gap-x-1.5',
                index < parentIndex &&
                  'max-sm:sr-only max-sm:focus-within:not-sr-only',
                current && 'max-sm:sr-only',
              )}
            >
              {index > 0 && (
                <ChevronRightIcon
                  aria-hidden
                  className='shrink-0 max-sm:hidden'
                />
              )}
              {current ? (
                <span aria-current='page' className='text-foreground'>
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  prefetch='intent'
                  variant='quiet'
                  className='flex items-center gap-x-1 hover:text-foreground'
                >
                  {index === parentIndex && (
                    <ChevronLeftIcon
                      aria-hidden
                      className='shrink-0 sm:hidden'
                    />
                  )}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
