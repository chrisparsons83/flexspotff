import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/** Room around the plot for the axis labels. */
export const CHART = { height: 260, right: 12, top: 12, bottom: 28 };

/**
 * The element's width in pixels, so a chart can be drawn at its real size and
 * keep its labels at 11px on a phone and a desktop alike, rather than scaling
 * them with a viewBox. Starts from a guess for the server render.
 */
export function useChartWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/** Every other week once they get too close to label, as on a phone. */
export const weekLabelStep = (plotWidth: number, weeks: number) =>
  plotWidth / weeks < 24 ? 2 : 1;

/** One entry in a chart's key: a sample of the mark, then what it is. */
export function ChartKey({ children }: { children: ReactNode }) {
  return <span className='inline-flex items-center gap-1.5'>{children}</span>;
}

/**
 * The key for the field's band that sits behind every season chart, after the
 * member's own line: the middle half, the whole spread, and the median.
 */
export function FieldBandKeys({ rangeLabel }: { rangeLabel: string }) {
  return (
    <>
      <ChartKey>
        <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/30' />
        Middle half of the field
      </ChartKey>
      <ChartKey>
        <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/10' />
        {rangeLabel}
      </ChartKey>
      <ChartKey>
        <span className='inline-block w-4 border-t border-dashed border-slate-300' />
        Median
      </ChartKey>
    </>
  );
}

/** The footnote a chart's keys sit in, wrapping on a phone. */
export function ChartKeys({ children }: { children: ReactNode }) {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      {children}
    </span>
  );
}
