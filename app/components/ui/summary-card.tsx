import MemberName from './MemberName';
import { Card, CardFooter, CardHeader, CardTitle } from './card';
import type { LeagueFill } from './fills';
import { Link } from './link';
import { ProfileLink } from './profile-link';
import type { ReactNode } from 'react';

export type SummaryRow = {
  key: string;
  /** Place in the table. Leave it out when the rows are not a ranking. */
  rank?: number;
  /** The member the row is about, linked to their profile. */
  user?: {
    id: string;
    discordName: string;
    discordUsername: string | null;
  } | null;
  /** Shown in place of a member: a team, pool or owner name. */
  label?: string;
  value: string;
};

/**
 * The top of one table on a section overview: a title linking to the full
 * page, where it stands in a line, and a few rows. Overviews lay several of
 * these side by side.
 */
export function SummaryCard({
  title,
  to,
  status,
  rows,
  empty,
  footer,
  league,
}: {
  title: string;
  to: string;
  /** Where the table stands, in a line: "Week 8 scored". */
  status?: string;
  rows: SummaryRow[];
  /** Shown when there are no rows yet. */
  empty: string;
  /** A link of the reader's own, such as their entries. */
  footer?: ReactNode;
  league?: LeagueFill;
}) {
  const ranked = rows.some(row => row.rank !== undefined);

  return (
    <Card league={league}>
      <CardHeader>
        <CardTitle>
          <Link to={to} variant='quiet'>
            {title}
          </Link>
        </CardTitle>
      </CardHeader>
      {status && (
        <p className='px-5 pt-3 text-sm text-muted-foreground'>{status}</p>
      )}
      {rows.length === 0 ? (
        <p className='px-5 py-3 text-sm text-muted-foreground'>{empty}</p>
      ) : (
        <ol className='px-5 py-2'>
          {rows.map(row => (
            <li
              key={row.key}
              className={
                ranked
                  ? 'grid grid-cols-[1.5rem_1fr_auto] gap-2 py-1 text-sm'
                  : 'grid grid-cols-[1fr_auto] gap-2 py-1 text-sm'
              }
            >
              {ranked && (
                <span className='text-muted-foreground'>{row.rank}</span>
              )}
              <span className='truncate'>
                {row.user ? (
                  <ProfileLink userId={row.user.id}>
                    <MemberName user={row.user} />
                  </ProfileLink>
                ) : (
                  row.label
                )}
              </span>
              <span className='text-right font-semibold tabular-nums'>
                {row.value}
              </span>
            </li>
          ))}
        </ol>
      )}
      {footer && <CardFooter className='pt-2'>{footer}</CardFooter>}
    </Card>
  );
}
