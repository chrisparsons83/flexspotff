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
  standingsHref,
  children,
}: {
  week: number | null;
  /** In a few words: "Open for picks", "Scored". */
  status: string;
  entryHref?: string;
  /** The week's standings, once there are any. */
  standingsHref?: string;
  children?: ReactNode;
}) {
  if (week === null) {
    return (
      <Section title='This week'>
        <p className='text-muted-foreground'>No weeks set up yet.</p>
      </Section>
    );
  }

  return (
    <Section
      title={`Week ${week}`}
      description={status}
      action={
        standingsHref && <Link to={standingsHref}>Week {week} standings</Link>
      }
    >
      {children}
      {entryHref && (
        <Button asChild>
          <Link to={entryHref} variant='quiet'>
            Your week {week} entry
          </Link>
        </Button>
      )}
    </Section>
  );
}
