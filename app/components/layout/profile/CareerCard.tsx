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
  children,
}: {
  title: string;
  lead: ReactNode;
  leadNote: ReactNode;
  /** A full-width bar under the headline, so a wide card is not mostly air. */
  meter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='rounded-md bg-slate-900/50 p-4'>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>{title}</h4>
      <div className='mt-2 text-3xl font-bold leading-none text-white tabular-nums'>
        {lead}
      </div>
      <div className='mt-1.5 text-sm text-slate-400'>{leadNote}</div>
      {/* Flowed from the top rather than pinned to the bottom. The headlines
          are all the same height, so the bars and stat labels line up across
          cards; pinning to the bottom misaligned them whenever one card's small
          stats had a detail line and another's did not. */}
      <div className='mt-5'>
        {meter}
        <dl className='m-0 mt-4 grid auto-cols-fr grid-flow-col gap-4'>
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
  tone = 'text-slate-100',
}: {
  label: string;
  value: ReactNode;
  /** Trails the value in small type, e.g. the W on a streak. */
  unit?: string;
  /** Trails the value in muted type, e.g. which week a best score came in. */
  detail?: string | null;
  tone?: string;
}) {
  return (
    <div className='flex flex-col'>
      <dt className='text-xs text-slate-400'>{label}</dt>
      <dd className={clsx('m-0 mt-0.5 text-xl font-bold tabular-nums', tone)}>
        {value}
        {unit && (
          <span className='ml-0.5 text-xs font-semibold text-slate-400'>
            {unit}
          </span>
        )}
        {/* Inline rather than on a line of its own, so every small stat is the
            same height and the cards stay level. */}
        {detail && (
          <span className='ml-2 text-xs font-normal text-slate-500'>
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}
