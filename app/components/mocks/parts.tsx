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
 * A section's heading, set on the grid with a rule above it. Drop the rule
 * when something just above already draws one, such as a SubNav.
 */
export function Section({
  title,
  children,
  className,
  rule = true,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  rule?: boolean;
}) {
  return (
    <section className={clsx(rule && 'border-t border-border pt-4', className)}>
      <h2 className='mb-6 text-lg font-semibold'>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Sub-navigation for a section's pages. The current page is marked by a bar
 * under it, not by colour.
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
                'block whitespace-nowrap border-b-2 py-3 text-sm',
                item.label === current
                  ? 'border-foreground font-semibold text-foreground'
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
