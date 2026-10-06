import YearFilter from './YearFilter';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useState } from 'react';

/**
 * Where a week ranked in the field, top to bottom as bright green to dark red.
 * Ranking rather than raw points, so a week when the whole league scored low
 * does not paint the whole column red.
 *
 * Lightness falls with the rank as well as the hue moving, and each band is a
 * clear step darker than the one above it, so the scale still reads for
 * red-green colour blindness: bright is good, dark is bad.
 */
export const WEEK_SCALE = [
  { tone: 'bg-emerald-300 text-emerald-950', label: 'Top 20%' },
  { tone: 'bg-emerald-500 text-emerald-950', label: '60–80%' },
  { tone: 'bg-slate-500 text-white', label: '40–60%' },
  { tone: 'bg-rose-800 text-rose-50', label: '20–40%' },
  { tone: 'bg-rose-950 text-rose-200', label: 'Bottom 20%' },
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
export default function WeekGrid({
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
      <div className='hidden overflow-x-auto lg:block'>
        <div
          className='grid gap-1.5 p-0.5 text-xs'
          style={{
            gridTemplateColumns: `3rem repeat(${lastWeek}, minmax(${minColumn}, 1fr))`,
          }}
        >
          <div />
          {weekNumbers.map(week => (
            <div key={week} className='text-center text-slate-400'>
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
          <div className='mt-3 grid grid-cols-6 gap-1.5 text-xs sm:grid-cols-9'>
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
      <div className='flex h-8 items-center font-medium tabular-nums text-slate-300'>
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
    <span aria-hidden='true' className='text-[0.6rem] font-normal opacity-80'>
      {week}
    </span>
  );

  if (!cell) {
    return (
      <div
        aria-hidden='true'
        className={clsx(
          'flex items-center justify-center rounded bg-slate-900/40 text-slate-500',
          labelled ? 'h-11 flex-col' : 'h-8',
        )}
      >
        {number}
        <span>·</span>
      </div>
    );
  }

  return (
    <div
      title={cell.title}
      className={clsx(
        // Relative, so the marker sits in the square and the sr-only text is
        // placed within the scroller rather than stretching the page.
        'relative flex items-center justify-center rounded font-semibold tabular-nums',
        labelled ? 'h-11 flex-col' : 'h-8',
        cell.tone,
        cell.className,
      )}
    >
      {number}
      <span className={clsx(cell.won && WEEK_WON_TEXT)}>{cell.value}</span>
      {cell.marker}
      <span className='sr-only'>. {cell.title}</span>
    </div>
  );
}

/** A square as the legend draws it, at a smaller size. */
export function Swatch({
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
      className={clsx(
        'relative inline-flex h-4 w-5 items-center justify-center rounded-sm',
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
        <Swatch tone={tone} className='w-8 text-[0.65rem]'>
          <span className={clsx('font-semibold', WEEK_WON_TEXT)}>{sample}</span>
        </Swatch>
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
          <Swatch tone={tone} />
        </span>
      ))}
      {WEEK_SCALE[WEEK_SCALE.length - 1].label}
    </span>
  );
}

export function WeekLegend({ children }: { children: ReactNode }) {
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400'>
      {children}
    </div>
  );
}
