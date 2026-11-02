import { YearFilter } from './segmented-control';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '~/utils';

/**
 * Where a week ranked in the field, on the value sequence: the lightest step
 * for the top fifth, the darkest for the bottom. Ranking rather than raw
 * points, so a week when the whole league scored low does not darken the
 * whole column. One hue stepping in lightness reads the same for every kind
 * of colour vision: bright is good, dark is bad.
 */
export const WEEK_SCALE = [
  { tone: 'bg-sequence-7 text-sequence-7-foreground', label: 'Top 20%' },
  { tone: 'bg-sequence-5 text-sequence-5-foreground', label: '60–80%' },
  { tone: 'bg-sequence-4 text-sequence-4-foreground', label: '40–60%' },
  { tone: 'bg-sequence-2 text-sequence-2-foreground', label: '20–40%' },
  { tone: 'bg-sequence-1 text-sequence-1-foreground', label: 'Bottom 20%' },
];

/**
 * A week won is set in underlined type, so it stands out by shape and never
 * relies on its colour, which it shares with the rest of the top band.
 */
export const WEEK_WON_TEXT = 'underline decoration-2 underline-offset-2';

/** The band a week falls in by its rank. A week won is always the top one. */
export function rankTone(rank: number, fieldSize: number): string {
  const percentile = fieldSize > 1 ? (fieldSize - rank) / (fieldSize - 1) : 1;
  const band =
    rank === 1
      ? 0
      : [0.8, 0.6, 0.4, 0.2].findIndex(floor => percentile >= floor);
  return WEEK_SCALE[band === -1 ? WEEK_SCALE.length - 1 : band].tone;
}

export type WeekGridCell = {
  /** What the square shows - a score, a net, a count. */
  value: ReactNode;
  /** Everything about the week, for hover and for screen readers. */
  title: string;
  tone: string;
  won?: boolean;
  /** Drawn over the square, e.g. a corner notch. */
  marker?: ReactNode;
  className?: string;
};

export type WeekGridRow = {
  year: number;
  /** Indexed by week number; a week with nothing in it is left out. */
  weeks: Map<number, WeekGridCell>;
};

/**
 * Every season as a strip of weeks, so a career's hot and cold runs show.
 *
 * Seventeen-odd columns do not fit a phone, and a grid that scrolls sideways
 * hides most of what it is for. Below desktop width it shows one season at a
 * time instead, its weeks wrapped into rows, each square carrying its week
 * number since there is no header row to read it from.
 */
export function WeekGrid({
  rows,
  lastWeek,
  minColumn = '3rem',
}: {
  /** Newest first, as the year buttons read. */
  rows: WeekGridRow[];
  lastWeek: number;
  /** The narrowest a week's column gets on a desktop. */
  minColumn?: string;
}) {
  const [year, setYear] = useState(rows[0]?.year);
  const row = rows.find(entry => entry.year === year) ?? rows[0];
  const weekNumbers = Array.from({ length: lastWeek }, (_, i) => i + 1);

  return (
    <>
      {/* Focusable, so the weeks past the edge can be scrolled to from the
          keyboard. */}
      <div
        className='relative hidden overflow-x-auto lg:block'
        role='region'
        aria-label='Weeks by season'
        tabIndex={0}
      >
        <div
          className='grid gap-1 p-0.5 text-sm xl:gap-1.5'
          style={{
            gridTemplateColumns: `3rem repeat(${lastWeek}, minmax(${minColumn}, 1fr))`,
          }}
        >
          <div />
          {weekNumbers.map(week => (
            <div key={week} className='text-center text-muted-foreground'>
              {week}
            </div>
          ))}

          {rows.map(entry => (
            <SeasonStrip key={entry.year} year={entry.year}>
              {weekNumbers.map(week => (
                <Square key={week} cell={entry.weeks.get(week)} />
              ))}
            </SeasonStrip>
          ))}
        </div>
      </div>

      {row && (
        <div className='lg:hidden'>
          {rows.length > 1 && (
            <YearFilter
              years={rows.map(entry => entry.year)}
              value={row.year}
              onChange={value => value !== 'all' && setYear(value)}
              showAll={false}
            />
          )}
          <div className='mt-3 grid grid-cols-6 gap-1.5 text-sm sm:grid-cols-9'>
            {weekNumbers.map(week => (
              <Square
                key={week}
                cell={row.weeks.get(week)}
                week={week}
                labelled
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SeasonStrip({
  year,
  children,
}: {
  year: number;
  children: ReactNode;
}) {
  return (
    <>
      <div className='flex h-8 items-center font-semibold tabular-nums'>
        {year}
      </div>
      {children}
    </>
  );
}

function Square({
  cell,
  week,
  labelled = false,
}: {
  cell: WeekGridCell | undefined;
  week?: number;
  /** Prints the week number in the square, for the wrapped layout. */
  labelled?: boolean;
}) {
  const number = labelled && (
    <span aria-hidden='true' className='text-sm font-normal opacity-80'>
      {week}
    </span>
  );

  if (!cell) {
    return (
      <div
        aria-hidden='true'
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          labelled ? 'h-11 flex-col' : 'h-8',
        )}
      >
        {number}
      </div>
    );
  }

  return (
    <div
      title={cell.title}
      className={cn(
        // Relative, so the marker sits in the square and the sr-only text is
        // placed within the scroller rather than stretching the page.
        'relative flex items-center justify-center font-semibold tabular-nums',
        labelled ? 'h-11 flex-col' : 'h-8',
        cell.tone,
        cell.className,
      )}
    >
      {number}
      <span className={cn(cell.won && WEEK_WON_TEXT)}>{cell.value}</span>
      {cell.marker}
      <span className='sr-only'>. {cell.title}</span>
    </div>
  );
}

/** A square as the legend draws it, at a smaller size. */
export function LegendSwatch({
  tone,
  className,
  children,
}: {
  tone: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'relative inline-flex h-4 w-5 items-center justify-center',
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** One entry in a grid's legend: a swatch, then what it means. */
export function LegendItem({
  swatch,
  children,
}: {
  swatch: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      {swatch}
      {children}
    </span>
  );
}

/** A week won, drawn as a top-band square with its value underlined. */
export function WonKey({
  sample,
  tone = WEEK_SCALE[0].tone,
}: {
  sample: string;
  tone?: string;
}) {
  return (
    <LegendItem
      swatch={
        <LegendSwatch tone={tone} className='w-10 text-sm'>
          <span className={cn('font-semibold', WEEK_WON_TEXT)}>{sample}</span>
        </LegendSwatch>
      }
    >
      Week won
    </LegendItem>
  );
}

/** The five bands, best to worst, with the two ends named. */
export function ScaleKey() {
  return (
    <span className='inline-flex items-center gap-1'>
      {WEEK_SCALE[0].label}
      {WEEK_SCALE.map(({ tone, label }) => (
        <span key={tone} title={label}>
          <LegendSwatch tone={tone} />
        </span>
      ))}
      {WEEK_SCALE[WEEK_SCALE.length - 1].label}
    </span>
  );
}

export function WeekLegend({ children }: { children: ReactNode }) {
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground'>
      {children}
    </div>
  );
}

/** A legend set in a row that wraps, for a section's key above its grid. */
export function KeyList({ children }: { children: ReactNode }) {
  return (
    <span className='flex flex-wrap items-center gap-x-4 gap-y-1.5'>
      {children}
    </span>
  );
}
