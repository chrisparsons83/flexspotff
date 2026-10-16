import { type Fill, FILLS } from './fills';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  /** The token colour of the block. */
  fill: Fill;
  /** What it is, in neutral type: "League champion". */
  label: ReactNode;
  /**
   * A short value set in the block itself, such as a year or a count. Shown
   * at md and lg; the sm mark is too small to hold it.
   */
  mark?: ReactNode;
  /** A line under the label, such as what the count means. */
  detail?: ReactNode;
  size?: Size;
  className?: string;
};

/**
 * Block sizes come from the spacing scale, and the mark steps up the type
 * scale with them. The block is square whatever it holds.
 */
const BLOCK: Record<Size, string> = {
  sm: 'size-4',
  md: 'size-16 p-2 text-lg',
  lg: 'size-24 p-3 text-2xl',
};

/**
 * A distinct status or award, drawn as a square block of a token colour on
 * the grid with its name in neutral type: beside the block at sm, under it
 * at md and lg. Not a label for every row of a table; categories there are a
 * column or a Swatch.
 */
export function Badge({
  fill,
  label,
  mark,
  detail,
  size = 'md',
  className,
}: Props) {
  const block = (
    <span
      aria-hidden={size === 'sm' || mark === undefined ? true : undefined}
      className={cn(
        'flex shrink-0 items-end border font-extrabold leading-none tabular-nums',
        FILLS[fill],
        BLOCK[size],
      )}
    >
      {size !== 'sm' && mark}
    </span>
  );

  if (size === 'sm') {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        {block}
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col gap-2', className)}>
      {block}
      <span className='grid'>
        <span className={cn('font-semibold', size === 'md' && 'text-sm')}>
          {label}
        </span>
        {detail && (
          <span className='text-sm text-muted-foreground'>{detail}</span>
        )}
      </span>
    </span>
  );
}
