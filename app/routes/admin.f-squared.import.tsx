import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { z } from 'zod';
import SheetNamesTable from '~/components/layout/admin/SheetNamesTable';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { toSelectableMember } from '~/components/ui/MemberSelect';
import type { HistoryPreview } from '~/libs/f-squared/history-import.server';
import {
  FIRST_SITE_F_SQUARED_YEAR,
  HistoryImportError,
  importFSquaredHistory,
  previewFSquaredHistory,
} from '~/libs/f-squared/history-import.server';
import { withSuggestions } from '~/libs/sheet-names';
import {
  SHEET_NAME_ACTIONS,
  handleSheetNameAction,
} from '~/libs/sheet-names.server';
import { getUsers } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

const TEAMS_TAB = 'Fantasy Team Scores';

/** Each season's sheet from issue #154, and the tab its picks are on. */
const KNOWN_SHEETS: Record<
  number,
  { sheet: string; picksTab: string; teamsTab: string }
> = {
  2019: {
    sheet:
      'https://docs.google.com/spreadsheets/d/1LTgafHLhuTlXal8tJbPAiFZP-sotWkH7Pj_dvOK6k5U/edit',
    picksTab: 'Pick Data',
    teamsTab: TEAMS_TAB,
  },
  2020: {
    sheet:
      'https://docs.google.com/spreadsheets/d/1ISYKNUyDTDElPRuaf-eI7NPbjGZcgKbmflai19STJJ0/edit',
    picksTab: 'Form Responses Normalized',
    teamsTab: TEAMS_TAB,
  },
  2021: {
    sheet:
      'https://docs.google.com/spreadsheets/d/15OOuKB6Bo0qzJLlNEwQld5He0PWCwiR7iOaO7NkM0Ro/edit',
    picksTab: 'Form Responses Normalized',
    teamsTab: TEAMS_TAB,
  },
};
const IMPORTABLE_YEARS = Object.keys(KNOWN_SHEETS).map(Number);

const zSource = z.object({
  year: z.coerce
    .number()
    .int()
    .max(
      FIRST_SITE_F_SQUARED_YEAR - 1,
      `F² was run on the site from ${FIRST_SITE_F_SQUARED_YEAR}.`,
    ),
  sheet: z.string().min(1, 'Paste a link to the sheet.'),
  picksTab: z.string().trim().min(1, 'Name the tab the picks are on.'),
  teamsTab: z.string().trim().min(1, 'Name the tab the team scores are on.'),
});

type Source = z.infer<typeof zSource>;

const errorMessage = (error: unknown) => {
  if (error instanceof HistoryImportError) return error.message;
  throw error;
};

const preview = (source: Source) =>
  previewFSquaredHistory({
    year: source.year,
    sheetUrl: source.sheet,
    picksTab: source.picksTab,
    teamsTab: source.teamsTab,
  });

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

  const intent = formData.get('_action');
  if (SHEET_NAME_ACTIONS.includes(String(intent))) {
    return typedjson(await handleSheetNameAction(formData));
  }
  if (intent !== 'import') return fail('Unknown action.');

  const source = zSource.safeParse({
    year: formData.get('year'),
    sheet: formData.get('sheet'),
    picksTab: formData.get('picksTab'),
    teamsTab: formData.get('teamsTab'),
  });
  if (!source.success) return fail(source.error.issues[0].message);

  try {
    // Re-read everything rather than trusting the page, which may be stale.
    const history = await preview(source.data);
    const counts = await importFSquaredHistory(source.data.year, history);
    return typedjson({
      message: `Imported ${source.data.year}: ${counts.entries} entries.`,
      status: 'success' as const,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
};

/** The preview without its weekly scores, which the page has no use for. */
const forPage = (history: HistoryPreview) => ({
  ...history,
  teams: history.teams.map(({ sheet, site, difference }) => ({
    league: sheet.league,
    sheetName: sheet.name,
    sheetPoints: sheet.points,
    owner: site.owner,
    sitePoints: site.pointsFor,
    difference,
  })),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const url = new URL(request.url);
  const year = Number(url.searchParams.get('year')) || IMPORTABLE_YEARS[0];
  const known = KNOWN_SHEETS[year];
  const source = {
    year,
    sheet: url.searchParams.get('sheet') ?? known?.sheet ?? '',
    picksTab: url.searchParams.get('picksTab') ?? known?.picksTab ?? '',
    teamsTab: url.searchParams.get('teamsTab') ?? known?.teamsTab ?? TEAMS_TAB,
  };

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

  const members = (await getUsers()).map(toSelectableMember);

  try {
    const history = forPage(await preview(parsedSource.data));

    return typedjson({
      source,
      preview: {
        ...history,
        managers: withSuggestions(
          history.managers,
          members,
          history.ownerSuggestions,
        ),
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

const inputClass =
  'rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100';

export default function ImportFSquaredHistory() {
  const { source, preview, error, members } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <>
      <h2 className='mt-0'>Import F² History</h2>
      <p>
        Brings an F² season that was run in Google Sheets onto the site. The
        sheet has to be viewable by anyone with the link. Two of its tabs are
        read: the picks (one row per pick, with Manager, Pick and Points) and
        the Fantasy Team Scores, whose weekly scores tell which site team each
        pick means. Entries score their teams' points on the site, which can be
        a few points off the sheet's where Sleeper corrected stats afterwards.
        Importing a year replaces anything already imported for it.
      </p>

      <Form method='GET' className='not-prose flex flex-wrap items-end gap-2'>
        <label className='flex flex-col text-sm'>
          Year
          <select
            name='year'
            defaultValue={source.year}
            className={inputClass}
            onChange={event => {
              const form = event.currentTarget.form;
              const known = KNOWN_SHEETS[Number(event.currentTarget.value)];
              if (!form || !known) return;
              for (const field of ['sheet', 'picksTab', 'teamsTab'] as const) {
                const input = form.elements.namedItem(
                  field,
                ) as HTMLInputElement | null;
                if (input) input.value = known[field];
              }
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
            className={inputClass}
          />
        </label>
        <label className='flex flex-col text-sm'>
          Picks tab
          <input
            name='picksTab'
            defaultValue={source.picksTab}
            required
            className={inputClass}
          />
        </label>
        <label className='flex flex-col text-sm'>
          Team scores tab
          <input
            name='teamsTab'
            defaultValue={source.teamsTab}
            required
            className={inputClass}
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
          {preview.blocking.length > 0 ? (
            <Alert
              message={`Not ready to import yet: ${preview.blocking.join(' ')}`}
              status='warning'
            />
          ) : (
            <Alert message='Ready to import.' status='success' />
          )}

          <SheetNamesTable
            names={preview.managers}
            members={members}
            busy={busy}
          />

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

          {(preview.teamErrors.length > 0 || preview.pickErrors.length > 0) && (
            <>
              <h3>Teams that could not be matched</h3>
              {preview.teamErrors.map(teamError => (
                <Alert key={teamError} message={teamError} status='error' />
              ))}
              {preview.pickErrors.map(pickError => (
                <Alert
                  key={pickError.line}
                  message={`Picks line ${pickError.line} (${pickError.manager}): ${pickError.error}`}
                  status='error'
                />
              ))}
            </>
          )}

          {preview.entryNotes.length > 0 && (
            <>
              <h3>Entries that need a look</h3>
              <p>These are imported as the sheet had them.</p>
              <ul>
                {preview.entryNotes.map(note => (
                  <li key={`${note.name}:${note.note}`}>
                    {note.name}: {note.note}
                  </li>
                ))}
              </ul>
            </>
          )}

          {preview.teams.length > 0 && (
            <details>
              <summary>
                Teams ({preview.teams.length}), matched by weekly scores
              </summary>
              <p>
                Each sheet team and the site team whose weekly scores are
                closest. Differences of a few points are stat corrections made
                after the sheet was scored.
              </p>
              <table className='w-full'>
                <thead>
                  <tr>
                    <th>League</th>
                    <th>Sheet name</th>
                    <th>Site team</th>
                    <th>Sheet points</th>
                    <th>Site points</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.teams.map(team => (
                    <tr key={`${team.league}:${team.sheetName}`}>
                      <td>{team.league}</td>
                      <td>{team.sheetName}</td>
                      <td>{team.owner ?? 'Unowned'}</td>
                      <td>{team.sheetPoints.toFixed(2)}</td>
                      <td>{team.sitePoints.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <Form method='POST'>
            <input type='hidden' name='year' value={source.year} />
            <input type='hidden' name='sheet' value={source.sheet} />
            <input type='hidden' name='picksTab' value={source.picksTab} />
            <input type='hidden' name='teamsTab' value={source.teamsTab} />
            <Button
              type='submit'
              name='_action'
              value='import'
              disabled={busy || preview.blocking.length > 0}
            >
              {`Import ${source.year}`}
            </Button>
          </Form>

          {preview.entries.length > 0 && (
            <>
              <h3>Entries ({preview.entries.length})</h3>
              <p>
                What the standings will show, with the sheet's own total to
                check against.
              </p>
              <table className='w-full'>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Teams</th>
                    <th>Points</th>
                    <th>Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map(entry => (
                    <tr key={entry.userId}>
                      <td>{entry.name}</td>
                      <td>{entry.teamIds.length}</td>
                      <td>{entry.sitePoints.toFixed(2)}</td>
                      <td>{entry.sheetPoints.toFixed(2)}</td>
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
