import { Link, useLocation } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Two levels of object. Everything that is a thing on the page gets an ink
 * outline. Things you can click also get a hard shadow and press into it;
 * the selected one shows already pressed in.
 */
export const OUTLINED = 'border-2 border-ink';
export const PRESSABLE = clsx(
  OUTLINED,
  'shadow-hard transition-[transform,box-shadow] duration-fast active:translate-x-1 active:translate-y-1 active:shadow-none',
);
export const PRESSABLE_SM = clsx(
  OUTLINED,
  'shadow-hard-sm transition-[transform,box-shadow] duration-fast active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
);
export const PRESSED_SM = clsx(OUTLINED, 'translate-x-0.5 translate-y-0.5');

/** Keeps the review toolbar's choices (the query string) on mock links. */
export function useMockHref() {
  const { search } = useLocation();
  return (to: string) => to + search;
}

/**
 * A square of a category colour. The edge class draws an outline only where
 * the fill is too faint for its ground; elsewhere it matches the fill.
 */
export function Square({
  fill,
  size = 'sm',
}: {
  fill: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-block shrink-0 border',
        size === 'sm' ? 'size-3' : 'size-6',
        fill,
      )}
    />
  );
}

/** A panel: one step up from the ground, outlined in ink. */
export function Panel({
  children,
  className,
  tone = 'bg-card',
}: {
  children: ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <div className={clsx(OUTLINED, tone, 'p-6', className)}>{children}</div>
  );
}

/** A section's heading, set on the grid. */
export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className='mb-4 text-xl font-bold'>{title}</h2>
      {children}
    </section>
  );
}

/** Sub-navigation for a section's pages, as a row of pressable tabs. */
export function SubNav({
  items,
  current,
}: {
  items: { label: string; to: string }[];
  current: string;
}) {
  const href = useMockHref();
  return (
    <nav aria-label='Section'>
      <ul className='flex gap-3 overflow-x-auto pb-1 pr-1'>
        {items.map(item => (
          <li key={item.label}>
            <Link
              to={href(item.to)}
              aria-current={item.label === current ? 'page' : undefined}
              className={clsx(
                'block whitespace-nowrap px-3 py-1.5 text-sm',
                item.label === current
                  ? clsx(
                      PRESSED_SM,
                      'bg-primary font-semibold text-primary-foreground',
                    )
                  : clsx(PRESSABLE_SM, 'bg-card hover:bg-secondary'),
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The primary action: an accent block that presses into its shadow. */
export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type='button'
      className={clsx(
        PRESSABLE,
        'bg-primary px-5 py-3 font-bold text-primary-foreground',
      )}
    >
      {children}
    </button>
  );
}
