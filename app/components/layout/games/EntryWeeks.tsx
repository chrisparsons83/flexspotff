import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';

export type EntryWeek = {
  id: string;
  week: number;
  /** "Open", "Scored", "Not open yet". */
  status: string;
};

/** A member's weeks in a game this season, each linking to its entry. */
export default function EntryWeeks({ weeks }: { weeks: EntryWeek[] }) {
  return (
    <Section title='My Entries'>
      {weeks.length === 0 ? (
        <EmptyState title='No weeks set up yet this season' />
      ) : (
        <Table headers={['Week', 'Status']}>
          {weeks.map(week => (
            <tr key={week.id}>
              <td>
                <Link to={week.id}>Week {week.week}</Link>
              </td>
              <td className='text-muted-foreground'>{week.status}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
