import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * One topic of a tab's Career section, led by the number that sums it up
 * rather than a tile per number. The small stats go in as `MiniStat`s.
 *
 * What a stat counts, where its label cannot say it all, is written under
 * the stat itself rather than behind a hover that a phone never shows.
 */
export default function CareerCard({
  title,
  lead,
  leadNote,
  meter,
  compactStats = false,
  footnote,
  className,
  children,
}: {
  title: ReactNode;
  lead: ReactNode;
  /**
   * A line under the headline. Leave it out to set the context inline with
   * the headline instead; do it for every card in a row, so they stay level.
   */
  leadNote?: ReactNode;
  /** A full-width bar under the headline, so a wide card is not mostly air. */
  meter?: ReactNode;
  /**
   * Narrower columns for small stats with short labels and values, so three
   * fit in a row on a quarter-width card.
   */
  compactStats?: boolean;
  /** How the headline is worked out, where the title cannot say. */
  footnote?: ReactNode;
  /** Placement in the parent grid, e.g. a card two rows tall. */
  className?: string;
  children: ReactNode;
}) {
  return (
    // No panel of its own: these sit inside a ProfileSection, which is the
    // panel. A rule over each sets them apart on the grid instead.
    <div className={cn('min-w-0 border-t border-border pt-4', className)}>
      <h4 className='m-0 text-sm font-semibold text-muted-foreground'>
        {title}
      </h4>
      <div className='mt-2 text-3xl font-extrabold leading-none tabular-nums'>
        {lead}
      </div>
      {leadNote !== undefined && (
        <div className='mt-1.5 text-sm text-muted-foreground'>{leadNote}</div>
      )}
      {/* Flowed from the top rather than pinned to the bottom. The headlines
          are all the same height, so the bars and stat labels line up across
          cards; pinning to the bottom misaligned them whenever one card's small
          stats had a detail line and another's did not. */}
      <div className='mt-5'>
        {meter}
        {/* As many equal columns as fit, so four small stats sit in a row on
            a desktop and wrap to two rows on a phone rather than squeeze. */}
        <dl
          className={cn(
            'm-0 mt-4 grid',
            compactStats
              ? 'grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-3'
              : 'grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-4',
          )}
        >
          {children}
        </dl>
      </div>
      {footnote && (
        <p className='m-0 mt-5 text-sm text-muted-foreground'>{footnote}</p>
      )}
    </div>
  );
}

export function MiniStat({
  label,
  value,
  unit,
  detail,
  hint,
  info,
  tone = 'text-foreground',
}: {
  label: string;
  value: ReactNode;
  /** Trails the value in small type, e.g. the W on a streak. */
  unit?: string;
  /** Trails the value in muted type, e.g. which week a best score came in. */
  detail?: string | null;
  /**
   * What the stat counts, where its label cannot say it all, written in
   * small print under the value.
   */
  hint?: string;
  /** A fuller explanation, under the hint. */
  info?: ReactNode;
  tone?: string;
}) {
  return (
    <div className='flex flex-col'>
      <dt className='text-sm text-muted-foreground'>{label}</dt>
      <dd
        className={cn(
          'm-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold tabular-nums',
          tone,
        )}
      >
        <span>
          {value}
          {unit && (
            <span className='ml-0.5 text-sm font-semibold text-muted-foreground'>
              {unit}
            </span>
          )}
        </span>
        {/* Inline where it fits, so the small stats stay the same height and
            the cards level; a detail too long for its column wraps under the
            value, and then onto a second line, instead of running into the
            next stat. */}
        {detail && (
          <span className='min-w-0 text-sm font-normal text-muted-foreground'>
            {detail}
          </span>
        )}
      </dd>
      {(hint || info) && (
        <dd className='m-0 mt-1 grid gap-1 text-sm text-muted-foreground'>
          {hint && <span>{hint}</span>}
          {info && <span>{info}</span>}
        </dd>
      )}
    </div>
  );
}
