import { Link, useLocation, useSearchParams } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Layers by lightness, the way Discord does it: a panel is a flat, solid
 * area one step up from the ground. No edges, no outlines, no blur.
 */
export const PANEL = 'bg-card';

/** Something you can click that is not a button: an accent edge on hover. */
export const CLICKABLE =
  'ring-0 ring-primary transition-shadow duration-fast hover:ring-2';

/** Keeps the review bar's choices (the query string) on mock links. */
export function useMockHref() {
  const { search } = useLocation();
  return (to: string) => to + search;
}

/** Whether the review bar has the main button's hard shadow switched on. */
function useButtonShadow() {
  const [params] = useSearchParams();
  return params.get('shadow') === 'on';
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

/** A panel; pass a league tint as `tone` to colour it. */
export function Panel({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: string;
}) {
  return <div className={clsx(PANEL, tone, 'p-6', className)}>{children}</div>;
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
      <h2 className='mb-4 text-xl font-bold tracking-tight'>{title}</h2>
      {children}
    </section>
  );
}

/** Sub-navigation for a section's pages: the current one is an accent block. */
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
      <ul className='flex gap-1 overflow-x-auto'>
        {items.map(item => (
          <li key={item.label}>
            <Link
              to={href(item.to)}
              aria-current={item.label === current ? 'page' : undefined}
              className={clsx(
                'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors duration-fast',
                item.label === current
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
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
 * The primary action: a full-colour accent block. With the review bar's
 * shadow switched on, it also gets the one hard offset shadow on the site
 * and presses into it.
 */
export function PrimaryButton({
  children,
  size = 'md',
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  const shadow = useButtonShadow();
  return (
    <button
      type='button'
      className={clsx(
        'rounded-md bg-primary font-bold text-primary-foreground transition-[background-color,transform,box-shadow] duration-fast hover:bg-primary/90',
        size === 'md' ? 'px-5 py-3' : 'px-4 py-2 text-sm',
        shadow &&
          'border-2 border-ink shadow-hard active:translate-x-1 active:translate-y-1 active:shadow-none',
      )}
    >
      {children}
    </button>
  );
}
