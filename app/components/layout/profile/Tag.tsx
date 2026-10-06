import { TAG, type TagTone } from './tones';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/** A small label beside a row - "Won", "Current", "Contrarian". */
export default function Tag({
  tone,
  title,
  className,
  children,
}: {
  tone: TagTone;
  /** Hover text, for a label that needs a line of explanation. */
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs',
        title && 'cursor-help',
        TAG[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks the season still being played, whose numbers are still moving. */
export function CurrentTag() {
  return (
    <Tag tone='current' className='ml-2 font-medium'>
      Current
    </Tag>
  );
}
