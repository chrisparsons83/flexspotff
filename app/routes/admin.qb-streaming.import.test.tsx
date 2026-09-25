import { action, loader } from './admin.qb-streaming.import';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as historyImport from '~/libs/qb-streaming/history-import.server';
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
vi.mock('~/libs/qb-streaming/history-import.server', async () => {
  const actual = await vi.importActual<typeof historyImport>(
    '~/libs/qb-streaming/history-import.server',
  );
  return {
    FIRST_SITE_QB_STREAMING_YEAR: actual.FIRST_SITE_QB_STREAMING_YEAR,
    HistoryImportError: actual.HistoryImportError,
    previewQbStreamingHistory: vi.fn(),
    importQbStreamingHistory: vi.fn(),
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
};

const URL_BASE = 'http://localhost/admin/qb-streaming/import';

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

const emptyPreview = {
  managers: [],
  qbErrors: [],
  qbNotes: [],
  pointDiffs: [],
  entries: [],
  totals: [],
  weeks: [],
  unresolved: 0,
  blocking: [],
  parseErrors: [],
};

describe('admin.qb-streaming.import', () => {
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

  it('downloads nothing until a preview is asked for', async () => {
    const response = await loader(loaderArgs(''));
    const data = await response.json();

    expect(data.preview).toBeNull();
    expect(data.source.year).toBe(2020);
    expect(data.source.sheet).toContain('docs.google.com');
    expect(historyImport.previewQbStreamingHistory).not.toHaveBeenCalled();
  });

  it('suggests look-alike members for unmatched names', async () => {
    vi.mocked(userModel.getUsers).mockResolvedValue([
      { ...mockUser, id: 'klay', discordName: 'klaystation', sleeperUsers: [] },
    ]);
    vi.mocked(historyImport.previewQbStreamingHistory).mockResolvedValue({
      ...emptyPreview,
      managers: [
        { alias: 'klay', spellings: ['Klay'], picks: 8, member: null },
      ],
    });

    const response = await loader(
      loaderArgs('?year=2020&sheet=https://docs.google.com/spreadsheets/d/x'),
    );
    const data = await response.json();

    expect(data.preview.managers[0].suggestedMemberId).toBe('klay');
  });

  it('shows a download problem instead of crashing', async () => {
    vi.mocked(historyImport.previewQbStreamingHistory).mockRejectedValue(
      new historyImport.HistoryImportError('Could not download the sheet.'),
    );

    const response = await loader(
      loaderArgs('?year=2020&sheet=https://docs.google.com/spreadsheets/d/x'),
    );
    const data = await response.json();

    expect(data.error).toBe('Could not download the sheet.');
  });

  it('refuses to match a name to a merged-away member', async () => {
    vi.mocked(userModel.getUser).mockResolvedValue({
      ...mockUser,
      id: 'old',
      discordName: 'Old',
      mergedIntoId: 'new',
    });

    const response = await action(
      actionArgs({ _action: 'matchName', name: 'Klay', userId: 'old' }),
    );
    const data = await response.json();

    expect(data.status).toBe('error');
    expect(memberAliasModel.upsertMemberAlias).not.toHaveBeenCalled();
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
    const response = await action(
      actionArgs({
        _action: 'import',
        year: '2022',
        sheet: 'https://docs.google.com/spreadsheets/d/x',
      }),
    );

    expect((await response.json()).status).toBe('error');
    expect(historyImport.previewQbStreamingHistory).not.toHaveBeenCalled();
    expect(historyImport.importQbStreamingHistory).not.toHaveBeenCalled();
  });

  it('imports with the chosen picks, re-reading the sheet first', async () => {
    vi.mocked(historyImport.previewQbStreamingHistory).mockResolvedValue(
      emptyPreview,
    );
    vi.mocked(historyImport.importQbStreamingHistory).mockResolvedValue({
      weeks: 16,
      options: 300,
      selections: 372,
    });

    const response = await action(
      actionArgs({
        _action: 'import',
        year: '2020',
        sheet: 'https://docs.google.com/spreadsheets/d/x',
        'pick:11:apatel:standard': '400',
        ignored: 'x',
      }),
    );

    expect(historyImport.previewQbStreamingHistory).toHaveBeenCalledWith({
      year: 2020,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/x',
      resolutions: { 'pick:11:apatel:standard': '400' },
    });
    expect(await response.json()).toEqual({
      message: 'Imported 2020: 16 weeks, 372 entries.',
      status: 'success',
    });
  });

  it('reports why an import was refused', async () => {
    vi.mocked(historyImport.previewQbStreamingHistory).mockResolvedValue(
      emptyPreview,
    );
    vi.mocked(historyImport.importQbStreamingHistory).mockRejectedValue(
      new historyImport.HistoryImportError('Nothing was imported: nope'),
    );

    const response = await action(
      actionArgs({
        _action: 'import',
        year: '2020',
        sheet: 'https://docs.google.com/spreadsheets/d/x',
      }),
    );

    expect(await response.json()).toEqual({
      message: 'Nothing was imported: nope',
      status: 'error',
    });
  });
});
