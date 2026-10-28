/**
 * Bars for rank, share and spread, built on the grid: flat tracks of the
 * secondary surface with solid fills, square ends, and no gradients. Each
 * says in words or position what its colour shows, so the colour only
 * repeats it.
 */
import { type Fill, FILLS, positionFill } from './fills';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

const TRACK = 'relative h-2 bg-secondary';

/** A bar segment: a fill token, or a class for the semantic colours. */
export type Tone = Fill | 'positive' | 'negative' | 'neutral' | 'foreground';

const TONES: Record<Exclude<Tone, Fill>, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  neutral: 'bg-muted-foreground',
  foreground: 'bg-foreground',
};

const toneClass = (tone: Tone) =>
  tone in TONES ? TONES[tone as keyof typeof TONES] : FILLS[tone as Fill];

/**
 * Wins against losses (and ties) as one bar, in proportion. Wins always come
 * first and losses last, so the order says which is which as well as the
 * colour does.
 */
export function SplitBar({
  wins,
  losses,
  ties = 0,
}: {
  wins: number;
  losses: number;
  ties?: number;
}) {
  return (
    <KeyedBar
      showKey={false}
      entries={[
        { label: 'Won', count: wins, tone: 'positive' },
        { label: 'Tied', count: ties, tone: 'neutral' },
        { label: 'Lost', count: losses, tone: 'negative' },
      ]}
    />
  );
}

export type BarKeyEntry = { count: number; label: string; tone: Tone };

/** The counts under a bar, each beside a square of its colour. */
export function BarKey({ entries }: { entries: BarKeyEntry[] }) {
  return (
    <ul className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground'>
      {entries.map(({ count, label, tone }) => (
        <li key={label} className='inline-flex items-center gap-1.5'>
          <span
            aria-hidden
            className={cn('inline-block size-2.5', toneClass(tone))}
          />
          <span className='font-semibold tabular-nums text-foreground'>
            {count}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A bar split into parts in proportion, with its key underneath. The bar is
 * hidden from screen readers; the key says the same in words.
 */
export function KeyedBar({
  entries,
  showKey = true,
}: {
  entries: BarKeyEntry[];
  showKey?: boolean;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <>
      <div aria-hidden className={cn(TRACK, 'flex gap-0.5 overflow-hidden')}>
        {total > 0 &&
          entries
            .filter(entry => entry.count > 0)
            .map(entry => (
              <div
                key={entry.label}
                className={toneClass(entry.tone)}
                style={{ width: `${(entry.count / total) * 100}%` }}
              />
            ))}
      </div>
      {showKey && <BarKey entries={entries} />}
    </>
  );
}

/** A tick across a track, marking one value on it. */
function Tick({ at, className }: { at: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 bg-foreground',
        className,
      )}
      style={{ left: `${Math.min(Math.max(at, 0), 1) * 100}%` }}
    />
  );
}

/**
 * Where a rank sits in its field, as a bar filled from the left: first fills
 * it, last leaves a sliver. The rank itself is written beside it.
 */
export function RankBar({
  rank,
  fieldSize,
  fill = 'sequence-5',
  label,
}: {
  rank: number;
  fieldSize: number;
  fill?: Fill;
  /** Written beside the bar; defaults to "3rd of 12". */
  label?: ReactNode;
}) {
  const share = fieldSize > 1 ? (fieldSize - rank) / (fieldSize - 1) : 1;
  return (
    <div className='flex items-center gap-3'>
      <div aria-hidden className={cn(TRACK, 'flex-1')}>
        <div
          className={cn('h-full', FILLS[fill])}
          style={{ width: `${Math.max(share, 0.02) * 100}%` }}
        />
      </div>
      <span className='w-20 shrink-0 text-right text-sm tabular-nums'>
        {label ?? `${ordinal(rank)} of ${fieldSize}`}
      </span>
    </div>
  );
}

const ordinal = (n: number) => {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th';
  return `${n}${suffix}`;
};

/**
 * Worst to best as a track, with the average marked on it: how far a
 * typical week sits from the floor and the ceiling.
 */
export function RangeBar({
  low,
  high,
  mark,
}: {
  low: number;
  high: number;
  mark: number;
}) {
  return (
    <div aria-hidden className={TRACK}>
      <Tick at={high > low ? (mark - low) / (high - low) : 0.5} />
    </div>
  );
}

/**
 * A RangeBar with its two ends named underneath: the low on the left, the
 * high on the right, each in its state's colour.
 */
export function LabelledRange({
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
      <div className='mt-2 flex justify-between gap-2 text-sm'>
        <span className='min-w-0 truncate'>
          <span className='font-semibold tabular-nums text-negative'>
            {format(low)}
          </span>{' '}
          <span className='text-muted-foreground'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-muted-foreground'>{highLabel}</span>{' '}
          <span className='font-semibold tabular-nums text-positive'>
            {format(high)}
          </span>
        </span>
      </div>
    </>
  );
}

/**
 * Results on a bottom-to-top track, one square each, translucent so where
 * they cluster shows as a denser patch. The average is the tall tick.
 */
export function PercentileStrip({
  values,
  average,
  label,
}: {
  /** Each result, 0 (bottom of the field) to 1 (top). */
  values: number[];
  average: number | null;
  /** Hover text for one result. */
  label?: (value: number, index: number) => string;
}) {
  return (
    <div className={TRACK}>
      {values.map((value, index) => (
        <div
          key={index}
          title={label?.(value, index)}
          className='absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 bg-sequence-6/50'
          style={{ left: `${value * 100}%` }}
        />
      ))}
      {average !== null && <Tick at={average} />}
    </div>
  );
}

/**
 * A roster split by position, each part in its position's colour with its
 * count written in it where it fits. Positions without a colour of their own
 * (K, Other) share the neutral. The small one is fainter, for a comparison
 * set right under a full-size bar.
 */
export function PositionBar({
  counts,
  label,
  size = 'normal',
}: {
  /** Count by position, in the order the bar should run: QB, RB, WR, TE. */
  counts: Record<string, number>;
  /** Read by screen readers in place of the bar. */
  label?: string;
  size?: 'normal' | 'small';
}) {
  const groups = Object.entries(counts).filter(([, count]) => count > 0);
  const total = groups.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div
      role='img'
      aria-label={
        label ?? groups.map(([group, count]) => `${count} ${group}`).join(', ')
      }
      className={cn(
        'flex w-full gap-0.5 overflow-hidden bg-secondary',
        size === 'small' ? 'h-4 opacity-70' : 'h-6',
      )}
    >
      {total > 0 &&
        groups.map(([group, count]) => {
          const fill = positionFill(group);
          return (
            <div
              key={group}
              className={cn(
                'flex items-center justify-center overflow-hidden whitespace-nowrap text-sm font-semibold tabular-nums',
                fill ? FILLS[fill] : 'bg-muted-foreground text-background',
              )}
              style={{ width: `${(count / total) * 100}%` }}
            >
              {/* A sliver too narrow for its label is still named by the
                  bar's label. */}
              {size === 'normal' &&
                count / total >= 0.08 &&
                `${group === 'Other' ? 'OTH' : group} ${count}`}
            </div>
          );
        })}
    </div>
  );
}

export type Tally = {
  key: string;
  label: ReactNode;
  count: number;
  /** A second fact written after the count, such as the points it scored. */
  detail?: string;
};

/**
 * How many times each thing was chosen, most first: a bar per row in
 * proportion to the most chosen, with the count written beside it.
 */
export function TallyBars({
  tallies,
  unit = ['pick', 'picks'],
}: {
  tallies: Tally[];
  /** What a count is of, singular and plural, for the hover text. */
  unit?: [string, string];
}) {
  const most = Math.max(1, ...tallies.map(tally => tally.count));
  const sorted = [...tallies].sort((a, b) => b.count - a.count);
  const hasDetail = sorted.some(tally => tally.detail);

  return (
    <ul className='grid gap-2'>
      {sorted.map(tally => (
        <li
          key={tally.key}
          className={cn(
            'grid items-center gap-3 text-sm',
            hasDetail
              ? 'grid-cols-[minmax(0,9rem)_1fr_2rem_4.5rem]'
              : 'grid-cols-[minmax(0,9rem)_1fr_2rem]',
          )}
        >
          <span className='truncate'>{tally.label}</span>
          <div
            className={TRACK}
            title={`${tally.count} ${unit[tally.count === 1 ? 0 : 1]}`}
          >
            <div
              className='h-full bg-sequence-5'
              style={{ width: `${(tally.count / most) * 100}%` }}
            />
          </div>
          <span className='text-right font-semibold tabular-nums'>
            {tally.count}
          </span>
          {hasDetail && (
            <span className='text-right tabular-nums text-muted-foreground'>
              {tally.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
