import type { ReactNode } from 'react';

/** A token as a CSS colour, read live so it follows the theme. */
export const tokenColor = (name: string) => `oklch(var(--${name}))`;

/** A Foundations page: a title, a line on what it covers, then sections. */
export function FoundationPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='mx-auto max-w-6xl pb-16'>
      <h1 className='text-4xl font-extrabold tracking-tight'>{title}</h1>
      <p className='mt-4 max-w-prose text-muted-foreground'>{intro}</p>
      <div className='mt-12 space-y-16'>{children}</div>
    </div>
  );
}

export function FoundationSection({
  title,
  about,
  children,
}: {
  title: string;
  about?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className='text-2xl font-extrabold tracking-tight'>{title}</h2>
      {about && (
        <p className='mt-2 max-w-prose text-muted-foreground'>{about}</p>
      )}
      <div className='mt-6'>{children}</div>
    </section>
  );
}

/** A table of token facts. The first column is the sample. */
export function TokenTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <table className='w-full text-left'>
      <thead>
        <tr className='text-sm text-muted-foreground'>
          {columns.map(column => (
            <th key={column} className='pb-2 pr-6 font-normal'>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className='tabular-nums'>{children}</tbody>
    </table>
  );
}

export function TokenRow({ cells }: { cells: ReactNode[] }) {
  return (
    <tr className='border-t border-border align-middle'>
      {cells.map((cell, i) => (
        <td key={i} className='py-3 pr-6'>
          {cell}
        </td>
      ))}
    </tr>
  );
}

/** Code-ish text for token and class names. */
export function Name({ children }: { children: ReactNode }) {
  return <code className='font-mono text-sm'>{children}</code>;
}
