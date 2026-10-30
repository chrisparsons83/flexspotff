import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * A name cut short with an ellipsis once it runs past a phone's width. Some
 * are one long word, like a hashtag, that would otherwise push a table or a
 * line off the screen. The whole name is on hover. Names that fit are
 * untouched.
 */
export function Truncate({
  title,
  className = 'max-w-[11rem]',
  children,
}: {
  /** The full text, shown on hover. */
  title: string;
  /** The widest it gets before it is cut. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn('inline-block truncate align-bottom', className)}
    >
      {children}
    </span>
  );
}
