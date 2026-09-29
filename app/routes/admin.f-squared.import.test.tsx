import { action, loader } from './admin.f-squared.import';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryPreview } from '~/libs/f-squared/history-import.server';
import * as historyImport from '~/libs/f-squared/history-import.server';
import * as memberAliasModel from '~/models/memberAlias.server';
import type { User } from '~/models/user.server';
import * as userModel from '~/models/user.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/libs/f-squared/history-import.server', async () => {
  const actual = await vi.importActual<typeof historyImport>(
    '~/libs/f-squared/history-import.server',
  );
  return {
    FIRST_SITE_F_SQUARED_YEAR: actual.FIRST_SITE_F_SQUARED_YEAR,
    HistoryImportError: actual.HistoryImportError,
    previewFSquaredHistory: vi.fn(),
    importFSquaredHistory: vi.fn(),
  };
});
vi.mock('~/models/memberAlias.server');
vi.mock('~/models/user.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockUser: User = {
  id: 'user-admin',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  discordId: 'discord-admin',
  discordName: 'Admin',
  discordAvatar: '',
  discordRoles: [],
  mergedIntoId: null,
  mergedAt: null,
  discordUsername: null,
  discordGlobalName: null,
  discordNick: null,
  discordUserAvatar: null,
  discordGuildAvatar: null,
  inGuild: null,
  discordSyncedAt: null,
};

const URL_BASE = 'http://localhost/admin/f-squared/import';
const SHEET = 'https://docs.google.com/spreadsheets/d/x';

const actionArgs = (formData: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(formData)) {
    body.set(key, value);
  }

  return {
    params: {},
    request: new Request(URL_BASE, { method: 'POST', body }),
    context: {},
  } as ActionFunctionArgs;
};

const loaderArgs = (search: string) =>
  ({
    params: {},
    request: new Request(`${URL_BASE}${search}`),
    context: {},
  } as LoaderFunctionArgs);

const emptyPreview: HistoryPreview = {
  managers: [],
  teams: [],
  teamErrors: [],
  pickErrors: [],
  entryNotes: [],
  entries: [],
  ownerSuggestions: {},
  blocking: [],
  parseErrors: [],
};

const importForm = (overrides: Record<string, string> = {}) => ({
  _action: 'import',
  year: '2020',
  sheet: SHEET,
  picksTab: 'Form Responses Normalized',
  teamsTab: 'Fantasy Team Scores',
  ...overrides,
});

describe('admin.f-squared.import', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // @ts-expect-error - Mocking narrower type (User) than actual (User | null)
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(mockUser);
    vi.mocked(userModel.getUsers).mockResolvedValue([]);
  });

  it('checks for an admin before doing anything', async () => {
    vi.mocked(auth.requireAdmin).mockImplementation(() => {
      throw new Response('Forbidden', { status: 403 });
    });

    await expect(
      action(actionArgs({ _action: 'createStub', name: 'Tre Duce' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(memberAliasModel.createStubMemberForAlias).not.toHaveBeenCalled();
  });

  it('fills in the first known sheet and downloads nothing until asked', async () => {
    const response = await loader(loaderArgs(''));
    const data = await response.json();

    expect(data.preview).toBeNull();
    expect(data.source).toMatchObject({
      year: 2019,
      picksTab: 'Pick Data',
      teamsTab: 'Fantasy Team Scores',
    });
    expect(data.source.sheet).toContain('docs.google.com');
    expect(historyImport.previewFSquaredHistory).not.toHaveBeenCalled();
  });

  it('previews with the tabs asked for, suggesting look-alike members', async () => {
    vi.mocked(userModel.getUsers).mockResolvedValue([
      {
        ...mockUser,
        id: 'klay',
        discordName: 'klaystation',
        sleeperUsers: [],
        nameHistory: [],
      },
    ]);
    vi.mocked(historyImport.previewFSquaredHistory).mockResolvedValue({
      ...emptyPreview,
      managers: [
        { alias: 'klay', spellings: ['Klay'], picks: 10, member: null },
      ],
    });

    const response = await loader(
      loaderArgs(`?year=2021&sheet=${SHEET}&picksTab=Picks&teamsTab=Teams`),
    );
    const data = await response.json();

    expect(historyImport.previewFSquaredHistory).toHaveBeenCalledWith({
      year: 2021,
      sheetUrl: SHEET,
      picksTab: 'Picks',
      teamsTab: 'Teams',
    });
    expect(data.preview.managers[0].suggestedMemberId).toBe('klay');
  });

  it('prefers the member who managed the team the name belongs to', async () => {
    vi.mocked(userModel.getUsers).mockResolvedValue([
      {
        ...mockUser,
        id: 'klay',
        discordName: 'klaystation',
        sleeperUsers: [],
        nameHistory: [],
      },
      {
        ...mockUser,
        id: 'slim',
        discordName: 'slimarabia',
        sleeperUsers: [],
        nameHistory: [],
      },
    ]);
    vi.mocked(historyImport.previewFSquaredHistory).mockResolvedValue({
      ...emptyPreview,
      managers: [
        { alias: 'jad', spellings: ['Jad'], picks: 10, member: null },
        { alias: 'klay', spellings: ['Klay'], picks: 10, member: null },
      ],
      // A merged-away member is not offered, so the name look-alike stands.
      ownerSuggestions: { jad: 'slim', klay: 'merged-away' },
    });

    const response = await loader(loaderArgs(`?year=2021&sheet=${SHEET}`));
    const data = await response.json();

    expect(
      data.preview.managers.map(
        (manager: { suggestedMemberId: string }) => manager.suggestedMemberId,
      ),
    ).toEqual(['slim', 'klay']);
  });

  it('shows a download problem instead of crashing', async () => {
    vi.mocked(historyImport.previewFSquaredHistory).mockRejectedValue(
      new historyImport.HistoryImportError('Could not download the sheet.'),
    );

    const response = await loader(loaderArgs(`?year=2020&sheet=${SHEET}`));
    const data = await response.json();

    expect(data.error).toBe('Could not download the sheet.');
  });

  it('matches a name to a member', async () => {
    vi.mocked(userModel.getUser).mockResolvedValue({
      ...mockUser,
      id: 'klay',
      discordName: 'klaystation',
    });

    const response = await action(
      actionArgs({ _action: 'matchName', name: 'Klay', userId: 'klay' }),
    );

    expect((await response.json()).status).toBe('success');
    expect(memberAliasModel.upsertMemberAlias).toHaveBeenCalledWith(
      'Klay',
      'klay',
    );
  });

  it('never imports a season the site ran', async () => {
    const response = await action(actionArgs(importForm({ year: '2022' })));

    expect((await response.json()).status).toBe('error');
    expect(historyImport.previewFSquaredHistory).not.toHaveBeenCalled();
    expect(historyImport.importFSquaredHistory).not.toHaveBeenCalled();
  });

  it('imports after re-reading the sheet', async () => {
    vi.mocked(historyImport.previewFSquaredHistory).mockResolvedValue(
      emptyPreview,
    );
    vi.mocked(historyImport.importFSquaredHistory).mockResolvedValue({
      entries: 39,
    });

    const response = await action(actionArgs(importForm()));

    expect(historyImport.previewFSquaredHistory).toHaveBeenCalledWith({
      year: 2020,
      sheetUrl: SHEET,
      picksTab: 'Form Responses Normalized',
      teamsTab: 'Fantasy Team Scores',
    });
    expect(await response.json()).toEqual({
      message: 'Imported 2020: 39 entries.',
      status: 'success',
    });
  });

  it('reports why an import was refused', async () => {
    vi.mocked(historyImport.previewFSquaredHistory).mockResolvedValue(
      emptyPreview,
    );
    vi.mocked(historyImport.importFSquaredHistory).mockRejectedValue(
      new historyImport.HistoryImportError('Nothing was imported: nope'),
    );

    const response = await action(actionArgs(importForm()));

    expect(await response.json()).toEqual({
      message: 'Nothing was imported: nope',
      status: 'error',
    });
  });
});
