import RangeBar from './RangeBar';
import { TEXT } from './tones';
import clsx from 'clsx';

/**
 * A RangeBar with its two ends named underneath: the low in red on the left,
 * the high in green on the right. Which end is which is said by its place and
 * its label, so the colours only repeat it.
 */
export default function LabelledRange({
  low,
  high,
  mark,
  lowLabel,
  highLabel,
  format = String,
}: {
  low: number;
  high: number;
  mark: number;
  lowLabel: string;
  highLabel: string;
  format?: (value: number) => string;
}) {
  return (
    <>
      <RangeBar low={low} high={high} mark={mark} />
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        <span className='min-w-0 truncate'>
          <span className={clsx('font-semibold tabular-nums', TEXT.bad)}>
            {format(low)}
          </span>{' '}
          <span className='text-slate-400'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-slate-400'>{highLabel}</span>{' '}
          <span className={clsx('font-semibold tabular-nums', TEXT.good)}>
            {format(high)}
          </span>
        </span>
      </div>
    </>
  );
}
