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
 * Sub-navigation for a section's pages. The current page is a raised accent
 * block with an ink outline; the rest are plain text.
 */
export function SubNav({
  items,
  current,
}: {
  items: { label: string; to: string }[];
  current: string;
}) {
  return (
    <nav aria-label='Section'>
      <ul className='flex gap-2 overflow-x-auto pb-1 pr-1'>
        {items.map(item => (
          <li key={item.label}>
            <Link
              to={item.to}
              aria-current={item.label === current ? 'page' : undefined}
              className={clsx(
                'block whitespace-nowrap border-2 px-3 py-1.5 text-sm',
                item.label === current
                  ? 'border-ink bg-primary font-semibold text-primary-foreground shadow-hard-sm'
                  : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
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

/**
 * The primary action: an accent block with an ink outline and a hard shadow.
 * Pressing it pushes it into its shadow.
 */
export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type='button'
      className='border-2 border-ink bg-primary px-5 py-3 font-bold text-primary-foreground shadow-hard transition-[transform,box-shadow] duration-fast active:translate-x-1 active:translate-y-1 active:shadow-none'
    >
      {children}
    </button>
  );
}

/**
 * Something to notice, drawn as an object: an ink outline and a hard
 * shadow. Ordinary panels stay flat; only these stand up off the page.
 */
export function Block({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('border-2 border-ink shadow-hard', className)}>
      {children}
    </div>
  );
}
