import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Sits under the title, for what the section is actually counting. */
  description?: string;
  /** Controls belonging to this section, e.g. the game log's year filter. */
  action?: ReactNode;
  /** Small print under the content, e.g. the median-games caveat. */
  footnote?: ReactNode;
  children: ReactNode;
};

/**
 * One block of a profile tab.
 *
 * The sections used to be bare `<section><h3>` pairs, so a tab read as one
 * undivided column of tables - the hero was the only thing on the page with an
 * edge. Each block gets its own panel instead, one step lighter than the page
 * behind it, with the stat tiles inside a step darker again. That ordering is
 * what makes the nesting legible; the headings are `not-prose` for the same
 * reason, since prose sizing made every title compete with the member's name.
 */
export default function ProfileSection({
  title,
  description,
  action,
  footnote,
  children,
}: Props) {
  return (
    <section className='not-prose rounded-lg border border-slate-600/50 bg-slate-800/60 p-4 md:p-5'>
      <div className='mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2'>
        <div>
          <h3 className='m-0 text-lg font-semibold text-white'>{title}</h3>
          {description && (
            <p className='m-0 mt-0.5 text-sm text-slate-400'>{description}</p>
          )}
        </div>
        {action}
      </div>

      {children}

      {footnote && <p className='mt-3 text-xs text-slate-400'>{footnote}</p>}
    </section>
  );
}
