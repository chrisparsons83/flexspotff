import type { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { FOCUS_RING } from '~/components/ui/styles';
import { cn } from '~/utils';

/**
 * One topic of a tab's Career section, led by the number that sums it up
 * rather than a tile per number. The small stats go in as `MiniStat`s, in
 * one row.
 *
 * What a stat counts, where its label cannot say it all, opens from the
 * label on a tap or a click, so it reaches a phone too.
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
    // A lighter panel inside the ProfileSection, which sets each apart with
    // room around it, rather than a rule over the top.
    <div className={cn('min-w-0 bg-secondary p-4 md:p-5', className)}>
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
        {/* One row, each column at least as wide as its value, so a value
            never breaks. */}
        <dl
          className={cn(
            'm-0 mt-4 grid auto-cols-[minmax(min-content,1fr)] grid-flow-col',
            compactStats ? 'gap-3' : 'gap-4',
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
  /** Under the value in muted type, e.g. which week a best score came in. */
  detail?: string | null;
  /**
   * What the stat counts, where its label cannot say it all. It opens from
   * the label, which is underlined with dots to say so.
   */
  hint?: string;
  /** A fuller explanation, after the hint. */
  info?: ReactNode;
  tone?: string;
}) {
  return (
    <div className='flex flex-col'>
      <dt className='text-sm text-muted-foreground'>
        {hint || info ? (
          <Popover>
            <PopoverTrigger
              className={cn(
                'cursor-help text-left underline decoration-dotted underline-offset-4',
                FOCUS_RING,
              )}
            >
              {label}
            </PopoverTrigger>
            <PopoverContent className='grid w-64 gap-1 text-sm'>
              <p className='m-0 font-semibold text-foreground'>{label}</p>
              {hint && <p className='m-0 text-muted-foreground'>{hint}</p>}
              {info && <div className='text-muted-foreground'>{info}</div>}
            </PopoverContent>
          </Popover>
        ) : (
          label
        )}
      </dt>
      <dd
        className={cn(
          'm-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold tabular-nums',
          tone,
        )}
      >
        <span className='whitespace-nowrap'>
          {value}
          {unit && (
            <span className='ml-0.5 text-sm font-semibold text-muted-foreground'>
              {unit}
            </span>
          )}
        </span>
      </dd>
      {/* Always its own line under the value, so every stat with one has
          the same shape. */}
      {detail && (
        <dd className='m-0 mt-0.5 text-sm text-muted-foreground'>{detail}</dd>
      )}
    </div>
  );
}
