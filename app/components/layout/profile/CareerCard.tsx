import InfoTip from './InfoTip';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * One topic of a tab's Career section, led by the number that sums it up
 * rather than a tile per number. The small stats go in as `MiniStat`s.
 */
export default function CareerCard({
  title,
  lead,
  leadNote,
  meter,
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
  /** Placement in the parent grid, e.g. a card two rows tall. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx('rounded-md bg-slate-900/50 p-3 sm:p-4', className)}>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>{title}</h4>
      <div className='mt-2 text-3xl font-bold leading-none text-white tabular-nums'>
        {lead}
      </div>
      {leadNote !== undefined && (
        <div className='mt-1.5 text-sm text-slate-400'>{leadNote}</div>
      )}
      {/* Flowed from the top rather than pinned to the bottom. The headlines
          are all the same height, so the bars and stat labels line up across
          cards; pinning to the bottom misaligned them whenever one card's small
          stats had a detail line and another's did not. */}
      <div className='mt-5'>
        {meter}
        {/* As many equal columns as fit, so four small stats sit in a row on
            a desktop and wrap to two rows on a phone rather than squeeze. */}
        <dl className='m-0 mt-4 grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-4'>
          {children}
        </dl>
      </div>
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
  tone = 'text-slate-100',
}: {
  label: string;
  value: ReactNode;
  /** Trails the value in small type, e.g. the W on a streak. */
  unit?: string;
  /** Trails the value in muted type, e.g. which week a best score came in. */
  detail?: string | null;
  /** Hover text for a stat whose label cannot say everything it counts. */
  hint?: string;
  /**
   * A fuller explanation behind an ⓘ beside the label, for a stat that needs
   * more than a line of hover text to make sense.
   */
  info?: ReactNode;
  tone?: string;
}) {
  return (
    <div className='flex flex-col'>
      <dt
        className={clsx(
          'flex items-center gap-1 text-xs text-slate-400',
          hint && 'cursor-help',
        )}
        title={hint}
      >
        {label}
        {info && <InfoTip label={`About ${label}`}>{info}</InfoTip>}
      </dt>
      <dd
        className={clsx(
          'm-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold tabular-nums',
          tone,
        )}
      >
        <span>
          {value}
          {unit && (
            <span className='ml-0.5 text-xs font-semibold text-slate-400'>
              {unit}
            </span>
          )}
        </span>
        {/* Inline where it fits, so the small stats stay the same height and
            the cards level; a detail too long for its column wraps under the
            value instead of running into the next stat. */}
        {detail && (
          <span className='whitespace-nowrap text-xs font-normal text-slate-500'>
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}
