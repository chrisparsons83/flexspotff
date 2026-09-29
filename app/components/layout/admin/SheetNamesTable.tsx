import { Form, Link } from '@remix-run/react';
import Button from '~/components/ui/FlexSpotButton';
import type { SelectableMember } from '~/components/ui/MemberSelect';
import MemberSelect from '~/components/ui/MemberSelect';
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
    <>
      <h3>Names ({names.length})</h3>
      <p>
        Match every name in the sheet to a member. A name that belongs to
        someone who never joined the site can get a stub member instead, which
        can be merged into their real account later from{' '}
        <Link to='/admin/members/merge'>Merge members</Link>. Matches are saved
        as you go and reused by later imports.
      </p>
      {unmatched.length > 0 && (
        <table className='w-full'>
          <thead>
            <tr>
              <th>Sheet name</th>
              <th>Picks</th>
              <th>Member</th>
            </tr>
          </thead>
          <tbody>
            {unmatched.map(name => (
              <tr key={name.alias}>
                <td>{name.spellings.join(', ')}</td>
                <td>{name.picks}</td>
                <td className='not-prose'>
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
                        Create stub member
                      </Button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {matched.length > 0 && (
        <details open={unmatched.length === 0}>
          <summary>{matched.length} matched</summary>
          <table className='w-full'>
            <thead>
              <tr>
                <th>Sheet name</th>
                <th>Picks</th>
                <th>Member</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matched.map(name => (
                <tr key={name.alias}>
                  <td>{name.spellings.join(', ')}</td>
                  <td>{name.picks}</td>
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
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
