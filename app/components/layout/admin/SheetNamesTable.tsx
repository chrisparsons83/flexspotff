import { Form } from '@remix-run/react';
import type { SelectableMember } from '~/components/ui/MemberSelect';
import MemberSelect from '~/components/ui/MemberSelect';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import type { SheetName } from '~/libs/sheet-names';

type Props = {
  names: (SheetName & { suggestedMemberId: string })[];
  members: SelectableMember[];
  busy: boolean;
};

/**
 * The Names step of a sheet import: every name in the sheet, matched to a
 * member or waiting to be. Its forms post the actions that
 * `handleSheetNameAction` handles.
 */
export default function SheetNamesTable({ names, members, busy }: Props) {
  const unmatched = names.filter(name => !name.member);
  const matched = names.filter(name => name.member);

  return (
    <Section
      as='h3'
      title={`Names (${names.length})`}
      description={
        <>
          Match every name in the sheet to a member. A name that belongs to
          someone who never joined the site can get a stub member instead, which
          can be merged into their real account later from{' '}
          <Link to='/admin/members/merge'>Merge Members</Link>. Matches are
          saved as you go and reused by later imports.
        </>
      }
    >
      {unmatched.length > 0 && (
        <Table headers={['Sheet Name', 'Picks', 'Member']} numericColumns={[1]}>
          {unmatched.map(name => (
            <tr key={name.alias}>
              <td>{name.spellings.join(', ')}</td>
              <td className='text-right'>{name.picks}</td>
              <td>
                <div className='flex flex-wrap items-center gap-2'>
                  <Form method='POST' className='flex items-center gap-2'>
                    <input
                      type='hidden'
                      name='name'
                      value={name.spellings[0]}
                    />
                    <MemberSelect
                      name='userId'
                      members={members}
                      defaultValue={name.suggestedMemberId}
                    />
                    <Button
                      type='submit'
                      name='_action'
                      value='matchName'
                      disabled={busy}
                    >
                      Match
                    </Button>
                  </Form>
                  <Form method='POST'>
                    <input
                      type='hidden'
                      name='name'
                      value={name.spellings[0]}
                    />
                    <Button
                      type='submit'
                      name='_action'
                      value='createStub'
                      disabled={busy}
                    >
                      Create Stub Member
                    </Button>
                  </Form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {matched.length > 0 && (
        <details open={unmatched.length === 0} className='mt-6'>
          <summary className='mb-3 cursor-pointer font-semibold'>
            {matched.length} matched
          </summary>
          <Table
            headers={['Sheet Name', 'Picks', 'Member', '']}
            numericColumns={[1]}
          >
            {matched.map(name => (
              <tr key={name.alias}>
                <td>{name.spellings.join(', ')}</td>
                <td className='text-right'>{name.picks}</td>
                <td>{name.member?.discordName}</td>
                <td>
                  <Form method='POST'>
                    <input
                      type='hidden'
                      name='name'
                      value={name.spellings[0]}
                    />
                    <Button
                      type='submit'
                      name='_action'
                      value='unmatch'
                      disabled={busy}
                    >
                      Unmatch
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </Table>
        </details>
      )}
    </Section>
  );
}
