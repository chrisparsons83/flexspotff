import { ProfileLink } from '~/components/ui/profile-link';
import { LeagueMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import type { RecordRow } from '~/models/records.server';

type Props = {
  title: string;
  headers: string[];
  rows: RecordRow[];
};

export default function RecordsTable({ title, headers, rows }: Props) {
  const league = headers.indexOf('League');

  return (
    <Table headers={['Rank', ...headers]} numericColumns={[0]} caption={title}>
      {rows.map((row, index) => (
        <tr key={index}>
          <td className='text-right text-muted-foreground'>{index + 1}</td>
          {row.cells.map((cell, i) => (
            <td key={i}>
              {/* The first cell is always the player. Rows that aggregate
                  several members carry no id and stay plain text. */}
              {i === 0 && row.playerUserId ? (
                <ProfileLink userId={row.playerUserId}>{cell}</ProfileLink>
              ) : i === league && cell ? (
                <LeagueMark name={String(cell)} />
              ) : (
                cell
              )}
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}
