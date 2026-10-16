import type { ReactNode } from 'react';

type Props = {
  title: string;
  /**
   * Sits under the title, for what the section is actually counting. A full
   * sentence, ending in a full stop.
   */
  description?: string;
  /**
   * What the section's colours and marks mean, set out under the
   * description so it is on the page rather than behind a tap.
   */
  info?: ReactNode;
  /** Controls belonging to this section, e.g. the game log's year filter. */
  action?: ReactNode;
  /** Small print under the content, e.g. the median-games caveat. */
  footnote?: ReactNode;
  children: ReactNode;
};

/**
 * One block of a profile tab: a panel one step up from the page, flat, with
 * its title on the grid and any controls at the end of the title row.
 *
 * The padding steps down on a phone, where it would otherwise take a fifth of
 * the screen's width.
 */
export default function ProfileSection({
  title,
  description,
  info,
  action,
  footnote,
  children,
}: Props) {
  return (
    <section className='not-prose bg-card p-4 text-card-foreground sm:p-5 md:p-6'>
      <div className='mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
        <div>
          <h3 className='m-0 text-xl font-extrabold tracking-tight'>{title}</h3>
          {description && (
            <p className='m-0 mt-1 max-w-prose text-muted-foreground'>
              {description}
            </p>
          )}
          {info && (
            <div className='mt-2 max-w-prose text-sm text-muted-foreground'>
              {info}
            </div>
          )}
        </div>
        {action}
      </div>

      {children}

      {footnote && (
        <p className='mt-4 max-w-prose text-sm text-muted-foreground'>
          {footnote}
        </p>
      )}
    </section>
  );
}
