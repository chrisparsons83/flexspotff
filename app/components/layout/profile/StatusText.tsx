import { STATUS, type StatusTone } from './tones';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

/** A word of status in a row - "Won", "Contrarian" - in its state's colour. */
export default function StatusText({
  tone,
  className,
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'whitespace-nowrap text-sm font-semibold',
        STATUS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks the season still being played, whose numbers are still moving. */
export function CurrentSeason() {
  return (
    <span className='ml-2 text-sm font-normal text-muted-foreground'>
      In progress
    </span>
  );
}
