import { type Fill, FILLS, leagueFill, positionFill } from './fills';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * A square of a category colour, beside text that names the category. The
 * colour repeats the name, so the swatch is hidden from screen readers. Its
 * edge draws an outline only where the fill is too faint for its ground.
 */
export function Swatch({
  fill,
  className,
}: {
  /** None draws an empty square, so a column of them stays aligned. */
  fill: Fill | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3 shrink-0 border',
        fill ? FILLS[fill] : 'border-border',
        className,
      )}
    />
  );
}

/** A swatch and its name, the way a category sits in a table cell. */
function Mark({
  fill,
  children,
  className,
}: {
  fill: Fill | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Swatch fill={fill} />
      {children}
    </span>
  );
}

/** A league by name, with its colour. One we do not know gets no colour. */
export function LeagueMark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Mark fill={leagueFill(name)} className={className}>
      {name}
    </Mark>
  );
}

/**
 * A player's position with its colour, in a fixed width so a column of them
 * lines up. K, DST and the like get an empty square.
 */
export function PositionMark({
  position,
  className,
}: {
  position: string | null;
  className?: string;
}) {
  return (
    <Mark
      fill={positionFill(position)}
      className={cn('w-12 text-sm font-semibold', className)}
    >
      {position ?? 'n/a'}
    </Mark>
  );
}
