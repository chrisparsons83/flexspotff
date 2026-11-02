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
  /**
   * Whether the reader has saved picks for the week, and a few numbers on
   * them: "Bets 1", "Points Bet 10".
   */
  entry?: { saved: boolean; stats?: { label: string; value: string }[] };
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
        <dl className='m-0 mb-6 flex flex-wrap gap-x-10 gap-y-3'>
          <div>
            <dt className='text-sm text-muted-foreground'>Your Picks</dt>
            <dd
              className={
                entry.saved
                  ? 'm-0 mt-0.5 text-xl font-bold text-positive'
                  : 'm-0 mt-0.5 text-xl font-bold text-warning'
              }
            >
              {entry.saved ? 'Saved' : 'Not Entered'}
            </dd>
          </div>
          {entry.saved &&
            entry.stats?.map(stat => (
              <div key={stat.label}>
                <dt className='text-sm text-muted-foreground'>{stat.label}</dt>
                <dd className='m-0 mt-0.5 text-xl font-bold tabular-nums'>
                  {stat.value}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {entryHref && (
        <Button asChild>
          <Link to={entryHref} variant='quiet'>
            {entryLabel ??
              (entry?.saved
                ? `Change Your Week ${week} Picks`
                : `Make Your Week ${week} Picks`)}
          </Link>
        </Button>
      )}
    </Section>
  );
}
