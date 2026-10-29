import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';

/**
 * Where the game's week stands, for its overview: which week, whether picks
 * are open, and the way to your entry.
 */
export default function ThisWeek({
  week,
  status,
  entryHref,
  entryLabel,
  entry,
  standingsHref,
  standingsWeek = week ?? undefined,
  children,
}: {
  week: number | null;
  /** In a few words: "Open for picks", "Scored". */
  status: string;
  entryHref?: string;
  /** The entry button's words, where "your week's picks" does not fit. */
  entryLabel?: string;
  /** Whether the reader has saved picks for the week, and what they are. */
  entry?: { saved: boolean; summary?: string };
  /** The latest standings with results, which may be an earlier week. */
  standingsHref?: string;
  /** The week those standings are for. Defaults to this week. */
  standingsWeek?: number;
  children?: ReactNode;
}) {
  if (week === null) {
    return (
      <Section title='This Week'>
        <p className='text-muted-foreground'>No weeks set up yet.</p>
      </Section>
    );
  }

  return (
    <Section
      title={`Week ${week}`}
      description={status}
      action={
        standingsHref && (
          <Link to={standingsHref}>Week {standingsWeek} Standings</Link>
        )
      }
    >
      {children}
      {entry && (
        <p className='mb-4'>
          {entry.saved ? (
            <>
              <span className='font-semibold text-positive'>
                Your picks are saved.
              </span>
              {entry.summary && (
                <span className='text-muted-foreground'> {entry.summary}</span>
              )}
            </>
          ) : (
            <span className='text-muted-foreground'>
              You have not saved any picks for week {week} yet.
            </span>
          )}
        </p>
      )}
      {entryHref && (
        <Button asChild>
          <Link to={entryHref} variant='quiet'>
            {entryLabel ??
              (entry?.saved
                ? `Change your week ${week} picks`
                : `Make Your Week ${week} Picks`)}
          </Link>
        </Button>
      )}
    </Section>
  );
}
