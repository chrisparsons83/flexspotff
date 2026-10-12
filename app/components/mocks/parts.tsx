import { Link } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

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

/**
 * A flat layer: one step up from the ground, no border and no shadow. Pass a
 * league tint as `tone` to colour it.
 */
export function Panel({
  children,
  className,
  tone = 'bg-card',
}: {
  children: ReactNode;
  className?: string;
  tone?: string;
}) {
  return <div className={clsx(tone, 'p-6', className)}>{children}</div>;
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

/**
 * Sub-navigation for a section's pages. The current page is marked by a
 * coral bar under it.
 */
export function SubNav({
  items,
  current,
}: {
  items: { label: string; to: string }[];
  current: string;
}) {
  return (
    <nav aria-label='Section' className='border-b border-border'>
      <ul className='-mb-px flex gap-6 overflow-x-auto'>
        {items.map(item => (
          <li key={item.label}>
            <Link
              to={item.to}
              aria-current={item.label === current ? 'page' : undefined}
              className={clsx(
                'block whitespace-nowrap border-b-4 py-3 text-sm',
                item.label === current
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
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

/** The primary action on a page: a flat coral block. */
export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type='button'
      className='bg-primary px-5 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90'
    >
      {children}
    </button>
  );
}
