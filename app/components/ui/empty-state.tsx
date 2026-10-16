import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * Says plainly that there is nothing here yet, and what would put something
 * here, in place of the table or list that would otherwise be empty. Sits on
 * the page, not in a card, with an action under it if there is one.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  /** What is missing, as a statement: "No picks this week". */
  title: ReactNode;
  /** Why, or when that changes. */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('max-w-prose py-12', className)}>
      <p className='text-lg font-semibold'>{title}</p>
      {children && <p className='mt-2 text-muted-foreground'>{children}</p>}
      {action && <div className='mt-6'>{action}</div>}
    </div>
  );
}
