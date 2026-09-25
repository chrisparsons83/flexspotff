import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import MemberSelect from '~/components/ui/MemberSelect';
import type { SheetPick } from '~/libs/qb-streaming/history';
import { resolutionField } from '~/libs/qb-streaming/history';
import {
  FIRST_SITE_QB_STREAMING_YEAR,
  HistoryImportError,
  importQbStreamingHistory,
  previewQbStreamingHistory,
} from '~/libs/qb-streaming/history-import.server';
import {
  createStubMemberForAlias,
  deleteMemberAlias,
  upsertMemberAlias,
} from '~/models/memberAlias.server';
import { getUser, getUsers } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { createMemberSuggester } from '~/utils/names';

/** The Data tab of each season's sheet, from issue #155. */
const KNOWN_SHEETS: Record<number, string> = {
  2020: 'https://docs.google.com/spreadsheets/d/1q0Xjus1Wk_2aX2t8252U_4glALuQgcFEorj1OwZ_9BA/edit#gid=0',
  2021: 'https://docs.google.com/spreadsheets/d/1NpNDRic9wCvjesTRhXL6njKMlCG1PjTh8NM5nhhWnZE/edit#gid=0',
};
const IMPORTABLE_YEARS = Object.keys(KNOWN_SHEETS).map(Number);

const zSource = z.object({
  year: z.coerce
    .number()
    .int()
    .max(
      FIRST_SITE_QB_STREAMING_YEAR - 1,
      `QB streaming was run on the site from ${FIRST_SITE_QB_STREAMING_YEAR}.`,
    ),
  sheet: z.string().min(1, 'Paste a link to the sheet.'),
});

const zName = z.string().trim().min(1, 'No sheet name was submitted.');

const errorMessage = (error: unknown) => {
  if (error instanceof HistoryImportError) return error.message;
  throw error;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const formData = await request.formData();
  const fail = (message: string) =>
    typedjson({ message, status: 'error' as const });

  switch (formData.get('_action')) {
    case 'matchName': {
      const name = zName.safeParse(formData.get('name'));
      const userId = z
        .string()
        .min(1, 'Pick a member to match this name to.')
        .safeParse(formData.get('userId'));
      if (!name.success) return fail(name.error.issues[0].message);
      if (!userId.success) return fail(userId.error.issues[0].message);

      const member = await getUser(userId.data);
      if (!member) return fail('Member not found.');
      // The picker only lists live members, so a merged-away one came from a
      // form loaded before the merge.
      if (member.mergedIntoId) {
        return fail(
          `${member.discordName} was merged into another member. Reload the page and pick the member they were merged into.`,
        );
      }

      await upsertMemberAlias(name.data, member.id);
      return typedjson({
        message: `${name.data} is now matched to ${member.discordName}.`,
        status: 'success' as const,
      });
    }
    case 'createStub': {
      const name = zName.safeParse(formData.get('name'));
      if (!name.success) return fail(name.error.issues[0].message);

      await createStubMemberForAlias(name.data);
      return typedjson({
        message: `Created a stub member for ${name.data}. Merge it into their real account if they ever join.`,
        status: 'success' as const,
      });
    }
    case 'unmatch': {
      const name = zName.safeParse(formData.get('name'));
      if (!name.success) return fail(name.error.issues[0].message);

      await deleteMemberAlias(name.data);
      return typedjson({
        message: `${name.data} is no longer matched to anyone.`,
        status: 'success' as const,
      });
    }
    case 'import': {
      const source = zSource.safeParse({
        year: formData.get('year'),
        sheet: formData.get('sheet'),
      });
      if (!source.success) return fail(source.error.issues[0].message);

      const resolutions: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('pick:') && typeof value === 'string') {
          resolutions[key] = value;
        }
      }

      try {
        // Re-read everything rather than trusting the page, which may be stale.
        const preview = await previewQbStreamingHistory({
          year: source.data.year,
          sheetUrl: source.data.sheet,
          resolutions,
        });
        const counts = await importQbStreamingHistory(
          source.data.year,
          preview,
        );
        return typedjson({
          message: `Imported ${source.data.year}: ${counts.weeks} weeks, ${counts.selections} entries.`,
          status: 'success' as const,
        });
      } catch (error) {
        return fail(errorMessage(error));
      }
    }
  }

  return fail('Unknown action.');
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const url = new URL(request.url);
  const year = Number(url.searchParams.get('year')) || IMPORTABLE_YEARS[0];
  const sheet = url.searchParams.get('sheet') ?? KNOWN_SHEETS[year] ?? '';
  const source = { year, sheet };

  // Nothing is downloaded until the admin asks for a preview.
  if (!url.searchParams.has('sheet')) {
    return typedjson({ source, preview: null, error: null, members: [] });
  }

  const parsedSource = zSource.safeParse(source);
  if (!parsedSource.success) {
    return typedjson({
      source,
      preview: null,
      error: parsedSource.error.issues[0].message,
      members: [],
    });
  }

  const members = (await getUsers()).map(({ id, discordName }) => ({
    id,
    discordName,
  }));

  try {
    const preview = await previewQbStreamingHistory({
      year: parsedSource.data.year,
      sheetUrl: parsedSource.data.sheet,
    });
    const suggest = createMemberSuggester(members, { lookAlike: true });

    return typedjson({
      source,
      preview: {
        ...preview,
        managers: preview.managers.map(manager => ({
          ...manager,
          suggestedMemberId: manager.member
            ? ''
            : suggest(...manager.spellings),
        })),
      },
      error: null,
      members,
    });
  } catch (error) {
    return typedjson({
      source,
      preview: null,
      error: errorMessage(error),
      members,
    });
  }
};

const describePick = (pick: SheetPick) => `${pick.qb} (${pick.points})`;

export default function ImportQbStreamingHistory() {
  const { source, preview, error, members } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  const unmatched = preview?.managers.filter(manager => !manager.member) ?? [];
  const matched = preview?.managers.filter(manager => manager.member) ?? [];
  // Duplicate picks are chosen in the import form itself, so only the rest
  // stop the button from being pressed.
  const otherBlocking = preview
    ? preview.blocking.length - (preview.unresolved > 0 ? 1 : 0)
    : 1;

  return (
    <>
      <h2 className='mt-0'>Import QB Streaming History</h2>
      <p>
        Brings a season that was run in Google Sheets onto the site. Link the
        sheet's <strong>Data</strong> tab (Week, Player, Choice, Type, Fantasy
        Points); it has to be viewable by anyone with the link. Points are taken
        from the sheet as recorded - Sleeper's stats are only used to find each
        quarterback's game and to flag scores that look off. Importing a year
        replaces anything already imported for it.
      </p>

      <Form method='GET' className='not-prose flex flex-wrap items-end gap-2'>
        <label className='flex flex-col text-sm'>
          Year
          <select
            name='year'
            defaultValue={source.year}
            className='rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100'
            onChange={event => {
              const input = event.currentTarget.form?.elements.namedItem(
                'sheet',
              ) as HTMLInputElement | null;
              const known = KNOWN_SHEETS[Number(event.currentTarget.value)];
              if (input && known) input.value = known;
            }}
          >
            {IMPORTABLE_YEARS.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className='flex flex-grow flex-col text-sm'>
          Sheet link
          <input
            type='url'
            name='sheet'
            defaultValue={source.sheet}
            required
            className='rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100'
          />
        </label>
        <Button type='submit' disabled={busy}>
          Preview
        </Button>
      </Form>

      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      {error && <Alert message={error} status='error' />}

      {preview && (
        <>
          {otherBlocking > 0 ? (
            <Alert
              message={`Not ready to import yet: ${preview.blocking.join(' ')}`}
              status='warning'
            />
          ) : (
            <Alert
              message={
                preview.unresolved > 0
                  ? 'Ready to import once you choose which picks count in the entries below.'
                  : 'Ready to import.'
              }
              status='success'
            />
          )}

          <h3>Names ({preview.managers.length})</h3>
          <p>
            Match every name in the sheet to a member. A name that belongs to
            someone who never joined the site can get a stub member instead,
            which can be merged into their real account later from{' '}
            <Link to='/admin/members/merge'>Merge members</Link>. Matches are
            saved as you go and reused by later imports.
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
                {unmatched.map(manager => (
                  <tr key={manager.alias}>
                    <td>{manager.spellings.join(', ')}</td>
                    <td>{manager.picks}</td>
                    <td className='not-prose'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Form method='POST' className='flex items-center gap-2'>
                          <input
                            type='hidden'
                            name='name'
                            value={manager.spellings[0]}
                          />
                          <MemberSelect
                            name='userId'
                            members={members}
                            defaultValue={manager.suggestedMemberId}
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
                            value={manager.spellings[0]}
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
                  {matched.map(manager => (
                    <tr key={manager.alias}>
                      <td>{manager.spellings.join(', ')}</td>
                      <td>{manager.picks}</td>
                      <td>{manager.member?.discordName}</td>
                      <td>
                        <Form method='POST'>
                          <input
                            type='hidden'
                            name='name'
                            value={manager.spellings[0]}
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

          {preview.parseErrors.length > 0 && (
            <>
              <h3>Unreadable lines</h3>
              <ul>
                {preview.parseErrors.map(parseError => (
                  <li key={parseError}>{parseError}</li>
                ))}
              </ul>
            </>
          )}

          {(preview.qbErrors.length > 0 || preview.qbNotes.length > 0) && (
            <>
              <h3>Quarterbacks</h3>
              {preview.qbErrors.map(qbError => (
                <Alert
                  key={`${qbError.week}:${qbError.qb}`}
                  message={`Week ${qbError.week}: ${qbError.error}`}
                  status='error'
                />
              ))}
              {preview.qbNotes.length > 0 && (
                <table className='w-full'>
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Sheet says</th>
                      <th>Matched to</th>
                      <th>How</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.qbNotes.map(note => (
                      <tr key={`${note.week}:${note.qb}`}>
                        <td>{note.week}</td>
                        <td>{note.qb}</td>
                        <td>
                          {note.matched} ({note.team ?? '?'})
                        </td>
                        <td>
                          {note.how === 'didNotPlay'
                            ? 'Did not play - team from another week'
                            : 'Last name and points'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {preview.pointDiffs.length > 0 && (
            <>
              <h3>Scores that differ from Sleeper</h3>
              <p>
                The sheet's number is what gets imported. These are usually stat
                corrections made after the sheet was scored.
              </p>
              <table className='w-full'>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Quarterback</th>
                    <th>Sheet</th>
                    <th>Sleeper</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pointDiffs.map(diff => (
                    <tr key={`${diff.week}:${diff.qb}`}>
                      <td>{diff.week}</td>
                      <td>{diff.qb}</td>
                      <td>{diff.sheetPoints}</td>
                      <td>{diff.sleeperPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <Form method='POST'>
            <input type='hidden' name='year' value={source.year} />
            <input type='hidden' name='sheet' value={source.sheet} />

            {preview.entries.length > 0 && (
              <>
                <h3>Entries that need a look</h3>
                <p>
                  Where someone has more than one pick in a slot, choose the one
                  that counts. An empty slot scores 0 and shows as "No pick".
                </p>
                <table className='w-full'>
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Member</th>
                      <th>Standard</th>
                      <th>Deep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map(({ entry, memberName }) => (
                      <tr key={`${entry.week}:${entry.key}`}>
                        <td>{entry.week}</td>
                        <td>{memberName}</td>
                        {(['standard', 'deep'] as const).map(slot => (
                          <td key={slot}>
                            {entry[slot].length === 0 && 'No pick (0)'}
                            {entry[slot].length === 1 &&
                              describePick(entry[slot][0])}
                            {entry[slot].length > 1 &&
                              entry[slot].map(pick => (
                                <label key={pick.line} className='block'>
                                  <input
                                    type='radio'
                                    name={resolutionField(entry, slot)}
                                    value={String(pick.line)}
                                    required
                                  />{' '}
                                  {describePick(pick)}
                                  <span className='text-sm opacity-75'>
                                    {' '}
                                    line {pick.line}
                                  </span>
                                </label>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <Button
              type='submit'
              name='_action'
              value='import'
              disabled={busy || otherBlocking > 0}
            >
              {`Import ${source.year}`}
            </Button>
          </Form>

          {preview.totals.length > 0 && (
            <>
              <h3>Season totals</h3>
              <p>
                What the standings will show, to check against the sheet's own
                leaderboard.
                {preview.unresolved > 0 &&
                  ' Entries with a choice still to make are left out.'}
              </p>
              <table className='w-full'>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Weeks</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.totals.map(total => (
                    <tr key={total.userId}>
                      <td>{total.name}</td>
                      <td>{total.weeks}</td>
                      <td>{total.points.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </>
  );
}
