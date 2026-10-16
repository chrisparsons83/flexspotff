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

/**
 * Helpers every chart on the site shares: drawing at the real width, thinning
 * week labels, and the key under the plot.
 */

/** One entry in a chart's key: a sample of the mark, then what it is. */
export function ChartKey({ children }: { children: ReactNode }) {
  return <span className='inline-flex items-center gap-1.5'>{children}</span>;
}

/** The footnote a chart's keys sit in, wrapping on a phone. */
export function ChartKeys({ children }: { children: ReactNode }) {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      {children}
    </span>
  );
}
